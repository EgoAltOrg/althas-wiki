#!/usr/bin/env python3
"""
Publish gate for the Chronicle (specs/althas-chronicle-calendar-design.md in
the campaign's Ontos folder): validates date headings and the current-date
frontmatter in the ONTOS SOURCE, so a typo'd date surfaces at publish time
instead of as a silently-unmarked day on the published grid. Reports only,
exits 1 on any finding, no --fix: a malformed date is an authoring decision.
The heading regexes here must stay textually equivalent to the ones in
quartz/components/scripts/chronicle.inline.ts (the normalized-event seam).
"""
import importlib.util
import re
import sys
from pathlib import Path

_spec = importlib.util.spec_from_file_location(
    "sync_from_ontos", Path(__file__).resolve().parent / "sync-from-ontos.py"
)
_sync = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_sync)

# The ten canon month names, in order (the campaign's setting/calendar.md).
# Headings name the month ("Day 12 of Adventus, 366 VR"); the ordinal
# "of the Ninth Month" form was retired 2026-09-26.
MONTHS = "Vigilia|Sacratio|Oblatio|Certamen|Passio|Requiem|Paenitentia|Gratia|Adventus|Vesper"
MONTH_HEADING_RE = re.compile(
    rf"^## Day ([1-9]|[12][0-9]|3[0-3]) of ({MONTHS}), ([0-9]+) VR$"
)
HOLIDAY_HEADING_RE = re.compile(r"^## Day ([1-3]) of the Closing Holidays, ([0-9]+) VR$")
# Any h2 that *looks like* a date attempt must parse; other h2s are fine.
DATEISH_RE = re.compile(r"^##\s*day\b", re.IGNORECASE)
CURRENT_DATE_OK_RE = re.compile(r'^current-date:\s*"[0-9]+-(0[1-9]|10|H)-(0[1-9]|[12][0-9]|3[0-3])"\s*$', re.MULTILINE)
CURRENT_DATE_ANY_RE = re.compile(r"^current-date:", re.MULTILINE)

def check_headings(body):
    findings = []
    for line in body.splitlines():
        if not DATEISH_RE.match(line):
            continue
        if MONTH_HEADING_RE.match(line) or HOLIDAY_HEADING_RE.match(line):
            continue
        findings.append(f"unparseable date heading: {line!r}")
    return findings

def check_current_date(frontmatter_text):
    if not CURRENT_DATE_ANY_RE.search(frontmatter_text or ""):
        return ["current-date missing from frontmatter"]
    m = CURRENT_DATE_OK_RE.search(frontmatter_text)
    if not m:
        return ["current-date malformed (want zero-padded VR-MM-DD, months 01-10 or H)"]
    if m.group(1) == "H" and m.group(2) not in ("01", "02", "03"):
        return [f"current-date holiday day out of range: {m.group(2)}"]
    return []

def main():
    src = _sync.ONTOS_SETTING / "chronicle.md"
    if not src.exists():
        print("check-chronicle: setting/chronicle.md not found in Ontos source")
        return 1
    fm, body = _sync.split_frontmatter(src.read_text())
    findings = check_current_date(fm) + check_headings(body)
    if findings:
        print(f"check-chronicle: {len(findings)} finding(s):")
        for f in findings:
            print(f"  - {f}")
        return 1
    print("check-chronicle: OK")
    return 0

if __name__ == "__main__":
    sys.exit(main())
