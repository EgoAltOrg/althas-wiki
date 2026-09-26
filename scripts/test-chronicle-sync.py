#!/usr/bin/env python3
"""
Unit tests for the Chronicle's sync behavior: (1) a date heading whose only
content was [!gm-only] is dropped entirely after the strip (no metadata leak:
the public page must not reveal that a secret day exists), and (2) the
current-date frontmatter passthrough from the Ontos source. Pure-function
tests on fixtures. Run: python3 scripts/test-chronicle-sync.py
"""
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "sync_from_ontos", Path(__file__).resolve().parent / "sync-from-ontos.py"
)
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)

SECRET_DAY = """Intro prose.

## Day 4 of Vigilia, 363 VR

Public event that stays.

## Day 9 of Vigilia, 363 VR

> [!gm-only]
> A fully secret event.

## Day 12 of Vigilia, 363 VR

Another public event.
"""

def test_secret_day_leaves_no_trace():
    body = sync.strip_callouts(SECRET_DAY)
    body = sync.drop_empty_headings(body)
    assert "Day 9" not in body, "secret-only day heading must be dropped"
    assert "Day 4 of Vigilia" in body
    assert "Day 12 of Vigilia" in body
    assert "fully secret" not in body

MIXED_DAY = """## Day 2 of Sacratio, 363 VR

Public part.

> [!gm-only]
> Secret part.
"""

def test_mixed_day_keeps_heading_and_public_part():
    body = sync.strip_callouts(MIXED_DAY)
    body = sync.drop_empty_headings(body)
    assert "Day 2 of Sacratio" in body
    assert "Public part." in body
    assert "Secret part." not in body

FM_WITH_DATE = 'type: reference\ncurrent-date: "363-01-01"\ntags: [x]'
FM_WITHOUT = "type: reference\ntags: [x]"

def test_current_date_extraction():
    assert sync.extract_current_date(FM_WITH_DATE) == "363-01-01"
    assert sync.extract_current_date(FM_WITHOUT) is None

def test_render_emits_current_date():
    out = sync.render("Chronicle", None, "body\n", current_date="363-01-01")
    fm = out.split("---")[1]
    assert 'current-date: "363-01-01"' in fm

def test_render_omits_current_date_when_absent():
    out = sync.render("Althas", None, "body\n")
    assert "current-date" not in out

PUBLIC_AFTER_GM = """## Codex Magic

Public body.

> [!gm-only]
> A secret note.

> [!note] Attribution
> Adapted under CC-BY 4.0.
"""

def test_public_callout_after_gm_survives():
    # Regression: a public callout following a GM block was being swallowed by
    # the GM strip's blank-gap lookahead, silently dropping (e.g.) CC-BY attribution.
    body = sync.strip_callouts(PUBLIC_AFTER_GM)
    assert "A secret note." not in body, "GM callout must still be stripped"
    assert "Attribution" in body, "public callout after a GM block must survive"
    assert "CC-BY 4.0" in body

CHAINED_GM = """## Secrets

> [!gm-only]
> First secret.

> [!gm-notes]
> Second secret.

Public tail.
"""

def test_chained_gm_callouts_all_stripped():
    # The blank-gap lookahead must still chain consecutive GM callouts.
    body = sync.strip_callouts(CHAINED_GM)
    assert "First secret." not in body
    assert "Second secret." not in body
    assert "Public tail." in body

if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"  PASS {name}")
    print("All chronicle-sync tests passed.")
