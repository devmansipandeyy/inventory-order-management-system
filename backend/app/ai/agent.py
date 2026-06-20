from __future__ import annotations

import json

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai import tools as agent_tools
from app.ai.prompts import DEFAULT_SYSTEM_PROMPT
from app.core.config import settings
from app.models import AIChatMessage, PendingAction, PromptVersion, User

MAX_STEPS = 6


def _client():
    if not settings.ai_enabled:
        return None
    from openai import AsyncOpenAI

    return AsyncOpenAI(api_key=settings.openai_api_key)


async def active_system_prompt(db: AsyncSession) -> str:
    pv = (
        await db.execute(select(PromptVersion).where(PromptVersion.is_active.is_(True)))
    ).scalar_one_or_none()
    return pv.content if pv else DEFAULT_SYSTEM_PROMPT


async def _history(db: AsyncSession, session_id: str, limit: int = 10) -> list[dict]:
    rows = (
        await db.execute(
            select(AIChatMessage)
            .where(AIChatMessage.session_id == session_id, AIChatMessage.role.in_(("user", "assistant")))
            .order_by(desc(AIChatMessage.created_at))
            .limit(limit)
        )
    ).scalars().all()
    return [{"role": m.role, "content": m.content} for m in reversed(rows)]


def _summarize_action(tool: str, args: dict) -> str:
    if tool == "adjust_stock":
        return f"Adjust stock of {args.get('sku')} by {args.get('qty_delta')} ({args.get('reason') or 'no reason given'})"
    if tool == "create_purchase_order":
        items = ", ".join(f"{i.get('qty')}x {i.get('sku')}" for i in args.get("items", []))
        return f"Create purchase order with supplier {args.get('supplier_id')}: {items}"
    return f"{tool}({args})"


async def run_chat(db: AsyncSession, session_id: str, message: str, user: User) -> dict:
    db.add(AIChatMessage(session_id=session_id, role="user", content=message))
    await db.commit()

    if not settings.ai_enabled:
        content = ("AI features are disabled (no OPENAI_API_KEY configured). "
                   "All inventory features still work without AI.")
        saved = AIChatMessage(session_id=session_id, role="assistant", content=content)
        db.add(saved)
        await db.commit()
        await db.refresh(saved)
        return {"type": "message", "content": content, "message_id": saved.id}

    client = _client()
    messages = [{"role": "system", "content": await active_system_prompt(db)}]
    messages += await _history(db, session_id)

    for _ in range(MAX_STEPS):
        resp = await client.chat.completions.create(
            model=settings.openai_model, messages=messages,
            tools=agent_tools.TOOL_SCHEMAS, temperature=0,
        )
        msg = resp.choices[0].message

        if not msg.tool_calls:
            content = msg.content or "(no response)"
            saved = AIChatMessage(session_id=session_id, role="assistant", content=content)
            db.add(saved)
            await db.commit()
            await db.refresh(saved)
            return {"type": "message", "content": content, "message_id": saved.id}

        messages.append({
            "role": "assistant", "content": msg.content or "",
            "tool_calls": [{"id": tc.id, "type": "function",
                            "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                           for tc in msg.tool_calls],
        })

        for tc in msg.tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}

            if name in agent_tools.WRITE_TOOLS:
                pending = PendingAction(session_id=session_id, tool_name=name, args=args,
                                        status="pending", created_by=user.id)
                db.add(pending)
                await db.commit()
                await db.refresh(pending)
                return {"type": "confirm_required", "pending_id": pending.id,
                        "tool": name, "args": args, "summary": _summarize_action(name, args)}

            result = await agent_tools.execute_read(db, name, args)
            messages.append({"role": "tool", "tool_call_id": tc.id,
                             "content": json.dumps(result)})

    content = "I couldn't complete that within the step limit. Please rephrase."
    saved = AIChatMessage(session_id=session_id, role="assistant", content=content)
    db.add(saved)
    await db.commit()
    await db.refresh(saved)
    return {"type": "message", "content": content, "message_id": saved.id}


async def resolve_action(db: AsyncSession, action_id: int, decision: str, user: User) -> dict:
    pending = await db.get(PendingAction, action_id)
    if pending is None:
        return {"type": "error", "content": "Action not found"}
    if pending.status != "pending":
        return {"type": "message",
                "content": f"This action was already {pending.status}.",
                "status": pending.status}

    if decision == "reject":
        pending.status = "rejected"
        await db.commit()
        content = "Okay, I won't do that."
        db.add(AIChatMessage(session_id=pending.session_id, role="assistant", content=content))
        await db.commit()
        return {"type": "message", "content": content, "status": "rejected"}

    result = await agent_tools.execute_write(
        db, pending.tool_name, pending.args, user_id=user.id, actor=user.email
    )
    pending.status = "executed"
    pending.result = result
    await db.commit()

    if result.get("error"):
        content = f"That action failed: {result['error']}"
    else:
        content = f"Done. {_summarize_action(pending.tool_name, pending.args)}. Result: {result}"
    db.add(AIChatMessage(session_id=pending.session_id, role="assistant", content=content))
    await db.commit()
    return {"type": "message", "content": content, "status": "executed", "result": result}
