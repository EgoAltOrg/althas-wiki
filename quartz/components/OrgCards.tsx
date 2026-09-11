import { JSX } from "preact"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { QuartzPluginData } from "../plugins/vfile"
import {
  FilePath,
  FullSlug,
  joinSegments,
  pathToRoot,
  slugifyFilePath,
  transformLink,
} from "../util/path"
import { classNames } from "../util/lang"
import type { OrgCardsData, OrgRelationship } from "../plugins/transformers/orgcards"
import style from "./styles/orgcards.scss"

// The faction-card half of the diplomacy/organizations merge (2026-09-10). Reads
// the register data the OrgCards transformer stashed on fileData.orgCards and
// renders per-nation grids of faction cards below the force graph: crest, tier,
// name, assets/problems, and the scored -3..+3 relationships (the same web the
// graph draws). Slug-gated to setting/diplomacy in quartz.layout.ts, so it
// appears nowhere else. Pure build-time server rendering, like NationIndex: no
// client script, so the Explorer sortFn __name serialization trap never applies.
//
// Crests resolve from allFiles the same way the Infobox reads a page's `image:`;
// wikilinks in names and relationships resolve exactly like the Infobox's own
// body-link resolution (transformLink, "shortest").

const WIKILINK_RE = /\[\[([^\[\]|#]+)(?:#[^\[\]|]*)?(?:\|([^\[\]]+))?\]\]/g

const targetExists = (target: string, allSlugs: FullSlug[]): boolean => {
  const canonical = slugifyFilePath((target.trim() + ".md") as FilePath)
  return allSlugs.some((slug) => {
    if (slug === canonical) return true
    const parts = slug.split("/")
    const fileName = parts.at(-1)
    if (fileName === "index" && parts.length >= 2) return canonical === parts.at(-2)
    return canonical === fileName
  })
}

// Render a raw string, turning any [[wikilink]] into a resolved <a> (dead links
// degrade to plain text), same as Infobox.renderString.
const renderString = (
  value: string,
  slug: FullSlug,
  allSlugs: FullSlug[],
): (string | JSX.Element)[] => {
  const parts: (string | JSX.Element)[] = []
  let last = 0
  for (const m of value.matchAll(WIKILINK_RE)) {
    if (m.index! > last) parts.push(value.slice(last, m.index))
    const target = m[1].trim()
    const display = (m[2] ?? m[1]).trim()
    if (targetExists(target, allSlugs)) {
      parts.push(
        <a href={transformLink(slug, target, { strategy: "shortest", allSlugs })} class="internal">
          {display}
        </a>,
      )
    } else {
      parts.push(display)
    }
    last = m.index! + m[0].length
  }
  if (last < value.length) parts.push(value.slice(last))
  return parts
}

// A relationship score -3..+3 -> a stance label and a scale class the stylesheet
// colours (allies green, nemeses red, the same hues as the graph edge types).
const stanceClass = (score: number): string => `rel-${score < 0 ? "neg" : "pos"}${Math.abs(score)}`
const scoreLabel = (score: number): string => (score > 0 ? `+${score}` : `${score}`)

const crestSrc = (
  target: string | null,
  slug: FullSlug,
  allFiles: QuartzPluginData[],
): string | undefined => {
  if (!target) return undefined
  const canonical = slugifyFilePath((target + ".md") as FilePath)
  const file = allFiles.find((f) => {
    if (!f.slug) return false
    const parts = f.slug.split("/")
    const fileName = parts.at(-1)
    if (fileName === "index" && parts.length >= 2) return canonical === parts.at(-2)
    return canonical === fileName || f.slug === canonical
  })
  const image = file?.frontmatter?.["image"]
  return typeof image === "string" ? joinSegments(pathToRoot(slug), "assets", image) : undefined
}

// Initials fallback for a crestless card: up to two words of the name, stripped
// of any wikilink syntax and a leading "The".
const crestInitials = (name: string): string =>
  name
    .replace(WIKILINK_RE, (_m, t, d) => (d ?? t) as string)
    .replace(/\(.*$/, "")
    .replace(/^the\s+/i, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("")

export default (() => {
  const OrgCards: QuartzComponent = ({ fileData, allFiles, ctx, displayClass }: QuartzComponentProps) => {
    const data = fileData.orgCards as OrgCardsData | undefined
    if (!data || !fileData.slug) return null
    const slug = fileData.slug
    const allSlugs = ctx.allSlugs

    return (
      <section class={classNames(displayClass, "org-cards")}>
        <h2>Organizations</h2>
        {data.intro && <p class="org-cards-intro">{renderString(data.intro, slug, allSlugs)}</p>}
        {data.nations.map((group) => (
          <div class="org-cards-nation">
            <h3>{group.nation}</h3>
            <div class="org-cards-grid">
              {group.cards.map((card) => {
                const crest = crestSrc(card.crestTarget, slug, allFiles)
                return (
                  <article class="org-card">
                    <header class="org-card-head">
                      <div class="org-card-crest">
                        {crest ? (
                          <img src={crest} alt="" loading="lazy" />
                        ) : (
                          <span class="org-card-crest-fallback" aria-hidden="true">
                            {crestInitials(card.name)}
                          </span>
                        )}
                      </div>
                      <div class="org-card-heading">
                        <span class="org-card-tier">Tier {card.tier}</span>
                        <span class="org-card-name">{renderString(card.name, slug, allSlugs)}</span>
                        {card.tierNote && <span class="org-card-tiernote">{card.tierNote}</span>}
                      </div>
                    </header>
                    {card.blurb ? (
                      <p class="org-card-blurb">{renderString(card.blurb, slug, allSlugs)}</p>
                    ) : (
                      (card.assets || card.problems) && (
                        <dl class="org-card-body">
                          {card.assets && (
                            <>
                              <dt>Assets</dt>
                              <dd>{renderString(card.assets, slug, allSlugs)}</dd>
                            </>
                          )}
                          {card.problems && (
                            <>
                              <dt>Problems</dt>
                              <dd>{renderString(card.problems, slug, allSlugs)}</dd>
                            </>
                          )}
                        </dl>
                      )
                    )}
                    {card.relationships.length > 0 && (
                      <ul class="org-card-rels">
                        {card.relationships.map((rel: OrgRelationship) => {
                          const label = (
                            <>
                              <span class="rel-name">{renderString(rel.display, slug, allSlugs)}</span>
                              <span class="rel-score">{scoreLabel(rel.score)}</span>
                            </>
                          )
                          return <li class={classNames(undefined, "org-card-rel", stanceClass(rel.score))}>{label}</li>
                        })}
                      </ul>
                    )}
                    {card.objective && (
                      <p class="org-card-objective">
                        <span class="org-card-objective-label">Objective</span>{" "}
                        {renderString(card.objective, slug, allSlugs)}
                      </p>
                    )}
                  </article>
                )
              })}
            </div>
          </div>
        ))}
      </section>
    )
  }

  OrgCards.css = style

  return OrgCards
}) satisfies QuartzComponentConstructor
