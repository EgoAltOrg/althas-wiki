import {
  forceSimulation,
  forceManyBody,
  forceCenter,
  forceLink,
  forceCollide,
  forceX,
  forceY,
  Simulation,
  SimulationNodeDatum,
  select,
  drag,
  BaseType,
} from "d3"

// Diplomacy force graph. Parses the page's diplomacy-graph block (raw text in
// data-graph, set by plugins/transformers/diplomacygraph.ts), hides the code
// block, and renders an SVG force layout in its place. Grammar must stay
// equivalent to scripts/check-diplomacy-graph.py in the site repo; like that
// gate's public-edge check, edges whose endpoints have no node declaration in
// the block are treated as a parse failure. On any parse failure: leave the
// code block visible and bail (it doubles as the no-JS fallback). Element
// listeners rebind per "nav"; window.addCleanup for anything document/window-
// level.
//
// Imports come from "d3" (not the d3-force/d3-selection/d3-drag subpaths):
// the site already bundles d3 this way in graph.inline.ts, and it keeps the
// esbuild inline-script pipeline happy.

const KNOWN_TYPES = ["governance", "war-history", "alliance", "rivalry", "uneasy"]
const KNOWN_KINDS = ["nation", "institution", "people"]
const NODE_RE = /^node\s+([a-z0-9-]+)\s*\|\s*([^|]+?)\s*\|\s*([a-z-]+)\s*\|\s*(\S+)\s*$/
const EDGE_RE = /^edge\s+([a-z0-9-]+)\s*(->|<->)\s*([a-z0-9-]+)\s*\|\s*([a-z-]+)\s*\|\s*(.+?)\s*$/

type GNode = { id: string; name: string; kind: string; path: string } & SimulationNodeDatum
type GEdge = {
  source: string | GNode
  target: string | GNode
  mutual: boolean
  etype: string
  label: string
}

function parseGraph(text: string): { nodes: GNode[]; edges: GEdge[] } | null {
  const nodes: GNode[] = []
  const edges: GEdge[] = []
  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue
    const n = NODE_RE.exec(line)
    if (n) {
      if (!KNOWN_KINDS.includes(n[3])) {
        console.warn(
          "diplomacy-graph: unknown node kind, leaving text block visible:",
          n[3],
          "in",
          line,
        )
        return null
      }
      if (nodes.some((x) => x.id === n[1])) {
        console.warn("diplomacy-graph: duplicate node slug, leaving text block visible:", n[1])
        return null
      }
      nodes.push({ id: n[1], name: n[2], kind: n[3], path: n[4] })
      continue
    }
    const e = EDGE_RE.exec(line)
    if (e) {
      edges.push({ source: e[1], target: e[3], mutual: e[2] === "<->", etype: e[4], label: e[5] })
      continue
    }
    console.warn("diplomacy-graph: unparseable line, leaving text block visible:", line)
    return null
  }
  // Referential check, mirroring check-diplomacy-graph.py's "public edge
  // references non-public node" error: a grammar-valid edge whose endpoint
  // has no node declaration would otherwise pass parsing, hide the code
  // block, and then throw inside d3's forceLink id lookup, leaving a dead
  // half-rendered page. Fail closed here instead.
  const ids = new Set(nodes.map((n) => n.id))
  for (const e of edges) {
    if (!ids.has(e.source as string) || !ids.has(e.target as string)) {
      console.warn(
        "diplomacy-graph: edge references undeclared node, leaving text block visible:",
        e.source,
        "->",
        e.target,
      )
      return null
    }
  }
  return nodes.length ? { nodes, edges } : null
}

const RADIUS: Record<string, number> = { nation: 22, institution: 16, people: 12 }

// How far (in layout units, beyond the target node's own radius) an arrow tip
// sits from the node it points at. A single fixed marker refX cannot do this
// because node radii differ by kind, so the line itself is shortened per edge.
// ARROW_GAP is tuned by eye in the browser; 6 is the starting value.
const ARROW_GAP = 6

// The drawn end of an edge, pulled back from a node's center toward the other
// end by (that node's radius + ARROW_GAP), so the arrow tip clears the circle
// by the same gap regardless of node size. A directed edge's source end sits at
// the source center (hidden under its circle, no arrow there); only mutual edges
// pull the source end back too, since they carry a marker-start arrow.
function endpoint(d: GEdge, which: "source" | "target") {
  const from = (which === "source" ? d.source : d.target) as GNode
  const other = (which === "source" ? d.target : d.source) as GNode
  if (which === "source" && !d.mutual) return { x: from.x!, y: from.y! }
  const dx = other.x! - from.x!
  const dy = other.y! - from.y!
  const len = Math.hypot(dx, dy) || 1
  const back = (RADIUS[from.kind] ?? 14) + ARROW_GAP
  return { x: from.x! + (dx / len) * back, y: from.y! + (dy / len) * back }
}

function setupDiplomacyGraph() {
  const mount = document.querySelector<HTMLElement>(".diplomacy-graph-mount")
  const codeEl = document.querySelector<HTMLElement>(
    "code.diplomacy-graph-data[data-graph], [data-graph]",
  )
  if (!mount || !codeEl) return
  // If the mount already holds an SVG, a previous run rendered here. Guard
  // against double-mounting on repeated "nav" events for the same page.
  if (mount.querySelector("svg")) return
  const parsed = parseGraph(codeEl.dataset.graph ?? codeEl.getAttribute("data-graph") ?? "")
  if (!parsed) return
  const { nodes, edges } = parsed

  // Place the graph where the code block sits in the article, then hide it.
  const pre = codeEl.closest("pre, figure") ?? codeEl
  pre.insertAdjacentElement("beforebegin", mount)
  ;(pre as HTMLElement).style.display = "none"

  // Fixed logical coordinate space for the viewBox and the force layout. The
  // SVG scales to the container via CSS (max-width:100%, height:auto), so this
  // only sets the layout's aspect ratio and node spacing. It deliberately does
  // NOT read mount.clientWidth: at "nav" time that measurement is unreliable
  // (it came back far too narrow, collapsing the graph into a tall strip), and
  // a fixed landscape box renders identically regardless of when the script
  // runs.
  const width = 1040
  const height = 820
  const svg = select(mount)
    .append("svg")
    .attr("class", "diplomacy-svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", "Diplomacy web of Althas")

  // Arrowhead marker. orient="auto-start-reverse" makes the SAME marker point
  // the right way at both ends: forward (into the target) as marker-end, and
  // reversed (into the source) as marker-start. Directed edges (->) get an end
  // arrow only; mutual edges (<->) get arrows at both ends. Direction has to be
  // shown by the arrows now that the relationship labels are hover-only.
  svg
    .append("defs")
    .append("marker")
    .attr("id", "dg-arrow")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 10)
    .attr("refY", 0)
    .attr("markerWidth", 7)
    .attr("markerHeight", 7)
    .attr("orient", "auto-start-reverse")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("class", "dg-arrowhead")

  const caption = document.createElement("div")
  caption.className = "diplomacy-caption"
  caption.textContent = "Hover or tap a power to focus its connections."
  mount.appendChild(caption)

  const typeClass = (t: string) => (KNOWN_TYPES.includes(t) ? `type-${t}` : "type-other")

  const link = svg
    .append("g")
    .selectAll("line")
    .data(edges)
    .join("line")
    .attr("class", (d) => `dg-edge ${typeClass(d.etype)}`)
    .attr("marker-end", "url(#dg-arrow)")
    .attr("marker-start", (d) => (d.mutual ? "url(#dg-arrow)" : null))

  // Relationship label sitting at each edge's midpoint, revealed on hover only
  // (hidden at rest via the .dg-edge-label opacity in the stylesheet; the
  // script toggles .shown). A --light halo (paint-order stroke) keeps it legible
  // where it crosses a colored edge. Drawn after the edges so it reads above
  // them; pointer-events:none so it never steals the edge/node hover and drag.
  const edgeLabel = svg
    .append("g")
    .attr("class", "dg-edge-labels")
    .selectAll("text")
    .data(edges)
    .join("text")
    .attr("class", "dg-edge-label")
    .text((d) => d.label)

  const node = svg
    .append("g")
    .selectAll<SVGGElement, GNode>("g")
    .data(nodes)
    .join("g")
    .attr("class", (d) => `dg-node kind-${d.kind}`)
  node.append("circle").attr("r", (d) => RADIUS[d.kind] ?? 14)
  node
    .append("text")
    .attr("dy", (d) => (RADIUS[d.kind] ?? 14) + 14)
    .text((d) => d.name)

  // Node portraits: for any node whose page has an `image:`, fill its circle
  // with a circular-clipped portrait, inserted under the name label and over
  // the plain circle. Reuses fetchData (the page-global content index that the
  // main graph, Explorer and Search all read) and looks each node up by its
  // `path`, so the diplomacy block needs no authoring change. Async and
  // fire-and-forget: a slow or failed fetch just leaves the plain circles, and
  // a node with no image keeps its circle. This page is slug-gated one level
  // deep (setting/diplomacy), so "../assets/" resolves to the site asset root,
  // the same assumption the drag-to-navigate "../" paths above already rely on.
  void (async () => {
    let index: Record<string, { image?: string }>
    try {
      index = (await fetchData) as Record<string, { image?: string }>
    } catch {
      return
    }
    const portraitFor = (path: string): string | undefined => {
      const hit = index[path] ?? index[`${path}/index`]
      return typeof hit?.image === "string" ? hit.image : undefined
    }
    const defs = svg.select("defs")
    node.each(function (this: BaseType | SVGGElement, d: GNode) {
      const image = portraitFor(d.path)
      if (!image) return
      const r = RADIUS[d.kind] ?? 14
      const clipId = `dg-portrait-${d.id}`
      defs.append("clipPath").attr("id", clipId).append("circle").attr("r", r)
      select<SVGGElement, GNode>(this as SVGGElement)
        .insert("image", "text")
        .attr("class", "dg-portrait")
        .attr("href", `../assets/${image}`)
        .attr("x", -r)
        .attr("y", -r)
        .attr("width", r * 2)
        .attr("height", r * 2)
        .attr("clip-path", `url(#${clipId})`)
        .attr("preserveAspectRatio", "xMidYMid slice")
        .attr("pointer-events", "none")
    })
  })()

  // Keep name labels readable at every width. The SVG scales to the article
  // column (rendered px = user units * renderedWidth / 760), so at mobile
  // widths the stylesheet's 12-unit default would render around 5px. Measure
  // the actual scale and compensate so labels render at roughly 10px, capped
  // so desktop (scale ~0.83, ~10px rendered already) stays effectively
  // unchanged and tiny panes cannot balloon the text. The inline style wins
  // over the stylesheet default. Runs immediately, then again on two settle
  // timers (layout is not always final at "nav" time, which is why the
  // viewBox is fixed rather than measured), and on window resize. Plain
  // timers on purpose: rAF and ResizeObserver callbacks proved unreliable in
  // embedded panes, while timers and resize listeners fire everywhere. All
  // torn down in the cleanup below.
  const labelResize = () => {
    const rendered = (svg.node() as SVGSVGElement).getBoundingClientRect().width
    if (!rendered) return
    const scale = rendered / width
    const fs = Math.min(Math.max(12, 10 / scale), 26)
    node.selectAll<SVGTextElement, GNode>("text").style("font-size", `${fs}px`)
    // Edge labels a touch smaller than node names, same compensation so they
    // don't collapse to ~5px at mobile widths.
    const efs = Math.min(Math.max(11, 9 / scale), 22)
    edgeLabel.style("font-size", `${efs}px`)
  }
  labelResize()
  const labelTimers = [window.setTimeout(labelResize, 150), window.setTimeout(labelResize, 600)]
  window.addEventListener("resize", labelResize)

  const sim: Simulation<GNode, undefined> = forceSimulation(nodes)
    // Spacing tuned so the always-visible edge labels have room: a longer link
    // distance and stronger repulsion spread the tight war-cluster (Armada /
    // Polaris / Jesthaen) whose midpoint labels otherwise overlap into an
    // unreadable pile. Nodes stay draggable to separate any that still crowd.
    .force("charge", forceManyBody().strength(-620))
    .force("center", forceCenter(width / 2, height / 2))
    .force(
      "link",
      forceLink<GNode, GEdge>(edges)
        .id((d) => d.id)
        .distance(175),
    )
    .force(
      "collide",
      forceCollide<GNode>((d) => (RADIUS[d.kind] ?? 14) + 34),
    )
    // Pull each node gently toward center so the growing graph stays inside the
    // viewBox instead of drifting off the edges; the tick clamp below is the hard
    // guarantee, these forces just keep nodes off the boundary so it rarely bites.
    .force("x", forceX(width / 2).strength(0.08))
    .force("y", forceY(height / 2).strength(0.08))

  // Keep every node (and most of its label) inside the viewBox at all times,
  // including after a drag. MARGIN clears the largest node radius plus its label.
  const MARGIN = 52
  function clampToView(n: GNode) {
    n.x = Math.max(MARGIN, Math.min(width - MARGIN, n.x!))
    n.y = Math.max(MARGIN, Math.min(height - MARGIN, n.y!))
  }

  function tick() {
    nodes.forEach(clampToView)
    link
      .attr("x1", (d) => endpoint(d, "source").x)
      .attr("y1", (d) => endpoint(d, "source").y)
      .attr("x2", (d) => endpoint(d, "target").x)
      .attr("y2", (d) => endpoint(d, "target").y)
    edgeLabel
      .attr("x", (d) => ((d.source as GNode).x! + (d.target as GNode).x!) / 2)
      .attr("y", (d) => ((d.source as GNode).y! + (d.target as GNode).y!) / 2)
    node.attr("transform", (d) => `translate(${d.x},${d.y})`)
  }
  sim.on("tick", tick)
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    sim.stop()
    for (let i = 0; i < 300; i++) sim.tick()
    tick()
  }

  // Drag pins while held, releases with a gentle reheat. A near-motionless
  // drag counts as a click and navigates (paths are content-root-relative,
  // and this page lives one level deep, so "../" resolves them).
  let moved = 0
  node.call(
    drag<SVGGElement, GNode>()
      .on("start", (event, d) => {
        moved = 0
        if (!event.active) sim.alphaTarget(0.25).restart()
        d.fx = d.x
        d.fy = d.y
      })
      .on("drag", (event, d) => {
        moved += Math.abs(event.dx) + Math.abs(event.dy)
        d.fx = event.x
        d.fy = event.y
      })
      .on("end", (event, d) => {
        if (!event.active) sim.alphaTarget(0)
        d.fx = null
        d.fy = null
        if (moved < 4) window.location.href = `../${d.path}`
      }),
  )

  // Hover/tap: caption + dim non-adjacent + reveal the focused node's edge
  // labels (labels are hidden at rest, see the .shown class).
  const adjacent = (n: GNode, e: GEdge) => e.source === n || e.target === n
  const edgeText = (e: GEdge) =>
    `${(e.source as GNode).name} ${e.mutual ? "and" : "to"} ${(e.target as GNode).name}: ${e.label}`
  function focusNode(d: GNode | null) {
    node.classed(
      "dimmed",
      (n) =>
        !!d && n !== d && !edges.some((e) => adjacent(d, e) && (e.source === n || e.target === n)),
    )
    link.classed("dimmed", (e) => !!d && !adjacent(d, e))
    // Show labels only for the hovered node's own connections; hide all when
    // nothing is focused. Keeps the graph uncluttered at rest.
    edgeLabel.classed("shown", (e) => !!d && adjacent(d, e))
    caption.textContent = d
      ? edges
          .filter((e) => adjacent(d, e))
          .map(edgeText)
          .join("  •  ") || d.name
      : "Hover or tap a power to focus its connections."
  }
  node.on("mouseenter", (_ev, d) => focusNode(d)).on("mouseleave", () => focusNode(null))
  link
    .on("mouseenter", (_ev, e) => {
      caption.textContent = edgeText(e)
      edgeLabel.classed("shown", (x) => x === e)
    })
    .on("mouseleave", () => focusNode(null))
    .on("click", (_ev, e) => {
      caption.textContent = edgeText(e)
      edgeLabel.classed("shown", (x) => x === e)
    })

  // Legend from types present in the public data.
  const present = KNOWN_TYPES.filter((t) => edges.some((e) => e.etype === t))
  const legend = document.createElement("ul")
  legend.className = "diplomacy-legend"
  for (const t of present) {
    const li = document.createElement("li")
    const swatch = document.createElement("span")
    swatch.className = `dg-swatch ${typeClass(t)}`
    li.appendChild(swatch)
    li.appendChild(document.createTextNode(t.replace("-", " ")))
    legend.appendChild(li)
  }
  mount.appendChild(legend)

  window.addCleanup(() => {
    sim.stop()
    labelTimers.forEach((t) => window.clearTimeout(t))
    window.removeEventListener("resize", labelResize)
  })
}

document.addEventListener("nav", () => {
  setupDiplomacyGraph()
})
