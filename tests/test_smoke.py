"""Smoke test ensuring the pytest pipeline is alive.

Real tests for `scripts/02_parse_kanjidic.py` etc. would need fixture
KANJIDIC2 XML samples (not yet vendored) — that's a follow-up. This file
exists so the CI `pytest` step has at least one test to collect and the
test infrastructure is exercised on every push.
"""


def test_truthy() -> None:
    assert True
