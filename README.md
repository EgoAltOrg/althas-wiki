# Althas — Ut Supra Sic Infra Player Wiki

Public, spoiler-safe wiki and interactive map for the homebrew Daggerheart campaign _Ut Supra Sic Infra_, published with [Quartz v4](https://quartz.jzhao.xyz/).

Live at: https://egoaltorg.github.io/althas-wiki/

## How this repo works

`content/` is a **generated build artifact**, not hand-edited. The GM's actual wiki lives in a private Obsidian vault, annotated with two custom callout types:

- `[!gm-only]` — an in-world secret not yet revealed to players
- `[!gm-notes]` — permanent author-side content (real-world citations, planning notes) never shown to players

`scripts/sync-from-ontos.py` reads that source, strips both callout types, and writes the result here. Editing a file under `content/` directly is safe for presentation-only data (map marker coordinates, a page's portrait embed) which the sync preserves across re-syncs, but any lore text will be overwritten on the next run — edit the source vault instead.

## Publishing

1. `python3 scripts/sync-from-ontos.py`
2. `python3 scripts/check-broken-links.py --fix`
3. `npx quartz build` (verify locally before pushing)
4. `git add -A && git commit && git push` — deploys automatically via `.github/workflows/deploy.yml`

## Local dev

```
npm i
npx quartz build --serve
```

Built on [Quartz v4](https://github.com/jackyzha0/quartz) ([MIT licensed](LICENSE.txt)).
