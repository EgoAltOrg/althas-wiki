#!/usr/bin/env python3
"""
Unit tests for sync-from-ontos.py's wikilink rewrite. A bilingual wiki links its
sibling pages by the local `.en` / `.pt` source basename so the link resolves in
Obsidian, and the sync rewrites that to the published slug on the way into
content/. A monolingual wiki (source basename == slug) must pass through
byte-for-byte.

These tests are config-independent: they build synthetic PAGE_MAP / LINK_REWRITE
tables rather than reading this template's example config, so they assert the
ENGINE, not any particular wiki. Run from the repo root:
    python3 scripts/test-link-rewrite.py
"""
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "sync_from_ontos", Path(__file__).resolve().parent / "sync-from-ontos.py"
)
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)

passed = 0
failed = 0


def check(name, got, want):
    global passed, failed
    if got == want:
        passed += 1
        print(f"  PASS {name}")
    else:
        failed += 1
        print(f"  FAIL {name}\n    got:  {got!r}\n    want: {want!r}")


# --- build_link_table: derives non-identity pairs, drops identities ---------
sync.PAGE_MAP = {
    "index.en.md": "index.md",
    "index.pt.md": "pt/index.md",
    "gazetteer.en.md": "gazetteer.md",
    "marrogate.en.md": "gazetteer/marrogate.md",
    "voldaen.md": "voldaen.md",          # monolingual-style identity pair
}
sync.LINK_REWRITE = {"map.en": "map", "map.pt": "pt/map"}
table = sync.build_link_table()

check("derives_en_slug", table.get("gazetteer.en"), "gazetteer")
check("derives_pt_slug", table.get("index.pt"), "pt/index")
check("derives_nested_slug", table.get("marrogate.en"), "gazetteer/marrogate")
check("adds_content_only_stub", table.get("map.en"), "map")
check("drops_identity_pair", "voldaen" in table, False)

# --- rewrite_wikilinks: preserves alias + anchor, skips embeds/unknowns -----
check("aliased", sync.rewrite_wikilinks("[[gazetteer.en|Gazetteer]]", table), "[[gazetteer|Gazetteer]]")
check("bare", sync.rewrite_wikilinks("[[index.pt]]", table), "[[pt/index]]")
check("stub", sync.rewrite_wikilinks("[[map.pt|O Mapa]]", table), "[[pt/map|O Mapa]]")
check(
    "anchor_preserved",
    sync.rewrite_wikilinks("[[gazetteer.en#Places|here]]", table),
    "[[gazetteer#Places|here]]",
)
check("embed_untouched", sync.rewrite_wikilinks("![[hero.webp]]", table), "![[hero.webp]]")
check("unknown_untouched", sync.rewrite_wikilinks("[[some-other|X]]", table), "[[some-other|X]]")

# --- monolingual guarantee: empty table is a pure no-op ---------------------
body = "The [[voldaen|Voldaen]] link and the [[map]] stub stay verbatim."
check("empty_table_is_noop", sync.rewrite_wikilinks(body, {}), body)

print(f"\n{passed} test(s) passed, {failed} failed.")
raise SystemExit(1 if failed else 0)
