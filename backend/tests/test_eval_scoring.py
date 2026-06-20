from app.ai.evals import score_answer, score_case


def test_num_signal_requires_a_digit():
    assert score_answer("#num", "You have 42 units") is True
    assert score_answer("#num", "You have plenty") is False


def test_substring_signal_case_insensitive():
    assert score_answer("electronics", "Total for ELECTRONICS is high") is True
    assert score_answer("electronics", "Total for stationery") is False


def test_none_signal_just_needs_nonempty():
    assert score_answer(None, "anything") is True
    assert score_answer(None, "   ") is False


def test_case_passes_only_when_tool_and_answer_match():
    v = score_case("get_low_stock", None, ["get_low_stock"], "Here is the list")
    assert v == {"tool_ok": True, "answer_ok": True, "passed": True}


def test_case_fails_on_wrong_tool():
    v = score_case("get_low_stock", None, ["search_products"], "Here is the list")
    assert v["tool_ok"] is False and v["passed"] is False
