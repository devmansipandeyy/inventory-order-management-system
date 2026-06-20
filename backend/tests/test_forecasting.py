from app.ai.forecasting import holt_forecast, recommended_reorder_qty


def test_empty_history_returns_zeros():
    assert holt_forecast([], periods=3) == [0.0, 0.0, 0.0]


def test_single_point_is_flat():
    assert holt_forecast([10], periods=2) == [10.0, 10.0]


def test_rising_trend_projects_upward():
    fc = holt_forecast([10, 12, 14, 16], periods=3)
    assert fc[0] < fc[1] < fc[2]
    assert all(v > 0 for v in fc)


def test_forecast_never_negative():
    fc = holt_forecast([100, 50, 20, 5], periods=5)
    assert all(v >= 0 for v in fc)


def test_recommended_qty_respects_floor():
    assert recommended_reorder_qty([1, 1, 1], on_hand=0, reorder_qty_floor=50) == 50


def test_recommended_qty_covers_demand_net_of_stock():
    assert recommended_reorder_qty([10, 10, 10], on_hand=10, reorder_qty_floor=5) == 20
