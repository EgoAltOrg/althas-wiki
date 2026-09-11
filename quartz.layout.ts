import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  // NationIndex renders the generated "In this nation" section on nation
  // pages (kind: nation) and nothing anywhere else. It lives in the shared
  // afterBody because nation pages are folder index files, emitted by
  // FolderPage with defaultListPageLayout, not by ContentPage. Pure
  // build-time server rendering: no client script is emitted, so the
  // Explorer sortFn __name serialization trap does not apply to it.
  // DiceRoller renders only on the dice-roller utility page (slug check), so
  // the bundled dice library and its UI never appear on any lore page. Its
  // client script re-binds on the "nav" SPA event and cleans up after itself.
  afterBody: [
    Component.NationIndex(),
    // OrgCards renders the per-nation faction-card grids below the diplomacy
    // force graph, from register data the OrgCards transformer extracts into
    // fileData.orgCards. Slug-gated to setting/diplomacy so it appears nowhere
    // else. Pure build-time server rendering (like NationIndex): no client
    // script, so the Explorer sortFn __name serialization trap does not apply.
    Component.ConditionalRender({
      component: Component.OrgCards(),
      condition: (page) => page.fileData.slug === "setting/diplomacy",
    }),
    Component.ConditionalRender({
      component: Component.DiceRoller(),
      condition: (page) => page.fileData.slug === "dice-roller",
    }),
    Component.ConditionalRender({
      component: Component.Sealcarver(),
      condition: (page) => page.fileData.slug === "sealcarver",
    }),
  ],
  footer: Component.Footer({
    links: {
      GitHub: "https://github.com/jackyzha0/quartz",
      "Discord Community": "https://discord.gg/cRFFHYye7t",
    },
  }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.TagList(),
    // On mobile the right sidebar renders below the article, so the infobox
    // gets a mobile-only twin up here, right below the title block (same
    // MobileOnly/DesktopOnly pairing pattern as Spacer/TableOfContents).
    // Server-rendered only: no .toString()/new Function client script, so the
    // Explorer sortFn __name pitfall doesn't apply here.
    Component.MobileOnly(Component.Infobox()),
    // The diplomacy force graph replaces the Mermaid DAG on setting/diplomacy.
    // Mounted here in beforeBody, but diplomacy-graph.inline.ts relocates the
    // rendered SVG to sit exactly where the diplomacy-graph code block is in
    // the article flow, then hides that block. Slug-gated so it appears
    // nowhere else. Client script rebinds on the "nav" SPA event and stops the
    // simulation via window.addCleanup.
    Component.ConditionalRender({
      component: Component.DiplomacyGraph(),
      condition: (page) => page.fileData.slug === "setting/diplomacy",
    }),
    // ChronicleCalendar renders only on the Chronicle page (slug check): the
    // month-grid navigation layer over the page's own rendered date sections.
    // See the campaign's specs/althas-chronicle-calendar-design.md in Ontos.
    Component.ConditionalRender({
      component: Component.ChronicleCalendar(),
      condition: (page) => page.fileData.slug === "setting/chronicle",
    }),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
        { Component: Component.ReaderMode() },
      ],
    }),
    Component.Explorer({
      // Title-case the top-level folder labels so the Explorer reads
      // "Organizations", "NPCs", "Player Characters" instead of raw lowercase
      // slugs. Nation folders (Voldaen, etc.) already get their title from
      // their index.md and aren't in the map, so `?? node.displayName` leaves
      // them untouched. SAME __name trap as sortFn below: this fn is
      // .toString()'d into the browser, so NO named inner const/function. An
      // inline object literal is safe (keep-names only wraps named fn/class
      // expressions), so the lookup table is written inline deliberately.
      mapFn: (node) => {
        if (node.isFolder) {
          node.displayName =
            {
              organizations: "Organizations",
              magic: "Magic",
              beings: "Beings",
              ancestries: "Ancestries",
              locations: "Locations",
              npcs: "NPCs",
              "player-characters": "Player Characters",
              setting: "Setting",
              events: "Events",
            }[node.displayName] ?? node.displayName
        }
      },
      // Sort ignoring a leading "The " so "The Holy See" files under H, etc.
      // NOTE: this fn is .toString()'d and run through `new Function` in the
      // browser, so it must be fully self-contained AND must not create any
      // named inner function/const: esbuild's keep-names wraps those in a
      // `__name(...)` helper that does not exist client-side (undefined ->
      // the Explorer silently dies). Keep the "strip the leading The" logic
      // inlined for exactly that reason. Verify in a browser after editing.
      sortFn: (a, b) => {
        if ((!a.isFolder && !b.isFolder) || (a.isFolder && b.isFolder)) {
          return a.displayName
            .replace(/^the\s+/i, "")
            .localeCompare(b.displayName.replace(/^the\s+/i, ""), undefined, {
              numeric: true,
              sensitivity: "base",
            })
        }
        if (!a.isFolder && b.isFolder) {
          return 1
        } else {
          return -1
        }
      },
    }),
  ],
  right: [
    Component.DesktopOnly(Component.Infobox()),
    Component.Graph({
      // Hub/utility pages that otherwise dominate the force layout (the home
      // page "/" and the changelog carry a link to nearly everything; the
      // interactive tools and the checklist do not belong in the lore graph).
      localGraph: {
        removeSlugs: ["/", "changelog", "dice-roller", "map", "sealcarver", "worldbuilding-checklist"],
      },
      globalGraph: {
        removeSlugs: ["/", "changelog", "dice-roller", "map", "sealcarver", "worldbuilding-checklist"],
      },
    }),
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  // Nation pages are folder-index pages rendered with THIS list layout, not the
  // content layout, so the Infobox has to be mounted here too or a typed nation
  // index (kind: nation) never shows its infobox. The Infobox self-guards
  // (returns null unless the page has an `image:` or a valid `kind`), so a plain
  // tag/folder list page renders nothing. Same MobileOnly/DesktopOnly pairing as
  // defaultContentPageLayout.
  beforeBody: [
    Component.Breadcrumbs(),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.MobileOnly(Component.Infobox()),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
      ],
    }),
    Component.Explorer({
      // Title-case the top-level folder labels so the Explorer reads
      // "Organizations", "NPCs", "Player Characters" instead of raw lowercase
      // slugs. Nation folders (Voldaen, etc.) already get their title from
      // their index.md and aren't in the map, so `?? node.displayName` leaves
      // them untouched. SAME __name trap as sortFn below: this fn is
      // .toString()'d into the browser, so NO named inner const/function. An
      // inline object literal is safe (keep-names only wraps named fn/class
      // expressions), so the lookup table is written inline deliberately.
      mapFn: (node) => {
        if (node.isFolder) {
          node.displayName =
            {
              organizations: "Organizations",
              magic: "Magic",
              beings: "Beings",
              ancestries: "Ancestries",
              locations: "Locations",
              npcs: "NPCs",
              "player-characters": "Player Characters",
              setting: "Setting",
              events: "Events",
            }[node.displayName] ?? node.displayName
        }
      },
      // Sort ignoring a leading "The " so "The Holy See" files under H, etc.
      // NOTE: this fn is .toString()'d and run through `new Function` in the
      // browser, so it must be fully self-contained AND must not create any
      // named inner function/const: esbuild's keep-names wraps those in a
      // `__name(...)` helper that does not exist client-side (undefined ->
      // the Explorer silently dies). Keep the "strip the leading The" logic
      // inlined for exactly that reason. Verify in a browser after editing.
      sortFn: (a, b) => {
        if ((!a.isFolder && !b.isFolder) || (a.isFolder && b.isFolder)) {
          return a.displayName
            .replace(/^the\s+/i, "")
            .localeCompare(b.displayName.replace(/^the\s+/i, ""), undefined, {
              numeric: true,
              sensitivity: "base",
            })
        }
        if (!a.isFolder && b.isFolder) {
          return 1
        } else {
          return -1
        }
      },
    }),
  ],
  right: [Component.DesktopOnly(Component.Infobox())],
}
