#!/usr/bin/env python3
"""Unit tests for check-chronicle.py's validators.
Run: python3 scripts/test-check-chronicle.py"""
import importlib.util
import re
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "check_chronicle", Path(__file__).resolve().parent / "check-chronicle.py"
)
cc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cc)

TS_PATH = Path(__file__).resolve().parent.parent / "quartz/components/scripts/chronicle.inline.ts"

def test_valid_headings():
    assert cc.check_headings("## Vigilia 1, 363 VR\n") == []
    assert cc.check_headings("## Adventus 12, 366 VR\n") == []
    assert cc.check_headings("## Vesper 33, 400 VR\n") == []
    assert cc.check_headings("## Bellum, 363 VR\n") == []
    assert cc.check_headings("## Sigillum, 363 VR\n") == []
    assert cc.check_headings("## Regnum, 363 VR\n") == []
    # Passing must mean "parsed", not "ignored as a non-date" (#18).
    for line in ("## Adventus 12, 366 VR", "## Bellum, 366 VR", "## Sigillum, 366 VR", "## Regnum, 366 VR"):
        assert cc.DATEISH_RE.match(line), f"canonical heading not recognized as a date: {line!r}"
        assert cc.MONTH_HEADING_RE.match(line) or cc.HOLIDAY_HEADING_RE.match(line), \
            f"canonical heading not parsed: {line!r}"
    assert cc.check_headings("## The Keeping of This Chronicle\n") == [], \
        "non-date h2s are allowed and ignored"
    assert cc.check_headings("## Related pages\n") == []

def test_deeper_headings_are_not_date_attempts():
    # Only h2s are date headings; an h3 or deeper that mentions a year is prose.
    assert cc.check_headings("### Notes from 366 VR\n") == []
    assert cc.check_headings("### Adventus 12, 366 VR\n") == []
    assert cc.check_headings("#### Day 4 of the march\n") == []

def test_invalid_headings():
    assert cc.check_headings("## Vigilia 34, 363 VR\n"), "day > 33"
    assert cc.check_headings("## Vigilia 0, 363 VR\n"), "day 0"
    assert cc.check_headings("## Brumaire 5, 363 VR\n"), "not a canon month"
    assert cc.check_headings("## Adventis 12, 366 VR\n"), "misspelled month"
    assert cc.check_headings("## Vigilia 05, 363 VR\n"), "zero-padded day in prose heading"
    assert cc.check_headings("## vigilia 5, 363 VR\n"), "casing"
    assert cc.check_headings("## Vigilia 5 363 VR\n"), "missing comma"
    assert cc.check_headings("## Vigilia 5, 363\n"), "missing VR"
    assert cc.check_headings("## Bellum 366 VR\n"), "holiday missing comma"
    assert cc.check_headings("## Bellum 1, 366 VR\n"), "holiday takes no day number"
    assert cc.check_headings("## bellum, 366 VR\n"), "holiday casing"
    assert cc.check_headings("## Bellum, 366\n"), "holiday missing VR"
    assert cc.check_headings("## Bellumm, 366 VR\n"), "misspelled holiday"
    assert cc.check_headings("## Day 5 of the Ninth Month, 363 VR\n"), "retired ordinal form"

def test_retired_forms_fail_loudly():
    # Regression (#18): the canonical forms are "Adventus 12, 366 VR" and
    # "Bellum, 366 VR" (Lucas, 2026-09-30 and 2026-10-02). A retired form must
    # fail the gate rather than publish a page whose days the grid never marks.
    for old in (
        "## Day 12 of Adventus, 366 VR\n",
        "## Day 3 of the Closing Holidays, 363 VR\n",
        "## Closing Holidays 1, 366 VR\n",
    ):
        findings = cc.check_headings(old)
        assert findings, f"retired form must be flagged: {old!r}"
        assert "'## Adventus 12, 366 VR' or '## Bellum, 366 VR'" in findings[0], \
            "finding names the canonical forms"

def _ts_regexes():
    """The calendar script's name lists and heading regexes, as Python
    patterns (the TS source has no '## ' prefix: it matches the rendered h2's
    text)."""
    ts = TS_PATH.read_text()
    months = re.findall(r'^  "(\w+)",$', ts, re.MULTILINE)
    month_src = re.search(r"const MONTH_HEADING_RE = new RegExp\(\s*`(.*)`,?\s*\)", ts).group(1)
    month_src = month_src.replace('${MONTHS.join("|")}', "|".join(months))
    holidays = re.findall(r'"(\w+)"', re.search(r"^const HOLIDAYS = \[(.*)\]$", ts, re.MULTILINE).group(1))
    holiday_src = re.search(r"const HOLIDAY_HEADING_RE = new RegExp\(\s*`(.*)`,?\s*\)", ts).group(1)
    holiday_src = holiday_src.replace('${HOLIDAYS.join("|")}', "|".join(holidays))
    return months, month_src, holiday_src, holidays

def test_calendar_script_regexes_match_checker():
    # The checker's docstring requires its regexes to stay textually
    # equivalent to chronicle.inline.ts; enforce it so the two cannot drift.
    months, month_src, holiday_src, holidays = _ts_regexes()
    assert "|".join(months) == cc.MONTHS
    assert "|".join(holidays) == cc.HOLIDAYS == "Bellum|Sigillum|Regnum"
    assert "^## " + month_src[1:] == cc.MONTH_HEADING_RE.pattern
    assert "^## " + holiday_src[1:] == cc.HOLIDAY_HEADING_RE.pattern

def test_calendar_script_parses_canonical_headings():
    _, month_src, holiday_src, _ = _ts_regexes()
    m = re.match(month_src, "Adventus 12, 366 VR")
    assert m and m.group(1) == "Adventus" and m.group(2) == "12" and m.group(3) == "366"
    h = re.match(holiday_src, "Sigillum, 366 VR")
    assert h and h.group(1) == "Sigillum" and h.group(2) == "366"
    assert not re.match(month_src, "Day 12 of Adventus, 366 VR")
    assert not re.match(holiday_src, "Closing Holidays 2, 366 VR")

def _date_key(year, month_index, day):
    # Mirrors the calendar script's dayKey: index 10 is the holidays ("H").
    return f"{year}-{'H' if month_index == 10 else f'{month_index + 1:02d}'}-{day:02d}"

def test_calendar_script_reads_the_right_capture_groups():
    # parseHeading must read year/month/day from the groups the regex
    # actually captures them in; apply its own indices to its own regex.
    ts = TS_PATH.read_text()
    line = re.search(
        r"if \(m\) return \{ year: \+m\[(\d)\], monthIndex: MONTHS\.indexOf\(m\[(\d)\]\), day: \+m\[(\d)\] \}",
        ts,
    )
    assert line, "parseHeading's month return line not found"
    year_i, month_i, day_i = (int(g) for g in line.groups())
    months, month_src, _, _ = _ts_regexes()
    m = re.match(month_src, "Adventus 12, 366 VR")
    assert (m.group(year_i), m.group(month_i), m.group(day_i)) == ("366", "Adventus", "12")
    assert _date_key(int(m.group(year_i)), months.index(m.group(month_i)), int(m.group(day_i))) == "366-09-12"

def test_calendar_script_maps_holidays_to_days_1_to_3():
    # The holidays carry no day number: the day is the name's position in
    # HOLIDAYS, and the date key stays 366-H-01..03 (month index 10).
    ts = TS_PATH.read_text()
    line = re.search(
        r"if \(h\) return \{ year: \+h\[(\d)\], monthIndex: 10, day: HOLIDAYS\.indexOf\(h\[(\d)\]\) \+ 1 \}",
        ts,
    )
    assert line, "parseHeading's holiday return line not found"
    year_i, name_i = (int(g) for g in line.groups())
    _, _, holiday_src, holidays = _ts_regexes()
    keys = []
    for name in ("Bellum", "Sigillum", "Regnum"):
        h = re.match(holiday_src, f"{name}, 366 VR")
        keys.append(_date_key(int(h.group(year_i)), 10, holidays.index(h.group(name_i)) + 1))
    assert keys == ["366-H-01", "366-H-02", "366-H-03"]

def test_calendar_script_shows_no_internal_holiday_term():
    # "Closing Holidays" is an internal name, never player-facing: the grid
    # label and the holiday cells' titles use the in-world names.
    ts = TS_PATH.read_text()
    assert "Closing Holiday" not in ts
    assert "`${HOLIDAYS[0]} to ${HOLIDAYS[HOLIDAYS.length - 1]}, ${year} VR`" in ts
    assert "HOLIDAYS[d - 1]" in ts, "holiday cells are titled with their own name"

def test_current_date():
    assert cc.check_current_date('current-date: "363-01-01"') == []
    assert cc.check_current_date('current-date: "363-H-02"') == []
    assert cc.check_current_date('current-date: "363-01-34"'), "day out of range"
    assert cc.check_current_date('current-date: "363-H-04"'), "holiday out of range"
    assert cc.check_current_date('current-date: "363-11-01"'), "month out of range"
    assert cc.check_current_date('current-date: "363-1-1"'), "not zero-padded"
    assert cc.check_current_date('type: reference'), "missing entirely"

if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"  PASS {name}")
    print("All check-chronicle tests passed.")
