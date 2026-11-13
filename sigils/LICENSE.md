# License and attribution for the sigil assets

Every SVG in this directory and its subdirectories originates from:

**Codex of Arcane Arts** (v1)
by **Roc Humet Vidal** (aka Ondo)
© 2026 Roc Humet Vidal

Licensed under the **Creative Commons Attribution 4.0 International License**
(CC-BY 4.0): https://creativecommons.org/licenses/by/4.0/

You are free to share and adapt this material, including for commercial
purposes, provided appropriate credit is given.

The supplement also builds on the Daggerheart System Reference Document 1.0,
© Critical Role, LLC, used under the Darrington Press Community Gaming License
(DPCGL). See https://www.daggerheart.com. Codex of Arcane Arts is an
independent product and is not official Darrington Press or Critical Role
material.

The supplement states that no generative AI was used in its creation.

## What this obliges us to do

CC-BY attribution is a **license condition, not a courtesy**. Any page on this
site that presents these sigils or the notation built from them has to carry a
visible credit to Roc Humet Vidal with a link to the license.

That credit currently lives in an `[!info]` callout on the published
`content/magic/codex-magic.md` page. It is authored in the Ontos source at
`Projects/rpgs-and-gest/daggerheart/campaigns/ut-supra-sic-infra/setting/codex-magic.md`
(never edited in `content/` directly, which the sync regenerates).

> **Keep that callout above any `[!gm-only]` or `[!gm-notes]` callout, or put a
> blank line between them.** `scripts/sync-from-ontos.py`'s `strip_callouts()`
> keeps a public callout that follows a GM block after a blank line. Written
> directly under the GM lines with no blank line, it is the same blockquote and
> Obsidian shows it inside the GM callout, so the sync refuses to run and names
> the page and line. An older sync deleted such a callout silently: that
> happened to this exact attribution on 2026-08-06, and no automated gate
> caught it, since `check-spoiler-leak.py` only looks for content that should be
> absent, never for content that must be present.

Any new page built from these assets (a Sealmaker tool page, for example) needs
its own visible attribution. It does not inherit the one on `codex-magic`.
