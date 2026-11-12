#!/usr/bin/env python3
"""
Tests for sync-from-ontos.py's dirty-destination refusal (debugger #42).

The sync rewrites every mapped content/ page unconditionally, so an
uncommitted edit already sitting in one of those pages would be destroyed
before publish-wiki's exact-path staging could leave it out. The sync must
refuse, naming the paths, and write nothing, unless --resync says the dirt is
this publish's own earlier sync output.

Each case runs the real sync in a throwaway git copy of scripts/ and
content/*.md (assets are skipped to keep it fast). Needs WIKI_CONFIG_DIR, as
the repo's test command sets. Run from the repo root:
    python3 scripts/test-sync-dirty-guard.py
"""
import importlib.util
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

spec = importlib.util.spec_from_file_location(
    "sync_from_ontos", REPO / "scripts" / "sync-from-ontos.py"
)
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)

# A mapped destination that already exists in content/.
TARGET = next(
    rel for rel in sync.PAGE_MAP.values() if (REPO / "content" / rel).is_file()
)
MARKER = "\nDIRTY-MARKER-42\n"


def git(cwd, *args):
    return subprocess.run(
        ["git", "-c", "user.name=t", "-c", "user.email=t@t", *args],
        cwd=cwd, check=True, capture_output=True, text=True,
    )


def make_copy():
    d = Path(tempfile.mkdtemp(prefix="sync-dirty-"))
    shutil.copytree(REPO / "scripts", d / "scripts",
                    ignore=shutil.ignore_patterns("__pycache__"))
    shutil.copytree(REPO / "content", d / "content",
                    ignore=shutil.ignore_patterns("assets"))
    (d / "content" / "assets").mkdir(exist_ok=True)
    git(d, "init", "-q")
    git(d, "add", "-A")
    git(d, "commit", "-qm", "base")
    return d


def run_sync(d, *args):
    return subprocess.run(
        [sys.executable, str(d / "scripts" / "sync-from-ontos.py"), *args],
        cwd=d, capture_output=True, text=True,
    )


def test_modified_destination_is_refused_and_kept():
    d = make_copy()
    try:
        page = d / "content" / TARGET
        page.write_text(page.read_text() + MARKER)
        before = page.read_bytes()
        r = run_sync(d)
        assert page.read_bytes() == before, "sync changed a dirty mapped page"
        status = git(d, "status", "--porcelain", "--untracked-files=all", "--", "content").stdout.splitlines()
        assert status == [f" M content/{TARGET}"], f"sync wrote other files:\n{status}"
        assert r.returncode != 0, "sync exited 0 despite refusing"
        assert f"content/{TARGET}" in r.stdout, f"refusal does not name the path:\n{r.stdout}"
        assert "Synced" not in r.stdout, "sync reported writing pages"
    finally:
        shutil.rmtree(d)


def test_staged_destination_is_refused():
    d = make_copy()
    try:
        page = d / "content" / TARGET
        page.write_text(page.read_text() + MARKER)
        git(d, "add", "--", f"content/{TARGET}")
        r = run_sync(d)
        assert MARKER.strip() in page.read_text(), "sync overwrote a staged mapped page"
        assert r.returncode != 0
    finally:
        shutil.rmtree(d)


def test_untracked_destination_is_refused():
    d = make_copy()
    try:
        page = d / "content" / TARGET
        text = page.read_text()
        git(d, "rm", "-q", "--cached", "--", f"content/{TARGET}")
        git(d, "commit", "-qm", "untrack")
        page.write_text(text + MARKER)
        r = run_sync(d)
        assert MARKER.strip() in page.read_text(), "sync overwrote an untracked mapped page"
        assert r.returncode != 0
    finally:
        shutil.rmtree(d)


def test_dirt_outside_mapped_pages_does_not_block():
    d = make_copy()
    try:
        (d / "content" / "changelog.md").write_text("hand edit\n")
        r = run_sync(d)
        assert "Synced" in r.stdout, f"sync refused over an unmapped file:\n{r.stdout}"
        assert (d / "content" / "changelog.md").read_text() == "hand edit\n"
    finally:
        shutil.rmtree(d)


def test_resync_overwrites_own_output():
    d = make_copy()
    try:
        page = d / "content" / TARGET
        page.write_text(page.read_text() + MARKER)
        r = run_sync(d, "--resync")
        assert "Synced" in r.stdout, f"--resync still refused:\n{r.stdout}"
        assert MARKER.strip() not in page.read_text()
    finally:
        shutil.rmtree(d)


def test_not_a_git_repo_is_refused():
    d = make_copy()
    try:
        shutil.rmtree(d / ".git")
        page = d / "content" / TARGET
        page.write_text(page.read_text() + MARKER)
        r = run_sync(d)
        assert MARKER.strip() in page.read_text(), "sync wrote without being able to check git"
        assert r.returncode != 0
        assert "git:" in r.stdout, f"refusal does not say why git failed:\n{r.stdout}"
    finally:
        shutil.rmtree(d)


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    failed = 0
    for t in tests:
        try:
            t()
            print(f"PASS {t.__name__}")
        except AssertionError as e:
            failed += 1
            print(f"FAIL {t.__name__}: {e}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    sys.exit(1 if failed else 0)
