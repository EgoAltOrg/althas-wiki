import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { QuartzPluginData } from "../plugins/vfile"
import { FilePath, FullSlug, resolveRelative, slugifyFilePath } from "../util/path"
import { classNames } from "../util/lang"
import style from "./styles/nationIndex.scss"

// The World Anvil "Categories" half of the 2026-07-16 Explorer/categories
// reorg (see the campaign's specs/althas-explorer-categories-design.md in
// Ontos): every nation page (kind: nation) gains a build-time generated
// "In this nation" section listing each page whose typed frontmatter ties
// it to that nation, grouped by kind. Folders answer "what is this"
// (organizations/, magic/, ...), this section answers "whose is this".
//
// Attribution is discovery, not a hardcoded list: content declares via its
// whitelisted typed fields (the INFOBOX_KIND_FIELDS contract in
// scripts/sync-from-ontos.py), the build finds it here. A page is
// attributed to a nation when
//   - any of its whitelisted typed fields carries a wikilink whose target
//     is that nation's slug (so `seat: "[[voldaen|Voldaen]]"` files House
//     Voldis under Voldaen), or
//   - it lives inside that nation's own locations/ folder (so
//     locations/hilltop/crater-lake.md files under Hilltop).
// A page can appear under several nations when its fields say so; that is
// the point (an entity no longer needs one folder-home per nation).
//
// Entirely server-rendered at build time: no client JS, nothing here is
// .toString()'d into the page, so the Explorer sortFn __name pitfall does
// not apply (module-level arrow consts only, all the same).

// Typed frontmatter fields whose wikilink target can tie a page to a
// nation. Subset of the public-fields contract (INFOBOX_KIND_FIELDS in
// scripts/sync-from-ontos.py); `role:` and free-text fields deliberately
// don't count, only structured attribution does.
const ATTRIBUTION_FIELDS = [
  "nation",
  "seat",
  "house",
  "allegiance",
  "capital",
  "homeland",
  "practitioners",
] as const

// kind -> section heading, in render order. The four the spec names first,
// then the remaining kinds of the pilot schema so a future field-based
// attribution of, say, a magic system still renders somewhere sensible.
const GROUP_LABELS: [string, string][] = [
  ["organization", "Organizations"],
  ["person", "People"],
  ["location", "Places"],
  ["ancestry", "Ancestries"],
  ["magic-system", "Magic"],
  ["being", "Beings"],
  ["artifact", "Artifacts"],
  ["event", "Events"],
  ["nation", "Nations"],
]

// Frontmatter values are NOT processed by CrawlLinks, so a wikilink arrives
// as the raw string `[[target|Display]]` (same situation Infobox.tsx
// handles; same regex).
const WIKILINK_RE = /\[\[([^\[\]|#]+)(?:#[^\[\]|]*)?(?:\|([^\[\]]+))?\]\]/g

// Last path segment of a slugified wikilink target, so both "[[voldaen]]"
// and a path-qualified "[[locations/voldaen]]" compare against the nation's
// basename.
const targetBasename = (target: string): string => {
  const slug = slugifyFilePath((target.trim() + ".md") as FilePath)
  const parts = slug.split("/")
  const last = parts.at(-1)
  return (last === "index" ? parts.at(-2) : last) ?? ""
}

const fieldTargets = (value: unknown): string[] => {
  if (typeof value === "string") {
    return [...value.matchAll(WIKILINK_RE)].map((m) => targetBasename(m[1]))
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => fieldTargets(item))
  }
  return []
}

const isAttributed = (
  file: QuartzPluginData,
  nationBasename: string,
  nationFolder: string,
): boolean => {
  const fm = file.frontmatter as Record<string, unknown> | undefined
  if (!fm || !file.slug) {
    return false
  }
  // Containment: the nation's own locations/ folder holds this page.
  if (file.slug.startsWith(nationFolder + "/") && !file.slug.endsWith("/index")) {
    return true
  }
  // Declaration: a whitelisted typed field wikilinks to this nation.
  return ATTRIBUTION_FIELDS.some((field) => fieldTargets(fm[field]).includes(nationBasename))
}

// Sort like the Explorer does: ignore a leading "The " so The Guild files
// under G.
const sortKey = (file: QuartzPluginData): string =>
  (file.frontmatter?.title ?? file.slug ?? "").replace(/^the\s+/i, "")

export default (() => {
  const NationIndex: QuartzComponent = ({
    fileData,
    allFiles,
    displayClass,
  }: QuartzComponentProps) => {
    const kind = fileData.frontmatter?.["kind" as keyof typeof fileData.frontmatter]
    if (kind !== "nation" || !fileData.slug) {
      return null
    }
    // Nation pages are folder index files: locations/voldaen/index ->
    // folder locations/voldaen, basename voldaen (what wikilinks target).
    const parts = fileData.slug.split("/")
    if (parts.at(-1) !== "index" || parts.length < 2) {
      return null
    }
    const nationFolder = parts.slice(0, -1).join("/")
    const nationBasename = parts.at(-2)!

    const attributed = allFiles.filter(
      (file) => file.slug !== fileData.slug && isAttributed(file, nationBasename, nationFolder),
    )
    if (attributed.length === 0) {
      // A nation with nothing attributed gets no empty section.
      return null
    }

    const groups = GROUP_LABELS.map(([groupKind, label]) => {
      const pages = attributed
        .filter((file) => (file.frontmatter as Record<string, unknown>)?.["kind"] === groupKind)
        .sort((a, b) =>
          sortKey(a).localeCompare(sortKey(b), undefined, { numeric: true, sensitivity: "base" }),
        )
      return { label, pages }
    }).filter((group) => group.pages.length > 0)

    return (
      <section class={classNames(displayClass, "nation-index")}>
        <h2>In this nation</h2>
        {groups.map(({ label, pages }) => (
          <div class="nation-index-group">
            <h3>{label}</h3>
            <ul>
              {pages.map((page) => (
                <li>
                  <a
                    href={resolveRelative(fileData.slug!, page.slug! as FullSlug)}
                    class="internal"
                  >
                    {page.frontmatter?.title ?? page.slug}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    )
  }

  NationIndex.css = style

  return NationIndex
}) satisfies QuartzComponentConstructor
