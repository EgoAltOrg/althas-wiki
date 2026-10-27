# Althas: Ut Supra Sic Infra Player Wiki

Public, spoiler-safe wiki and interactive map for the homebrew Daggerheart campaign _Ut Supra Sic Infra_, published with [Quartz v4](https://quartz.jzhao.xyz/).

Live at: https://egoaltorg.github.io/althas-wiki/

## How this repo works

`content/` is a **generated build artifact**, not hand-edited. The GM's actual wiki lives in a private Obsidian vault, annotated with two custom callout types:

- `[!gm-only]`: an in-world secret not yet revealed to players
- `[!gm-notes]`: permanent author-side content (real-world citations, planning notes) never shown to players

`scripts/sync-from-ontos.py` reads that source, strips both callout types, and writes the result here. That script and the publish checks beside it come from the shared engine in [wiki-template](https://github.com/EgoAltOrg/wiki-template). This wiki's own settings (which pages publish and under what title, the checks' allowlists) and its two Althas-only checks stay in the private vault. The sync and the checks that need them read them from the folder that `WIKI_CONFIG_DIR` names.

Editing a file under `content/` directly is safe for presentation-only data (map marker coordinates, a page's portrait embed), which the sync preserves across re-syncs. Any lore text there is overwritten on the next run, so edit the source vault instead.

## Publishing

With `WIKI_CONFIG_DIR` set to the private config folder:

1. `python3 scripts/sync-from-ontos.py`
2. `python3 scripts/check-broken-links.py --fix`
3. The checks in `scripts/` (spoiler leaks, infobox fields, related-pages grounding, title casing, embedded assets), plus the chronicle and diplomacy-graph checks from the config folder
4. `npx quartz build`, and look over the result locally before pushing
5. Commit the changed files and push; `.github/workflows/deploy.yml` deploys the site

## Local dev

```
npm i
npx quartz build --serve
```

Built on [Quartz v4](https://github.com/jackyzha0/quartz) ([MIT licensed](LICENSE.txt)).
