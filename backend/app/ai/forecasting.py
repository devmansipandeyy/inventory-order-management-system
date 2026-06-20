from __future__ import annotations


def holt_forecast(
    history: list[float], periods: int = 3, alpha: float = 0.5, beta: float = 0.3
) -> list[float]:
    if not history:
        return [0.0] * periods
    if len(history) == 1:
        return [max(0.0, float(history[0]))] * periods

    level = float(history[0])
    trend = float(history[1] - history[0])
    for value in history[1:]:
        prev_level = level
        level = alpha * value + (1 - alpha) * (level + trend)
        trend = beta * (level - prev_level) + (1 - beta) * trend

    return [max(0.0, round(level + (i + 1) * trend, 2)) for i in range(periods)]


def recommended_reorder_qty(forecast: list[float], on_hand: int, reorder_qty_floor: int) -> int:
    projected_demand = sum(forecast)
    needed = max(0.0, projected_demand - on_hand)
    return int(max(reorder_qty_floor, round(needed)))


def fallback_explanation(name: str, forecast: list[float], rec_qty: int) -> str:
    avg = round(sum(forecast) / len(forecast), 1) if forecast else 0
    return (
        f"Projected demand for {name} averages ~{avg} units/period over the next "
        f"{len(forecast)} periods (trend-adjusted). Recommended reorder quantity: {rec_qty} units."
    )
