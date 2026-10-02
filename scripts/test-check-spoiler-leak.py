#!/usr/bin/env python3
"""Unit tests for check-spoiler-leak.py's scanner.
Run: python3 scripts/test-check-spoiler-leak.py"""
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "check_spoiler_leak", Path(__file__).resolve().parent / "check-spoiler-leak.py"
)
csl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(csl)


def test_catches_the_real_leak():
    # The exact 2026-07-18 leak string must be caught (Tier 1).
    leak = "said to let its bearer hold multiple Miracles (the truth is otherwise, and is GM-only)."
    t1, t2 = csl.scan_text(leak)
    phrases = {p for _, p in t1}
    assert "gm-only" in phrases, "must catch 'GM-only' author terminology"
    assert "the truth is otherwise" in phrases, "must catch 'the truth is otherwise'"


def test_tier1_gm_terms():
    for s in ["This is GM-only.", "> [!gm-notes]", "a note for the GM here", "GM notes below"]:
        t1, _ = csl.scan_text(s)
        assert t1, f"expected a Tier 1 hit in: {s!r}"


def test_tier2_secret_signals():
    for s in ["He is secretly a traitor.", "not yet public knowledge", "posing as a merchant"]:
        _, t2 = csl.scan_text(s)
        assert t2, f"expected a Tier 2 hit in: {s!r}"


def test_perception_framing_is_tier2():
    # The exact 2026-09-27 Tobias Wren leak string must be caught (Tier 2).
    leak = "his manner is gentle and unhurried, and most read the wear on him as a long life given over to devotion."
    _, t2 = csl.scan_text(leak)
    assert t2, "must catch perception framing ('most read ... as')"
    for s in ["The old man passes for a hermit.", "By all appearances she is a widow."]:
        _, t2 = csl.scan_text(s)
        assert t2, f"expected a Tier 2 hit in: {s!r}"


def test_perception_framing_any_subject():
    # Six lines that were live on the wiki (found 2026-09-30) and slipped past a
    # perception pattern that only knew seven hard-coded subjects.
    leaks = [
        "The faithful read it as devotion worn openly.",
        "a match Andaluria reads as its two greatest patrons binding themselves to its recovery",
        "which he passes off as an old war wound",
        "killed, as Polaris believes, by a giant",
        "a redemption in the eyes of everyone else",
        "Appearance only; the rest is held.",
    ]
    for s in leaks:
        t1, t2 = csl.scan_text(s)
        assert t2 and not t1, f"expected a Tier 2 (not Tier 1) hit in: {s!r} (got {t1} {t2})"


def test_secret_existence_phrases_are_tier2():
    for s in [
        "Andaluria reads the match as a binding.",
        "They take him for a god.",
        "the stranger mistook the old man for a beggar",
        "a quiet man who reads as harmless",
        "a wound, as most believe, from the war",
        "the war, as the Church presents it, was holy",
        "She is taken to be of that house.",
        "It is publicly known as a hunting lodge.",
        "He never said otherwise.",
        "A homebrew subclass.",
        "a placeholder name",
    ]:
        t1, t2 = csl.scan_text(s)
        assert t2 and not t1, f"expected a Tier 2 (not Tier 1) hit in: {s!r} (got {t1} {t2})"


def test_new_author_terms_are_tier1():
    for s in ["In-fiction, she is a priest.", "an out-of-character aside", "pending a design pass"]:
        t1, _ = csl.scan_text(s)
        assert t1, f"expected a Tier 1 hit in: {s!r}"


def test_perception_framing_stays_tight():
    # Ordinary prose the subject-agnostic patterns must not flag.
    for s in [
        "In their absence the Holy See took up authority as steward.",
        "a hole torn in the shape that makes what comes through read as fire",
        "The inscription reads as follows.",
        "the great houses took the regency for themselves",
        "see that page for how incantation magic works",
        "a Circinus read the ground for a colony",
        "a weapon that takes a different form for each generation",
        "The house takes as its sigil a wolf.",
    ]:
        t1, t2 = csl.scan_text(s)
        assert not t1 and not t2, f"clean prose should not flag: {s!r} -> {t1} {t2}"


def test_clean_public_prose_passes():
    clean = (
        "The Holy See governs the faith from Hilltop and fields the Parish of "
        "Inquisition as its investigative arm. House Voldis rules Voldaen."
    )
    t1, t2 = csl.scan_text(clean)
    assert not t1 and not t2, f"clean prose should not flag: {t1} {t2}"


def test_in_reality_is_tier2_not_tier1():
    # 'a hole in reality' is legit and only Tier 2 (allowlistable), never Tier 1.
    t1, t2 = csl.scan_text("Codex tears a small hole in reality.")
    assert not t1, "'in reality' must not be Tier 1"
    assert any(p == "in reality" for _, p in t2), "'in reality' should be a Tier 2 hit"


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"  PASS {name}")
    print("All check-spoiler-leak tests passed.")
