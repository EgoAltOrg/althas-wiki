#!/usr/bin/env python3
"""
Sync the player-facing content/ folder from the GM's private Ontos wiki.

The GM's master wiki (in the Ontos vault, not this repo) is annotated with
two Obsidian callout types: [!gm-only] for in-world secrets not yet revealed
to players (unwrapped by hand as the campaign plays out), and [!gm-notes]
for permanent author-side content (real-world citations, planning notes)
that never reaches players.

This script reads each mapped source page, strips both callout types
entirely, trims frontmatter down to `title:` plus the whitelisted typed
infobox fields (see INFOBOX_KIND_FIELDS below; carrying forward any
existing `marker:` map-pin data, `submap:` local-map block, and `image:`
portrait filename already present in the destination file, since those are
presentation data with no equivalent in the GM's source),
drops the Sources/Last updated bookkeeping lines, and writes the result
into content/.

content/ is a generated build artifact from this point on: don't hand-edit
files this script writes, edit the Ontos source and re-run this script.
This is a mechanical strip, not a judgment call: always read `git diff
content/` yourself before publishing, the same way check-broken-links.py's
--fix mode never replaces a human read.

Each of the five nations (Armada, Polaris, Voldaen, Jesthaen, Hilltop) syncs
to its own folder's index.md directly, not to a same-named file alongside
it — a folder and a page inside it should never share a name. This relies
on a patched "shortest" link-resolution strategy in quartz/util/path.ts
that treats a folder's own index.md as satisfying a wikilink to that
folder's name, and a matching patch in check-broken-links.py's own
existing_targets(). If either patch is ever reverted, [[armada]] (and the
other four) will break across the whole site.
"""
import os
import re
import sys
from pathlib import Path

# Defaults to the GM's live vault; override via ONTOS_SETTING_DIR to sync from a
# branch worktree (used to preview restructuring work before it merges to main).
ONTOS_SETTING = Path(
    os.environ.get(
        "ONTOS_SETTING_DIR",
        str(Path.home() / "Desktop/Ontos/Projects/rpgs-and-gest/daggerheart/campaigns/ut-supra-sic-infra/setting"),
    )
)
CONTENT_DIR = Path(__file__).resolve().parent.parent / "content"

# Display title for each source page. Kept as an explicit table (not derived
# from the filename) so it always matches Lucas's own naming choices exactly.
TITLES = {
    "diplomacy.md": "Diplomacy",
    "calendar.md": "Calendar",
    "chronicle.md": "Chronicle",
    "timeline.md": "Timeline",
    "the-divine-age.md": "The Divine Age",
    "valerions-heresy.md": "Valerion's Heresy",
    "the-lodestar-pact.md": "The Lodestar Pact",
    "worldbuilding-checklist.md": "Worldbuilding Checklist",
    "parish-of-inquisition.md": "Parish of Inquisition",
    "parish-of-orthodoxy.md": "Parish of Orthodoxy",
    "amalthus-cruoris.md": "Amalthus Cruoris",
    "augustus-corvus.md": "Augustus Corvus",
    "codex-magic.md": "Codex Magic",
    "aetheris.md": "Aetheris",
    "elves.md": "Elves",
    "firbolg.md": "Firbolg",
    "giants.md": "Giants",
    "clanks.md": "Clanks",
    "infernis.md": "Infernis",
    "divine-relics.md": "Divine Relics",
    "miracles.md": "Miracles",
    "splendor-magic.md": "Splendor Magic",
    "the-holy-see.md": "The Holy See",
    "the-one-above.md": "The One Above",
    "the-ones-below.md": "The Ones Below",
    "the-ophanim.md": "The Ophanim",
    "armada.md": "Armada",
    "guild.md": "The Guild",
    "the-five-heroes.md": "The Five Heroes",
    "crater-lake.md": "Crater Lake",
    "draconis.md": "Draconis",
    "hilltop.md": "Hilltop",
    "andaluria.md": "Andaluria",
    "convent-of-saint-trefan.md": "Convent of Saint Trefan",
    "drinmery.md": "Drinmery",
    "jesthaen.md": "Jesthaen",
    "polaris.md": "Polaris",
    "voldaen.md": "Voldaen",
    "house-voldis.md": "House Voldis",
    "house-aquila.md": "House Aquila",
    "house-corvus.md": "House Corvus",
    "aldric-voldis.md": "Aldric Voldis",
    "edrion-voldis.md": "Edrion Voldis",
    "eltanin.md": "Eltanin",
    "guilmore-fleming.md": "Guilmore Fleming",
    "hesper-arcturus.md": "Hesper Arcturus",
    "izar-arcturus.md": "Izar Arcturus",
    "immanuel-greene.md": "Immanuel Greene",
    "jestha.md": "Jestha",
    "kingslayer.md": "The Kingslayer",
    "god-king-voldis.md": "Voldis",
    "valerion-voldis.md": "Valerion Voldis",
    "valeran-voldis.md": "Valeran Voldis",
    "castus-voldis.md": "Castus Voldis",
    "lael.md": "Lael",
    "lyra-aquila.md": "Lyra Aquila",
    "cassio-aquila.md": "Cassio Aquila",
    "thuban.md": "Thuban",
    "valis-voldis.md": "Valis Voldis",
    "valthis-voldis.md": "Valthis Voldis",
    "rastaban.md": "Rastaban",
    "rosestripe.md": "Rosestripe",
    "uriel-kenan.md": "Uriel Kenan",
    # 2026-08-27 Andaluria frame decisions
    "mateo-veyra.md": "Mateo Veyra",
    "ysabela-delamona.md": "Ysabela Delamoña",
    "the-council-of-six.md": "The Council of Six",
    # 2026-09-10/11 USSI character-Inbox + retcon additions (this publish)
    "sabara.md": "Sabara",
    "house-circinus.md": "House Circinus",
    "zalmir-aldarson.md": "Zalmir Aldarson",
    # 2026-08-27 Witherwild continent
    "witherwild-continent.md": "The Witherwild",
    "haven.md": "Haven",
    "godless-gate.md": "The Godless Gate",
    "the-witherwatch.md": "The Witherwatch",
    # 2026-08-27 Weredragon lift
    "drakona.md": "Drakona",
    # 2026-08-26 Novak Azimuth ingest (public pages)
    "house-azimuth.md": "House Azimuth",
    "house-olnir.md": "House Olnir",
    "agathia-azimuth.md": "Agathia Azimuth",
    "cornelia-azimuth.md": "Cornelia Azimuth",
    "hestia-azimuth.md": "Hestia Azimuth",
    "victerius-azimuth.md": "Victerius Azimuth",
    "zhenya-azimuth.md": "Zhenya Azimuth",
    "lorkhan-olnir.md": "Lorkhan Olnir",
    # The hidden-identity fourth PC: name-free public title (source file is
    # novak-pc-stub.md, but its slug/title must never carry "novak").
    "novak-pc-stub.md": "???",
    "index.md": "Althas",
}

# source filename (in Ontos setting/) -> destination path (relative to content/)
PAGE_MAP = {
    # Type-based folders (2026-07-16 Explorer/categories reorg, see the
    # campaign's specs/althas-explorer-categories-design.md in Ontos):
    # folders answer "what is this" (setting/ = world & concepts,
    # organizations/, magic/, beings/, ancestries/, locations/ purely
    # geographic), metadata answers "whose is this" (the generated
    # per-nation sections, quartz/components/NationIndex.tsx). Every page
    # moved in that reorg has a RENAMES entry below so its old URL keeps
    # redirecting.
    "diplomacy.md": "setting/diplomacy.md",
    # organizations.md merged into diplomacy.md on 2026-09-10 (the org-cards +
    # diplomacy merge): the register now renders as per-nation faction cards on
    # setting/diplomacy (quartz/components/OrgCards.tsx + the orgcards
    # transformer). The old standalone /setting/organizations URL redirects via
    # RENAMES below. Kept in the Ontos source only as a redirect stub, so it is
    # deliberately out of PAGE_MAP (a visible decision, not a silent gap).
    "calendar.md": "setting/calendar.md",
    "chronicle.md": "setting/chronicle.md",
    "timeline.md": "setting/timeline.md",
    # Lore/event pages live in their own events/ section, kept apart from the
    # mechanical setting/ pages above (calendar, chronicle, diplomacy,
    # organizations, timeline). Reorg 2026-08-22 at Lucas's request; the old
    # setting/ URLs keep redirecting via RENAMES below.
    "the-divine-age.md": "events/the-divine-age.md",
    "valerions-heresy.md": "events/valerions-heresy.md",
    "the-lodestar-pact.md": "events/the-lodestar-pact.md",
    "worldbuilding-checklist.md": "worldbuilding-checklist.md",
    "parish-of-inquisition.md": "organizations/parish-of-inquisition.md",
    "parish-of-orthodoxy.md": "organizations/parish-of-orthodoxy.md",
    "amalthus-cruoris.md": "npcs/amalthus-cruoris.md",
    "the-holy-see.md": "organizations/the-holy-see.md",
    "guild.md": "organizations/guild.md",
    "house-voldis.md": "organizations/house-voldis.md",
    "house-aquila.md": "organizations/house-aquila.md",
    "house-corvus.md": "organizations/house-corvus.md",
    "the-five-heroes.md": "organizations/the-five-heroes.md",
    "codex-magic.md": "magic/codex-magic.md",
    "divine-relics.md": "magic/divine-relics.md",
    "miracles.md": "magic/miracles.md",
    "splendor-magic.md": "magic/splendor-magic.md",
    "the-one-above.md": "beings/the-one-above.md",
    "the-ones-below.md": "beings/the-ones-below.md",
    "the-ophanim.md": "beings/the-ophanim.md",
    "aetheris.md": "ancestries/aetheris.md",
    "elves.md": "ancestries/elves.md",
    "firbolg.md": "ancestries/firbolg.md",
    "giants.md": "ancestries/giants.md",
    "clanks.md": "ancestries/clanks.md",
    "infernis.md": "ancestries/infernis.md",
    # The five nations (Armada, Polaris, Voldaen, Jesthaen, Hilltop) are each
    # a folder whose own index.md IS the nation's page, not a separate file
    # alongside it — [[armada]] resolves to a folder's index.md exactly the
    # same way it resolves to a same-named file, via the patched "shortest"
    # link-resolution strategy in quartz/util/path.ts. This avoids ever
    # having a folder and a page inside it share the same name.
    "armada.md": "locations/armada/index.md",
    "hilltop.md": "locations/hilltop/index.md",
    "crater-lake.md": "locations/hilltop/crater-lake.md",
    "andaluria.md": "locations/hilltop/andaluria.md",
    "convent-of-saint-trefan.md": "locations/jesthaen/convent-of-saint-trefan.md",
    "drinmery.md": "locations/jesthaen/drinmery.md",
    "jesthaen.md": "locations/jesthaen/index.md",
    "polaris.md": "locations/polaris/index.md",
    "voldaen.md": "locations/voldaen/index.md",
    "aldric-voldis.md": "npcs/aldric-voldis.md",
    "edrion-voldis.md": "npcs/edrion-voldis.md",
    "augustus-corvus.md": "npcs/augustus-corvus.md",
    # 2026-07-18: the Ontos source files became hesper-arcturus.md / izar-arcturus.md
    # (House Arcturus canon). First renamed to hesper_arcturus/izar_arcturus via Cowork,
    # then to kebab-case the same day to satisfy the vault's kebab-case audit. The
    # setting/ wikilinks all became [[hesper-arcturus]]/[[izar-arcturus]] to match, so
    # the published slug follows suit and every prior URL (/npcs/hesper, /npcs/izar,
    # /npcs/hesper_arcturus, /npcs/izar_arcturus) keeps redirecting via RENAMES below.
    "hesper-arcturus.md": "npcs/hesper-arcturus.md",
    "izar-arcturus.md": "npcs/izar-arcturus.md",
    "jestha.md": "npcs/jestha.md",
    "kingslayer.md": "npcs/kingslayer.md",
    "lael.md": "npcs/lael.md",
    "lyra-aquila.md": "npcs/lyra-aquila.md",
    "cassio-aquila.md": "npcs/cassio-aquila.md",
    "god-king-voldis.md": "npcs/god-king-voldis.md",
    "valerion-voldis.md": "npcs/valerion-voldis.md",
    "valeran-voldis.md": "npcs/valeran-voldis.md",
    "castus-voldis.md": "npcs/castus-voldis.md",
    "valis-voldis.md": "npcs/valis-voldis.md",
    "valthis-voldis.md": "npcs/valthis-voldis.md",
    "rastaban.md": "player-characters/rastaban.md",
    "rosestripe.md": "player-characters/rosestripe.md",
    "uriel-kenan.md": "player-characters/uriel-kenan.md",
    # 2026-08-27 Andaluria frame decisions: the public Archbishop of Andaluria
    # (his vampirism / cult leadership is gm-only on the page).
    "mateo-veyra.md": "npcs/mateo-veyra.md",
    # The Condesa and Andaluria's reconstruction government: public figures the
    # region openly knows (Delamoña's patronage, the Council's offices). Their
    # true natures (Ysabela the vampire progenitor, the Council the Fallen
    # Houses) stay gm-only on the pages.
    "ysabela-delamona.md": "npcs/ysabela-delamona.md",
    "the-council-of-six.md": "organizations/the-council-of-six.md",
    # 2026-09-10/11 USSI additions (this publish): Sabara (public Cartography
    # cleric, seated as the Council of Six's Surveyor), House Circinus (her
    # Geosensus oldblood house), and the new PC Zalmir. Alcota and Valkas are
    # fully gm-only, so they go to NOT_YET_PUBLIC below, not here.
    "sabara.md": "npcs/sabara.md",
    "house-circinus.md": "organizations/house-circinus.md",
    "zalmir-aldarson.md": "player-characters/zalmir-aldarson.md",
    # 2026-08-27 Witherwild continent. The Witherwild is a second landmass, its
    # own locations/ folder mirroring the five nations' folder-is-the-page
    # pattern (locations/witherwild/index.md IS the continent page). Its places
    # sit under it; the Faunus/Nikta/Reaping-Eye cosmology stays gm-only.
    "witherwild-continent.md": "locations/witherwild-continent/index.md",
    "haven.md": "locations/witherwild-continent/haven.md",
    "godless-gate.md": "locations/witherwild-continent/godless-gate.md",
    # The frontier order that garrisons the Gate (a military order, so it lives
    # with the other organizations).
    "the-witherwatch.md": "organizations/the-witherwatch.md",
    # 2026-08-27 Weredragon lift: the dragon-blooded ancestry (the Weredragon /
    # Pride / unbinding truth is gm-only on the page).
    "drakona.md": "ancestries/drakona.md",
    # 2026-08-26 Novak Azimuth ingest. Two Voldaen Great Houses and the Azimuth
    # family; the houses' secrets (Parashiel's true nature, the Famesfeast
    # cannibalism) and Novak's own designs stay gm-only. House members follow
    # the npcs/ convention used for the Voldis and Corvus families.
    "house-azimuth.md": "organizations/house-azimuth.md",
    "house-olnir.md": "organizations/house-olnir.md",
    "agathia-azimuth.md": "npcs/agathia-azimuth.md",
    "cornelia-azimuth.md": "npcs/cornelia-azimuth.md",
    "hestia-azimuth.md": "npcs/hestia-azimuth.md",
    "victerius-azimuth.md": "npcs/victerius-azimuth.md",
    "zhenya-azimuth.md": "npcs/zhenya-azimuth.md",
    "lorkhan-olnir.md": "npcs/lorkhan-olnir.md",
    # The hidden-identity fourth PC. Source is novak-pc-stub.md, but the public
    # slug is name-free (never "novak"): the page and its assets deliberately
    # carry no identifying name. The novak-azimuth dossier stays off the map.
    "novak-pc-stub.md": "player-characters/highborne-warrior.md",
    "index.md": "index.md",
}

# Old URL -> forever-redirect table. A page that has ever moved keeps every
# path it has ever lived at as a Quartz `aliases:` frontmatter entry (written
# by render() below on every sync, so re-syncs preserve the redirects
# forever). Each alias is a root-relative slug (no leading slash, no .md):
# quartz/plugins/transformers/frontmatter.ts slugifies it as-is and the
# AliasRedirects emitter then writes a redirect stub at that exact old URL.
# Keyed by CURRENT destination (the PAGE_MAP value); values are the old
# destination slugs. If a page moves again, append the newly-old slug here,
# never remove one: players' bookmarks don't expire.
#
# NOTE: frontmatter.ts deliberately does NOT feed these alias slugs into
# wikilink resolution (allSlugs). An alias by construction shares its
# basename with the real page, so counting it would make every [[basename]]
# link ambiguous under the "shortest" strategy and break site-wide. See the
# comment in quartz/plugins/transformers/frontmatter.ts.
RENAMES = {
    # 2026-09-10 org-cards + diplomacy merge: organizations.md folded into the
    # Diplomacy page (register now renders as faction cards there). Keep the old
    # standalone URL redirecting so player bookmarks survive.
    "setting/diplomacy.md": ["setting/organizations"],
    # 2026-09-10 Council of Five -> Council of Six retcon (the morally-grey
    # reconstruction government). Keep the old published URL redirecting, and let
    # carry_forward_source pull the old page's image:/marker: across the rename.
    "organizations/the-council-of-six.md": ["organizations/the-council-of-five"],
    # 2026-07-18 House Arcturus rename: hesper.md/izar.md -> hesper_arcturus/izar_arcturus
    # (Cowork) -> hesper-arcturus/izar-arcturus (kebab-case, same day). The destination
    # slug moved with each step; keep every prior published URL redirecting.
    "npcs/hesper-arcturus.md": ["npcs/hesper", "npcs/hesper_arcturus"],
    "npcs/izar-arcturus.md": ["npcs/izar", "npcs/izar_arcturus"],
    # 2026-08-13 House Aquila: lyra.md/cassio.md -> lyra-aquila/cassio-aquila
    # (firstname-house, per the Arcturus precedent). Keep old URLs redirecting.
    "npcs/lyra-aquila.md": ["npcs/lyra"],
    "npcs/cassio-aquila.md": ["npcs/cassio"],
    # 2026-08-17 Voldis dynasty naming + war renames. Old public URLs keep
    # redirecting, and carry_forward_source uses these to preserve each page's
    # content-side image:/marker: block across the rename.
    "npcs/god-king-voldis.md": ["npcs/the-god-king"],
    "npcs/valerion-voldis.md": ["npcs/the-mad-king"],
    "npcs/valeran-voldis.md": ["npcs/the-blessed-king"],
    # 2026-08-22 events/ reorg: the three lore/event pages moved out of
    # setting/ into their own events/ section. Old slugs listed oldest-first
    # (the newly-old setting/ slug appended last), so carry_forward_source
    # reads the just-superseded content/setting/ file for image:/marker: data.
    "events/valerions-heresy.md": ["setting/the-mad-kings-war", "setting/valerions-heresy"],
    "events/the-lodestar-pact.md": ["setting/the-polaris-secession", "setting/the-lodestar-pact"],
    "events/the-divine-age.md": ["setting/the-divine-age"],
    # 2026-07-17 landing-page merge: the standalone overview at /setting/althas
    # was folded into the home page (index.md). Keep that old URL redirecting to
    # home so player bookmarks survive. All [[althas]] wikilinks in the source
    # were repointed to [[index]] at the same time.
    "index.md": ["setting/althas"],
    # 2026-07-18 moved the Worldbuilding Checklist to the content root (top-level
    # quick access with map/changelog/dice-roller), out of the setting/ folder.
    "worldbuilding-checklist.md": ["setting/worldbuilding-checklist"],
    # 2026-07-16 Explorer/categories reorg
    "locations/hilltop/crater-lake.md": ["locations/crater-lake"],
    "organizations/house-voldis.md": ["locations/voldaen/house-voldis"],
    "organizations/guild.md": ["locations/armada/guild"],
    "organizations/the-holy-see.md": ["setting/the-holy-see"],
    "organizations/parish-of-inquisition.md": ["organizations/canton-of-inquisition", "setting/canton-of-inquisition"],
    "magic/miracles.md": ["setting/miracles"],
    "magic/codex-magic.md": ["setting/codex-magic"],
    "magic/splendor-magic.md": ["setting/splendor-magic"],
    "magic/divine-relics.md": ["setting/divine-relics"],
    "beings/the-one-above.md": ["setting/the-one-above"],
    "beings/the-ones-below.md": ["setting/the-ones-below"],
    "beings/the-ophanim.md": ["setting/the-ophanim"],
    # 2026-08-19 faeries ancestry reframed and renamed to aetheris (the
    # church-bound "angels"); a new elves ancestry split off separately. Keep
    # the old /faeries URLs redirecting to aetheris.
    "ancestries/aetheris.md": ["ancestries/faeries", "setting/faeries"],
    "ancestries/giants.md": ["setting/giants"],
    "ancestries/clanks.md": ["setting/clanks"],
    "ancestries/infernis.md": ["setting/infernis"],
}

# Pages that exist in Ontos but produce no public page: everything on them is
# wrapped [!gm-only] (an in-world secret not yet revealed in play) or [!gm-notes]
# (author notes), so nothing survives the strip. They are deliberately left out
# of PAGE_MAP above. Listed here so a skip is a visible decision, not a silent
# gap. To publish one, unwrap its [!gm-only] material in the Ontos source and add
# it back to PAGE_MAP + TITLES.
#
# 2026-07-16: the former NOT_YET_SHARED list (pages held back despite having
# public-ready content) was retired at Lucas's request. Those pages' content was
# wrapped [!gm-only] instead, so "is this page public?" is now answered purely by
# its tags, one mechanism, not two. The giants (Draconis / Eltanin / Thuban), the
# Drinmery nobles (Guilmore Fleming / Immanuel Greene), Izar, and the Hilltop
# night zone joined this list as a result.
NOT_YET_PUBLIC = {
    "the-threnodies.md",
    "the-threnodites.md",
    "sage-magic.md",
    "ophanim-heresies.md",
    "the-seven.md",
    "heresies.md",
    "oldblood.md",
    "draconis.md",
    "eltanin.md",
    "thuban.md",
    "guilmore-fleming.md",
    "immanuel-greene.md",
    "castorius-voldis.md",
    "the-stargazers.md",
    "sombral-spade.md",
    # 2026-08-27 Witherwild: the cosmology and its keystone secrets. Everything
    # on these is [!gm-only] (the Faunus, the Old Magic Observer, the Reaping
    # Eye theft), so nothing survives the strip. Public Witherwild surface is
    # only witherwild-continent/haven/godless-gate/the-witherwatch above.
    "nikta.md",
    "reaping-eye.md",
    "the-observers.md",
    # phylax is a decision-capture stub for a future dedicated Phylax/Witherwild
    # session: its whole body is frame-canon notes and gm-only/gm-notes material,
    # nothing public-ready. Listed here so its absence from PAGE_MAP is a visible
    # decision, not a silent gap.
    "phylax.md",
    # 2026-08-26 Novak Azimuth ingest, held back. novak-azimuth is the full GM
    # dossier for the PC (personality, designs on the crown); his public face
    # is the identity-blind PC stub, not this page. parashiel is the House
    # Azimuth Miracle's true nature (its public outline lives on miracles / the
    # house page). Both stay off the map entirely.
    "novak-azimuth.md",
    "parashiel.md",
    # 2026-09-10 USSI character-Inbox: both fully gm-only, nothing survives the
    # strip. Alcota (the Beast-of-Alcota town, not widely known in-world) and
    # Valkas (Zalmir's Witherwild Drakona mentor, all heritage gm-only).
    "alcota.md",
    "valkas.md",
}

# Pages that live in the Ontos setting/ folder but are DELIBERATELY never synced:
# their content/ counterparts are hand-maintained interactive pages (the dice
# roller, the Leaflet map, the Sealcarver sigil tool) whose embedded HTML/JS the
# sync would strip or mangle, so they are edited directly in content/ (the same
# rule-26 exception that content/changelog.md relies on). The setting/ copies are
# the GM's Obsidian-side reference. Listed here so "why isn't this page in
# PAGE_MAP?" is a visible decision, not a silent gap: these are already live via
# their own content/ files, not withheld like NOT_YET_PUBLIC.
CONTENT_ONLY = {
    "dice-roller.md",
    "map.md",
    "sealcarver.md",
}

# The public-fields contract for the typed-infobox pilot (see the campaign's
# specs/althas-article-templates-design.md in Ontos). These are the ONLY
# frontmatter keys, besides `title:` and the carried-forward `marker:` block,
# that are allowed to pass from the GM's source through to the published site.
# They pass VERBATIM (wikilink values stay raw; the frontend Infobox component
# parses them). A key not listed here cannot reach the site, so any future
# vault-side frontmatter field is private by default. Keys only pass for the
# page's own declared `kind:` (no kind, nothing passes): `date` on a non-event
# page, for example, is vault bookkeeping, not schema, and stays stripped.
# Kept in step with quartz/components/Infobox.tsx, scripts/check-infobox-fields.py,
# and the authoring reference (notes/article-templates.md in the campaign folder).
INFOBOX_KIND_FIELDS = {
    "person": ("role", "ancestry", "culture", "pronouns", "house", "nation", "allegiance", "born", "died"),
    "nation": ("capital", "ruler", "government", "founded"),
    "location": ("category", "nation", "region", "ruler", "population", "faith"),
    "organization": ("category", "leader", "seat", "region", "allegiance", "office", "heir", "words", "relic", "founded"),
    "magic-system": ("category", "source", "practitioners"),
    "being": ("nature", "domain", "fate"),
    "artifact": ("category", "origin", "wielder"),
    "event": ("category", "when", "place", "parties", "commanders", "strength", "casualties", "outcome", "part-of"),
    "ancestry": ("category", "homeland", "standing"),
}

CALLOUT_START_RE = re.compile(r"^>\s*\[!(gm-only|gm-notes)\]", re.IGNORECASE)
# Any callout opener, GM or public. Used to stop stripping at a *public* callout
# that follows a GM block, so it is never swallowed (e.g. a CC-BY attribution).
CALLOUT_ANY_START_RE = re.compile(r"^>\s*\[!", re.IGNORECASE)
HEADING_RE = re.compile(r"^#{1,6}\s")
FRONTMATTER_RE = re.compile(r"^---\n(.*?\n)---\n?", re.DOTALL)


def split_frontmatter(text):
    m = FRONTMATTER_RE.match(text)
    if not m:
        return "", text
    return m.group(1), text[m.end():]


def extract_frontmatter_block(frontmatter_text, key):
    """Capture a top-level frontmatter key plus all its indented continuation
    lines (including YAML comments inside the block), verbatim."""
    lines = frontmatter_text.splitlines()
    for idx, line in enumerate(lines):
        if line.startswith(f"{key}:"):
            block = [line]
            j = idx + 1
            while j < len(lines) and (lines[j][:1] in (" ", "\t") or lines[j].strip() == ""):
                block.append(lines[j])
                j += 1
            while block and block[-1].strip() == "":
                block.pop()
            return "\n".join(block)
    return None


def extract_marker_block(frontmatter_text):
    return extract_frontmatter_block(frontmatter_text, "marker")


def extract_submap_block(frontmatter_text):
    """A page's embedded local map (`submap:` block: image, caption, local
    pins) is presentation data with no equivalent in the GM's source, same
    category as `marker:` map-pin coordinates. Carry it forward from the
    existing destination file so re-syncs never wipe it."""
    return extract_frontmatter_block(frontmatter_text, "submap")


def extract_image_block(frontmatter_text):
    """A page's portrait filename (`image:` key, value = a bare asset filename
    resolving to content/assets/) is presentation data with no equivalent in
    the GM's source, same category as `marker:` and `submap:`. Carry it forward
    from the existing destination file so re-syncing text content never wipes
    it. The frontend Infobox component renders it at the top of the card."""
    return extract_frontmatter_block(frontmatter_text, "image")


CURRENT_DATE_RE = re.compile(r'^current-date:\s*"?([0-9]+-(?:0[1-9]|10|H)-[0-9]{2})"?\s*$', re.MULTILINE)


def extract_current_date(frontmatter_text):
    """Campaign-date passthrough for the Chronicle (specs/althas-chronicle-
    calendar-design.md): the manually-advanced current-date lives in the Ontos
    source frontmatter and must reach the published page's frontmatter, where
    ChronicleCalendar.tsx reads it. Format VR-MM-DD, zero-padded, H = holidays."""
    if not frontmatter_text:
        return None
    m = CURRENT_DATE_RE.search(frontmatter_text)
    return m.group(1) if m else None


def extract_infobox_fields(frontmatter_text):
    """Pull the typed infobox lines out of the GM's source frontmatter,
    verbatim. Only `kind:` plus the fields belonging to that declared kind
    pass; a page without a valid `kind:` passes nothing. Indented
    continuation lines (block-style YAML lists) travel with their key,
    mirroring extract_marker_block()."""
    lines = frontmatter_text.splitlines()
    kind = None
    for line in lines:
        m = re.match(r"""^kind:\s*["']?([a-z-]+)["']?\s*$""", line)
        if m:
            kind = m.group(1)
            break
    if kind not in INFOBOX_KIND_FIELDS:
        return []
    allowed = ("kind",) + INFOBOX_KIND_FIELDS[kind]
    out = []
    i, n = 0, len(lines)
    while i < n:
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_-]*):", lines[i])
        if m and m.group(1) in allowed:
            block = [lines[i]]
            j = i + 1
            while j < n and (lines[j][:1] in (" ", "\t") or lines[j].strip() == ""):
                block.append(lines[j])
                j += 1
            while block and block[-1].strip() == "":
                block.pop()
            out.extend(block)
            i = j
            continue
        i += 1
    return out


def strip_callouts(body):
    lines = body.splitlines()
    out = []
    i, n = 0, len(lines)
    while i < n:
        line = lines[i]
        if CALLOUT_START_RE.match(line):
            i += 1
            while i < n:
                # A new *public* callout ends the strip: it must survive (a GM
                # block must never swallow the public callout that follows it).
                if CALLOUT_ANY_START_RE.match(lines[i]) and not CALLOUT_START_RE.match(lines[i]):
                    break
                if lines[i].startswith(">"):
                    i += 1
                    continue
                if lines[i].strip() == "":
                    j = i
                    while j < n and lines[j].strip() == "":
                        j += 1
                    # Only chain across a blank gap to another GM callout; stop at
                    # a public callout or ordinary content so both survive.
                    if j < n and CALLOUT_START_RE.match(lines[j]):
                        i = j
                        continue
                break
            continue
        out.append(line)
        i += 1
    return "\n".join(out)


def strip_meta_lines(body):
    out = []
    for line in body.splitlines():
        s = line.strip()
        if s.startswith("**Sources**:") or s.startswith("**Last updated**:"):
            continue
        out.append(line)
    return "\n".join(out)


def drop_empty_headings(body):
    """Drop a heading whose entire subtree (down to the next heading of the
    same or higher level) has no surviving content. Subtree-aware: a section
    kept alive only by a non-empty subsection survives (a `## Beliefs` whose
    sole child is a `### The Sleepless Vigil` with prose), while a heading
    whose subsections are all empty after the gm-only strip is dropped along
    with them (a deep-secret character's `## Abilities` of only gm-only text)."""
    lines = body.splitlines()
    n = len(lines)
    levels = [0] * n
    for i, line in enumerate(lines):
        m = re.match(r"^(#{1,6})\s", line)
        if m:
            levels[i] = len(m.group(1))
    drop = [False] * n
    for i in range(n):
        level = levels[i]
        if not level:
            continue
        j = i + 1
        has_content = False
        while j < n and not (levels[j] and levels[j] <= level):
            if not levels[j]:
                s = lines[j].strip()
                if s and s != "---":
                    has_content = True
            j += 1
        if not has_content:
            drop[i] = True
    return "\n".join(line for i, line in enumerate(lines) if not drop[i])


def clean_blank_runs(text):
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip() + "\n"


IMAGE_EMBED_RE = re.compile(r"^!\[[^\]]*\]\([^)]+\)\s*$|^!\[\[[^\]|]+(\|[^\]]+)?\]\]\s*$")


def strip_leading_image(body):
    """Drop a standalone image embed if it's the first non-blank line of the
    Ontos body, and capture an italic caption line immediately following it.
    Returns (body_without_image_and_caption, caption_or_None).

    Portraits live in the GM's source page too (so Lucas's own vault renders
    them), but frontend art is managed separately here: the filename lives in
    the content-side `image:` frontmatter key (carried forward by
    extract_image_block) and the Infobox renders it, with the author's caption
    beneath it via the `image_caption:` key (this function's second return
    value, derived from the source each sync so Ontos stays authoritative for
    the caption text). Left in the body, the source embed would double up with
    the infobox portrait and the caption would render as loose article text
    instead of under the image. Only the leading image and its immediately
    following caption are touched; inline images elsewhere are untouched."""
    lines = body.splitlines()
    idx = 0
    while idx < len(lines) and lines[idx].strip() == "":
        idx += 1
    if idx >= len(lines) or not IMAGE_EMBED_RE.match(lines[idx]):
        return body, None
    drop = {idx}
    caption = None
    j = idx + 1
    while j < len(lines) and lines[j].strip() == "":
        j += 1
    if j < len(lines):
        cap = lines[j].strip()
        # A single-italic line (*...*): not bold (**...**), not a "* " bullet.
        if (
            len(cap) >= 2
            and cap.startswith("*")
            and cap.endswith("*")
            and not cap.startswith("**")
            and not cap.startswith("* ")
        ):
            caption = cap.strip("*").strip()
            drop.add(j)
    new_lines = [line for k, line in enumerate(lines) if k not in drop]
    return "\n".join(new_lines), caption


def render(
    title, marker_block, body, image_block=None, infobox_lines=None, submap_block=None,
    alias_slugs=None, image_caption=None, current_date=None,
):
    fm_lines = ["---", f"title: {title}"]
    if alias_slugs:
        fm_lines.append("aliases:")
        fm_lines.extend(f"  - {slug}" for slug in alias_slugs)
    if infobox_lines:
        fm_lines.extend(infobox_lines)
    if current_date:
        fm_lines.append(f'current-date: "{current_date}"')
    if image_block:
        fm_lines.append(image_block)
        if image_caption:
            fm_lines.append(f'image_caption: "{image_caption.replace(chr(34), chr(92) + chr(34))}"')
    if marker_block:
        fm_lines.append(marker_block)
    if submap_block:
        fm_lines.append(submap_block)
    fm_lines.append("---")
    return "\n".join(fm_lines) + "\n\n" + body


def carry_forward_source(dest, dest_rel):
    """Return the file to read carried-forward presentation blocks (`image:`,
    `marker:`, `submap:`) from, or None if there's nothing to carry.

    Normally that's the destination itself (the re-sync case). But those blocks
    live ONLY in content/, never in the Ontos source (rule 26), so a page
    *rename* would silently drop them: the new destination path has no prior
    file to carry from. In that case fall back to the most-recent prior
    destination recorded in RENAMES, whose content/ file still holds the data.
    RENAMES lists old slugs oldest-first (newly-old slugs are appended), so the
    most-recent prior destination is the last surviving entry; walk from newest
    to oldest and take the first that still exists on disk. Fixed 2026-07-18
    after the House Arcturus rename dropped both portraits twice."""
    if dest.exists():
        return dest
    for old_slug in reversed(RENAMES.get(dest_rel, [])):
        candidate = CONTENT_DIR / (old_slug + ".md")
        if candidate.exists():
            return candidate
    return None


def sync_page(src_name, dest_rel):
    src = ONTOS_SETTING / src_name
    text = src.read_text()
    src_fm, body = split_frontmatter(text)
    infobox_lines = extract_infobox_fields(src_fm)
    current_date = extract_current_date(src_fm)
    body = strip_callouts(body)
    body, image_caption = strip_leading_image(body)
    body = strip_meta_lines(body)
    body = drop_empty_headings(body)
    body = clean_blank_runs(body)

    dest = CONTENT_DIR / dest_rel
    marker_block = None
    submap_block = None
    image_block = None
    carry_src = carry_forward_source(dest, dest_rel)
    if carry_src is not None:
        existing_fm, _ = split_frontmatter(carry_src.read_text())
        marker_block = extract_marker_block(existing_fm)
        submap_block = extract_submap_block(existing_fm)
        image_block = extract_image_block(existing_fm)

    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(
        render(
            TITLES[src_name], marker_block, body, image_block, infobox_lines, submap_block,
            alias_slugs=RENAMES.get(dest_rel), image_caption=image_caption,
            current_date=current_date,
        )
    )
    return dest


def main():
    written = []
    for src_name, dest_rel in PAGE_MAP.items():
        dest = sync_page(src_name, dest_rel)
        written.append(dest)

    print(f"Synced {len(written)} page(s) from Ontos:")
    for w in sorted(str(d.relative_to(CONTENT_DIR)) for d in written):
        print(f"  {w}")

    print(f"\nNot public (everything on the page is GM-only; kept out of PAGE_MAP):")
    for name in sorted(NOT_YET_PUBLIC):
        print(f"  {name}")

    print(f"\nContent-only (hand-maintained in content/, not synced; already live):")
    for name in sorted(CONTENT_ONLY):
        print(f"  {name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
