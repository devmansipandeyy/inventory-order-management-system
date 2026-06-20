import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai import agent, evals
from app.ai.forecasting import fallback_explanation, holt_forecast, recommended_reorder_qty
from app.core.config import settings
from app.core.database import SessionLocal, get_db
from app.core.deps import get_current_user
from app.models import (
    AIChatMessage, EvalCaseResult, EvalRun, PendingAction, Product, PromptVersion,
    StockMovement, User,
)
from app.schemas import (
    ActionDecision, ChatIn, EvalRunOut, FeedbackIn, ForecastOut, PromptIn, PromptOut,
)
from app.services import stock as stock_svc

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/status")
async def ai_status(user: User = Depends(get_current_user)):
    return {"enabled": settings.ai_enabled, "model": settings.openai_model}


@router.post("/chat")
async def chat(body: ChatIn, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    return await agent.run_chat(db, body.session_id, body.message, user)


@router.post("/actions/{action_id}")
async def resolve(action_id: int, body: ActionDecision, db: AsyncSession = Depends(get_db),
                  user: User = Depends(get_current_user)):
    if body.decision not in ("confirm", "reject"):
        raise HTTPException(422, "decision must be 'confirm' or 'reject'")
    res = await agent.resolve_action(db, action_id, body.decision, user)
    if res.get("type") == "error":
        raise HTTPException(404, res["content"])
    return res


@router.post("/feedback")
async def feedback(body: FeedbackIn, db: AsyncSession = Depends(get_db),
                   user: User = Depends(get_current_user)):
    msg = await db.get(AIChatMessage, body.message_id)
    if not msg:
        raise HTTPException(404, "Message not found")
    msg.rating = 1 if body.rating > 0 else -1
    await db.commit()
    return {"ok": True, "message_id": msg.id, "rating": msg.rating}


@router.get("/chat/{session_id}")
async def chat_history(session_id: str, db: AsyncSession = Depends(get_db),
                       user: User = Depends(get_current_user)):
    rows = (await db.execute(
        select(AIChatMessage).where(
            AIChatMessage.session_id == session_id,
            AIChatMessage.role.in_(("user", "assistant")),
        ).order_by(AIChatMessage.created_at)
    )).scalars().all()
    return [
        {"id": m.id, "role": m.role, "content": m.content, "rating": m.rating}
        for m in rows
    ]


@router.delete("/chat/{session_id}", status_code=204)
async def clear_chat(session_id: str, db: AsyncSession = Depends(get_db),
                     user: User = Depends(get_current_user)):
    for m in (await db.execute(
        select(AIChatMessage).where(AIChatMessage.session_id == session_id)
    )).scalars().all():
        await db.delete(m)
    for p in (await db.execute(
        select(PendingAction).where(PendingAction.session_id == session_id)
    )).scalars().all():
        await db.delete(p)
    await db.commit()


async def _sale_history(db: AsyncSession, product_id: int) -> list[int]:
    rows = (await db.execute(
        select(StockMovement).where(
            StockMovement.product_id == product_id, StockMovement.type == "sale"
        ).order_by(StockMovement.created_at)
    )).scalars().all()
    return [abs(m.qty_delta) for m in rows]


@router.get("/forecast/{product_id}", response_model=ForecastOut)
async def forecast(product_id: int, db: AsyncSession = Depends(get_db),
                   user: User = Depends(get_current_user)):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    history = await _sale_history(db, product_id)
    fc = holt_forecast([float(x) for x in history], periods=3)
    on_hand = await stock_svc.on_hand(db, product_id)
    rec = recommended_reorder_qty(fc, on_hand, product.reorder_qty)

    explanation = fallback_explanation(product.name, fc, rec)
    if settings.ai_enabled:
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=settings.openai_api_key)
            resp = await client.chat.completions.create(
                model=settings.openai_model, temperature=0.3,
                messages=[
                    {"role": "system", "content": "You explain inventory forecasts in 2 plain sentences. Use ONLY the numbers given; never invent figures."},
                    {"role": "user", "content": f"Product: {product.name}. Past sales per period: {history}. Forecast next 3 periods: {fc}. On hand: {on_hand}. Recommended reorder qty: {rec}. Explain."},
                ])
            explanation = resp.choices[0].message.content or explanation
        except Exception:
            pass

    return ForecastOut(product_id=product_id, history=history, forecast=fc,
                       recommended_reorder_qty=rec, explanation=explanation)


@router.get("/reorder-suggestions")
async def reorder_suggestions(db: AsyncSession = Depends(get_db),
                              user: User = Depends(get_current_user)):
    low = await stock_svc.low_stock(db)
    out = []
    for row in low:
        product = await db.get(Product, row["product_id"])
        history = await _sale_history(db, row["product_id"])
        fc = holt_forecast([float(x) for x in history], periods=3)
        rec = recommended_reorder_qty(fc, row["on_hand"], product.reorder_qty)
        out.append({**row, "supplier_id": product.supplier_id,
                    "forecast": fc, "recommended_reorder_qty": rec})
    return {"suggestions": out}


@router.get("/prompts", response_model=list[PromptOut])
async def list_prompts(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    return (await db.execute(select(PromptVersion).order_by(desc(PromptVersion.created_at)))).scalars().all()


@router.post("/prompts", response_model=PromptOut, status_code=201)
async def create_prompt(body: PromptIn, db: AsyncSession = Depends(get_db),
                        user: User = Depends(get_current_user)):
    pv = PromptVersion(name=body.name, content=body.content, is_active=False)
    db.add(pv)
    if body.activate:
        for other in (await db.execute(select(PromptVersion))).scalars().all():
            other.is_active = False
        pv.is_active = True
    await db.commit()
    await db.refresh(pv)
    return pv


@router.post("/prompts/{prompt_id}/activate", response_model=PromptOut)
async def activate_prompt(prompt_id: int, db: AsyncSession = Depends(get_db),
                          user: User = Depends(get_current_user)):
    pv = await db.get(PromptVersion, prompt_id)
    if not pv:
        raise HTTPException(404, "Prompt version not found")
    for other in (await db.execute(select(PromptVersion))).scalars().all():
        other.is_active = False
    pv.is_active = True
    await db.commit()
    await db.refresh(pv)
    return pv


@router.post("/evals/run")
async def run_eval(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user),
                   prompt_version_id: int | None = None):
    if not settings.ai_enabled:
        raise HTTPException(400, "AI is disabled; cannot run evals without OPENAI_API_KEY")
    run = EvalRun(status="running", total=len(evals.GOLDEN_SET), prompt_version_id=prompt_version_id)
    db.add(run)
    await db.commit()
    await db.refresh(run)
    asyncio.create_task(evals.run_eval_background(run.id, prompt_version_id))
    return {"run_id": run.id, "total": run.total, "status": "running"}


@router.get("/evals", response_model=list[EvalRunOut])
async def list_evals(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    return (await db.execute(select(EvalRun).order_by(desc(EvalRun.created_at)).limit(20))).scalars().all()


@router.get("/evals/{run_id}")
async def get_eval(run_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    run = await db.get(EvalRun, run_id)
    if not run:
        raise HTTPException(404, "Run not found")
    results = (await db.execute(
        select(EvalCaseResult).where(EvalCaseResult.run_id == run_id)
    )).scalars().all()
    return {
        "id": run.id, "status": run.status, "total": run.total, "passed": run.passed,
        "pass_rate": run.pass_rate,
        "results": [
            {"case_id": r.case_id, "question": r.question, "tool_ok": r.tool_ok,
             "answer_ok": r.answer_ok, "passed": r.passed, "actual": r.actual}
            for r in results
        ],
    }


@router.get("/evals/{run_id}/stream")
async def stream_eval(run_id: int, user: User = Depends(get_current_user)):
    async def gen():
        last = -1
        for _ in range(600):
            async with SessionLocal() as db:
                run = await db.get(EvalRun, run_id)
                if run is None:
                    yield f"data: {json.dumps({'error': 'not found'})}\n\n"
                    return
                done_count = len((await db.execute(
                    select(EvalCaseResult).where(EvalCaseResult.run_id == run_id)
                )).scalars().all())
                if done_count != last:
                    last = done_count
                    yield f"data: {json.dumps({'completed': done_count, 'total': run.total})}\n\n"
                if run.status in ("done", "error"):
                    yield f"data: {json.dumps({'status': run.status, 'pass_rate': run.pass_rate, 'passed': run.passed, 'total': run.total})}\n\n"
                    return
            await asyncio.sleep(1)
    return StreamingResponse(gen(), media_type="text/event-stream")
