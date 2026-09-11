import { QuartzTransformerPlugin } from "../types"
import { Root, RootContent, Heading } from "mdast"
import { toString } from "mdast-util-to-string"
import { VFile } from "vfile"

// Extracts the per-nation "Organizations" register from the merged
// setting/diplomacy page into structured card data on file.data.orgCards, and
// removes those source nodes so they render as faction cards (OrgCards.tsx),
// not as raw bullet lists too. Design: the campaign's
// specs/althas-org-cards-diplomacy-merge-design.md in Ontos.
//
// Runs BEFORE ObsidianFlavoredMarkdown, so [[wikilinks]] are still literal
// text here: we keep the raw target slug (for crest lookup and relationship
// links) and let OrgCards.tsx resolve them the same way Infobox does. It runs
// over the SYNCED content, where [!gm-only]/[!gm-notes] blocks are already
// stripped by sync-from-ontos.py, so no secret faction can ever reach a card
// (rule 29 firewall).

export interface OrgRelationship {
  display: string // raw display text, may contain a [[wikilink]]
  target: string | null // wikilink target basename of the ally/nemesis page, or null
  score: number // -3..+3
}

export interface OrgCard {
  name: string // raw, may contain a [[wikilink]] plus plain text
  crestTarget: string | null // page basename to resolve the crest image from
  tier: number
  tierNote: string // parenthetical after the tier, e.g. "ruling", "labor underclass"
  blurb: string // one-line public teaser; full detail lives on the org's own page
  assets: string // GM-register detail, retained but not rendered when a blurb is set
  problems: string
  relationships: OrgRelationship[]
  objective: string // "" when it is a pending-design placeholder (reserved slot)
}

export interface OrgNationGroup {
  nation: string
  cards: OrgCard[]
}

export interface OrgCardsData {
  intro: string
  nations: OrgNationGroup[]
}

declare module "vfile" {
  interface DataMap {
    orgCards: OrgCardsData
  }
}

const WIKILINK_RE = /\[\[([^\[\]|#]+)(?:#[^\[\]|]*)?(?:\|([^\[\]]+))?\]\]/

// Last path segment of a wikilink target, so "[[locations/voldaen]]" and
// "[[voldaen]]" both reduce to "voldaen" (matches NationIndex's targetBasename).
const targetBasename = (target: string): string => {
  const parts = target.trim().split("/")
  const last = parts.at(-1) ?? ""
  return last === "index" ? (parts.at(-2) ?? "") : last
}

// The org's own page, only when the name LEADS with a wikilink (so a leader
// named in a trailing parenthetical, a person, never becomes the card crest).
const leadingCrestTarget = (name: string): string | null => {
  const m = name.trimStart().match(/^\[\[([^\[\]|#]+)/)
  return m ? targetBasename(m[1]) : null
}

// "[[the-holy-see|Holy See]] +2" or "Council +1" -> {display, target, score}.
const parseRelationship = (token: string): OrgRelationship | null => {
  const scoreMatch = token.match(/([+-]\s?\d)/)
  if (!scoreMatch) return null
  const score = parseInt(scoreMatch[1].replace(/\s/, ""), 10)
  const display = token.slice(0, scoreMatch.index).trim().replace(/[,.]$/, "").trim()
  if (!display) return null
  const link = display.match(WIKILINK_RE)
  return { display, target: link ? targetBasename(link[1]) : null, score }
}

const parseRelationships = (value: string): OrgRelationship[] =>
  value
    .split(",")
    .map((t) => parseRelationship(t))
    .filter((r): r is OrgRelationship => r !== null)

// Value after the "**Field**:" label of a register bullet. The `**` are strong
// nodes by now, so toString() already dropped them: the item text reads
// "Assets: ..." / "Relationships (note): ...". Match the label, then the value
// after its first colon.
const fieldValue = (itemText: string, field: string): string | null => {
  const re = new RegExp(`^${field}\\b[^:]*:\\s*([\\s\\S]*)$`)
  const m = itemText.trim().match(re)
  return m ? m[1].trim() : null
}

const isHeading = (n: RootContent, depth: number): n is Heading =>
  n.type === "heading" && (n as Heading).depth === depth

const TIER_RE = /\(Tier\s+(\d+)([^)]*)\)/

export const OrgCardsBlocks: QuartzTransformerPlugin = () => ({
  name: "OrgCards",
  markdownPlugins() {
    return [
      () => (tree: Root, file: VFile) => {
        const children = tree.children
        const startIdx = children.findIndex(
          (n) => isHeading(n, 2) && toString(n).trim().toLowerCase() === "organizations",
        )
        if (startIdx === -1) return

        // The register runs from the "## Organizations" heading to the next H2.
        let endIdx = children.length
        for (let i = startIdx + 1; i < children.length; i++) {
          if (isHeading(children[i], 2)) {
            endIdx = i
            break
          }
        }

        const nations: OrgNationGroup[] = []
        let current: OrgNationGroup | null = null
        let intro = ""

        for (let i = startIdx + 1; i < endIdx; i++) {
          const node = children[i]
          if (isHeading(node, 3)) {
            current = { nation: toString(node).trim(), cards: [] }
            nations.push(current)
            continue
          }
          if (node.type === "paragraph") {
            const text = toString(node).trim()
            const tier = text.match(TIER_RE)
            if (tier && current) {
              const name = text.slice(0, tier.index).trim()
              const list = children[i + 1]
              let blurb = "",
                assets = "",
                problems = "",
                objective = ""
              let relationships: OrgRelationship[] = []
              if (list && list.type === "list") {
                for (const item of list.children) {
                  const it = toString(item).trim()
                  const bl = fieldValue(it, "Blurb")
                  const a = fieldValue(it, "Assets")
                  const p = fieldValue(it, "Problems")
                  const r = fieldValue(it, "Relationships")
                  const o = fieldValue(it, "Objective")
                  if (bl !== null) blurb = bl
                  else if (a !== null) assets = a
                  else if (p !== null) problems = p
                  else if (r !== null) relationships = parseRelationships(r)
                  else if (o !== null) objective = /pending design pass/i.test(o) ? "" : o
                }
                i++ // consume the field list
              }
              current.cards.push({
                name,
                crestTarget: leadingCrestTarget(name),
                tier: parseInt(tier[1], 10),
                tierNote: tier[2].replace(/^[,\s]+/, "").trim(),
                blurb,
                assets,
                problems,
                relationships,
                objective,
              })
              continue
            }
            // A non-tier paragraph before the first nation is the section intro.
            if (!current && !intro) intro = text
          }
        }

        if (nations.some((n) => n.cards.length > 0)) {
          file.data.orgCards = { intro, nations }
          // Remove the register source nodes so they don't also render as bullets.
          children.splice(startIdx, endIdx - startIdx)
        }
      },
    ]
  },
})
