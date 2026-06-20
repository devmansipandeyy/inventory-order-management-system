from __future__ import annotations

import json
import re

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai import tools as agent_tools
from app.ai.agent import active_system_prompt
from app.core.config import settings
from app.core.database import SessionLocal
from app.models import EvalCaseResult, EvalRun, PromptVersion

GOLDEN_SET = [
    {"id": "low-stock", "q": "Which products are below their reorder point?",
     "tool": "get_low_stock", "answer": None},
    {"id": "total-value", "q": "What is the total inventory value across all products?",
     "tool": "inventory_value", "answer": "#num"},
    {"id": "search-cable", "q": "Search for products with 'cable' in the name.",
     "tool": "search_products", "answer": None},
    {"id": "stock-level", "q": "How many units of SKU-1001 do we currently have on hand?",
     "tool": "get_stock_level", "answer": "#num"},
    {"id": "trend", "q": "Show me the recent sales trend for SKU-1001.",
     "tool": "get_sales_trend", "answer": None},
    {"id": "value-electronics", "q": "How much inventory value is in the Electronics category?",
     "tool": "inventory_value", "answer": "#num"},
    {"id": "search-by-sku", "q": "Find the product with SKU SKU-1002.",
     "tool": "search_products", "answer": None},
    {"id": "low-again", "q": "List everything I need to reorder right now.",
     "tool": "get_low_stock", "answer": None},
]


def score_answer(expected: str | None, answer: str) -> bool:
    if not answer or not answer.strip():
        return False
    if expected is None:
        return True
    if expected == "#num":
        return bool(re.search(r"\d", answer))
    return expected.lower() in answer.lower()


def score_case(expected_tool: str, expected_answer: str | None, used_tools: list[str],
               answer: str) -> dict:
    tool_ok = expected_tool in used_tools
    answer_ok = score_answer(expected_answer, answer)
    return {"tool_ok": tool_ok, "answer_ok": answer_ok, "passed": tool_ok and answer_ok}


async def _run_case(db: AsyncSession, system_prompt: str, question: str) -> tuple[list[str], str]:
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    messages = [{"role": "system", "content": system_prompt},
                {"role": "user", "content": question}]
    used: list[str] = []

    for _ in range(6):
        resp = await client.chat.completions.create(
            model=settings.openai_model, messages=messages,
            tools=agent_tools.TOOL_SCHEMAS, temperature=0,
        )
        msg = resp.choices[0].message
        if not msg.tool_calls:
            return used, msg.content or ""
        messages.append({
            "role": "assistant", "content": msg.content or "",
            "tool_calls": [{"id": tc.id, "type": "function",
                            "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                           for tc in msg.tool_calls]})
        for tc in msg.tool_calls:
            used.append(tc.function.name)
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            if tc.function.name in agent_tools.WRITE_TOOLS:
                result = {"note": "write proposed (would require confirmation)"}
            else:
                result = await agent_tools.execute_read(db, tc.function.name, args)
            messages.append({"role": "tool", "tool_call_id": tc.id, "content": json.dumps(result)})
    return used, ""


async def run_eval_background(run_id: int, prompt_version_id: int | None) -> None:
    async with SessionLocal() as db:
        run = await db.get(EvalRun, run_id)
        if run is None:
            return
        system_prompt = await active_system_prompt(db)
        if prompt_version_id is not None:
            pv = await db.get(PromptVersion, prompt_version_id)
            if pv:
                system_prompt = pv.content

        passed = 0
        for case in GOLDEN_SET:
            try:
                used, answer = await _run_case(db, system_prompt, case["q"])
                verdict = score_case(case["tool"], case["answer"], used, answer)
            except Exception as exc:
                used, answer = [], f"error: {exc}"
                verdict = {"tool_ok": False, "answer_ok": False, "passed": False}
            if verdict["passed"]:
                passed += 1
            db.add(EvalCaseResult(
                run_id=run_id, case_id=case["id"], question=case["q"],
                expected={"tool": case["tool"], "answer": case["answer"]},
                actual={"tools": used, "answer": answer},
                tool_ok=verdict["tool_ok"], answer_ok=verdict["answer_ok"], passed=verdict["passed"],
            ))
            await db.commit()

        run.status = "done"
        run.total = len(GOLDEN_SET)
        run.passed = passed
        run.pass_rate = round(passed / len(GOLDEN_SET), 3) if GOLDEN_SET else 0.0
        await db.commit()
