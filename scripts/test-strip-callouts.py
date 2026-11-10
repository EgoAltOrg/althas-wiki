#!/usr/bin/env python3
"""
Unit tests for sync-from-ontos.py's GM-callout strip.

A nonblank line written without `>` directly under [!gm-only]/[!gm-notes]
content is a lazy continuation: Obsidian renders it inside the callout, so the
author reads it as GM-only, yet a strip that stops at the first `>`-less line
would publish it. The sync never guesses which one the author meant: it refuses
the whole run, naming the page and line, and writes nothing.

Pure fixtures in temp dirs; never reads the Ontos vault and never touches
content/. Run from the repo root:
    python3 scripts/test-strip-callouts.py
"""
import importlib.util
import io
import sys
from contextlib import redirect_stdout
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "sync_from_ontos", Path(__file__).resolve().parent / "sync-from-ontos.py"
)
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


def _refused(body):
    """The LazyGMContinuation strip_callouts raised for body, or None."""
    try:
        sync.strip_callouts(body)
    except sync.LazyGMContinuation as e:
        return e
    return None


# --- lazy continuations are refused -------------------------------------------


def test_english_prose_lazy_line_is_refused():
    e = _refused(
        "> [!gm-only] Note\n> A private planning paragraph.\n"
        "The body is beneath the chapel.\n\nPublic text.\n"
    )
    assert e is not None, "lazy GM continuation survived the strip"
    assert e.line == 3
    assert "chapel" in e.text


def test_portuguese_prose_lazy_line_is_refused():
    e = _refused(
        "> [!gm-only] Nota\n> Um parágrafo privado de preparação.\n"
        "O corpo está debaixo da capela.\n\nTexto público.\n"
    )
    assert e is not None, "lazy GM continuation survived the strip"
    assert e.line == 3
    assert "capela" in e.text


def test_gm_notes_lazy_line_is_refused():
    e = _refused("> [!gm-notes]\n> Reminder.\nThe heir is a changeling.\n")
    assert e is not None and e.line == 3


def test_lazy_line_straight_under_the_opener_is_refused():
    e = _refused("> [!gm-only] The truth\nThe heir is a changeling.\n")
    assert e is not None and e.line == 2


def test_lazy_line_after_a_chained_gm_callout_is_refused():
    e = _refused(
        "Intro.\n\n> [!gm-only] One\n> First.\n\n> [!gm-notes] Two\n> Second.\n"
        "Leaked third line.\n"
    )
    assert e is not None and e.line == 8


def test_lazy_image_embed_is_refused():
    e = _refused("> [!gm-only] Secret\n> text\n![[secret.jpg]]\n\nBody.\n")
    assert e is not None and e.line == 3


def test_lowercase_and_spacing_variants_are_refused():
    e = _refused(">[!GM-ONLY]\n>   text\nLeak.\n")
    assert e is not None and e.line == 3


# --- what must keep working ---------------------------------------------------


def test_blank_line_ends_the_callout_and_public_text_survives():
    out = sync.strip_callouts(
        "Before.\n\n> [!gm-only] Note\n> Secret.\n\nPublic after.\n"
    )
    assert "Secret" not in out
    assert "Public after." in out
    assert "Before." in out


def test_public_callout_right_after_gm_block_survives():
    out = sync.strip_callouts(
        "> [!gm-only] Note\n> Secret.\n> [!info] Attribution\n> CC-BY art.\n"
    )
    assert "Secret" not in out
    assert "> [!info] Attribution" in out and "CC-BY art." in out


def test_public_callout_lazy_line_is_not_touched():
    body = "> [!info] Public note\n> Shown.\nAlso shown.\n"
    assert sync.strip_callouts(body) == body.rstrip("\n")


def test_gm_block_at_end_of_body_is_stripped():
    out = sync.strip_callouts("Public.\n\n> [!gm-only] Note\n> Secret.")
    assert "Secret" not in out and "Public." in out


# --- the sync run refuses before writing --------------------------------------


def _run_main(root, sources):
    """Run main() over a throwaway campaign: sources maps a source filename to
    its text, each mapped to npcs/<name>. Returns (exit code, stdout, content)."""
    setting = root / "campaign" / "setting"
    content = root / "content"
    setting.mkdir(parents=True)
    content.mkdir()
    for name, text in sources.items():
        (setting / name).write_text(text)
    names = (
        "ONTOS_SETTING", "CONTENT_DIR", "PAGE_MAP", "TITLES", "RENAMES",
        "NOT_YET_PUBLIC", "CONTENT_ONLY", "PORTRAIT_DIR",
    )
    saved = {n: getattr(sync, n) for n in names}
    out = io.StringIO()
    try:
        sync.ONTOS_SETTING = setting
        sync.CONTENT_DIR = content
        sync.PAGE_MAP = {n: f"npcs/{n}" for n in sources}
        sync.TITLES = {n: n[:-3].title() for n in sources}
        sync.RENAMES = {}
        sync.NOT_YET_PUBLIC = set()
        sync.CONTENT_ONLY = set()
        sync.PORTRAIT_DIR = None
        with redirect_stdout(out):
            code = sync.main()
    finally:
        for n, v in saved.items():
            setattr(sync, n, v)
    return code, out.getvalue(), content


CLEAN = "---\ntitle: Ada\nkind: person\n---\n\nAda is public.\n"
LEAKY = (
    "---\ntitle: Thea\nkind: person\n---\n\nThea is public.\n\n"
    "> [!gm-only] Truth\n> Private.\nThea is the lost heir.\n"
)


def test_main_refuses_and_writes_nothing(tmp_path):
    # Sorted so the clean page comes first: a page-by-page run would already
    # have written it before reaching the leaky one.
    code, out, content = _run_main(tmp_path, {"ada.md": CLEAN, "thea.md": LEAKY})
    assert code == 1, "sync did not fail"
    assert not any(content.rglob("*.md")), "sync wrote pages despite the refusal"
    # Line 10 of the source file: 4 frontmatter lines, a blank, the public
    # line, a blank, the opener, the `>` line, then the lazy one.
    assert "thea.md:10" in out, out
    assert "Thea is the lost heir." in out


def test_main_names_every_offending_page(tmp_path):
    other = LEAKY.replace("Thea", "Bo")
    code, out, _ = _run_main(tmp_path, {"thea.md": LEAKY, "bo.md": other})
    assert code == 1
    assert "thea.md:10" in out and "bo.md:10" in out, out


def test_main_clean_run_still_writes(tmp_path):
    code, _, content = _run_main(tmp_path, {"ada.md": CLEAN})
    assert code == 0
    assert (content / "npcs" / "ada.md").exists()


def main():
    import inspect
    import shutil
    import tempfile

    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        if "tmp_path" in inspect.signature(t).parameters:
            tmp = Path(tempfile.mkdtemp(prefix="strip-callouts-test-"))
            try:
                t(tmp)
            finally:
                shutil.rmtree(tmp, ignore_errors=True)
        else:
            t()
        print(f"  PASS {t.__name__}")
    print(f"{len(tests)} test(s) passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
