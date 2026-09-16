import { SIGILS, SigilAsset } from "./sigils.gen"
import { CompoundSeal, DaggerGroup, Seal, isSingle } from "./types"

// Renders a Seal (or a whole CompoundSeal) as a self-contained SVG string using
// rigid transforms only (translate, rotate, uniform scale), the same
// composition method the source author uses: sigil path data is embedded
// verbatim, never warped. Stroke widths are rescaled proportionally
// (orig / scale) so every sigil draws at a consistent apparent pen weight while
// keeping the artist's deliberate weight ratios within each sigil.
//
// A single circle draws on a 1000x1000 viewBox exactly as before. A compound
// lays several circles out on a larger square canvas: satellites sit beside the
// core (each a full small circle), concentric and inside circles add disjoint
// outward ring-bands that share the core's centre and Heart, and the linking
// sigils (Transfer, Disperse, Fuse) are drawn between the circles they join.
//
// No two sigils ever overlap, for any seal the grammar allows (Sealcarver plan,
// Task 14). Placement is closed-loop: each circle's glyphs are measured as boxes,
// then a fit pass shrinks a crowded ring, keeps each auxiliary inside its own
// band, and clears the core of its satellites, until nothing collides. The
// no-overlap.test.ts property test fuzzes the whole bounded input space and
// asserts it. compoundGlyphBoxes / firstOverlap expose the geometry it checks.

const C = 500
const R_OUTER = 482
const R_INNER = 424
const R_PLAIN = 453
const R_DAGGER = 300
const R_MOD = R_DAGGER + 88
const R_BAND = 453
const HEART_W = 210
const CASTER_HEART_W = 260
const WRAP_W = 330
const TARGET_W = 250
const QUAL_H = 52
const MOD_W = 56
const TRIGGER_W = 46
const DAGGER_W = 135

// One circle's geometry on the shared canvas. A standalone circle uses the
// base frame; auxiliaries override centre, radii, sigil scale and whether the
// Heart is drawn (concentric and nested auxiliaries share the core's Heart, so
// they suppress their own).
interface Frame {
  cx: number
  cy: number
  ringOuter: number
  ringInner: number
  ringPlain: number
  daggerR: number
  modR: number
  bandR: number
  scale: number // multiplies sigil sizes (Heart, targets, daggers, ...)
  stroke: number // ring stroke width
  drawHeart: boolean
  // When this circle carries satellites on its rim (the core of a beside
  // compound), its ring is drawn as arcs that stop at each satellite instead of
  // running through it, and band glyphs under a satellite are skipped, so no
  // line ever crosses a satellite (the source draws Telekinesis / Floating Eye
  // this way). satSpecs give each satellite's centre angle (deg, 0 = up) and its
  // ACTUAL outer-ring radius (plain and detailed rings differ), so the arc stops
  // exactly on that satellite's circumference; satDist is their shared distance.
  satSpecs?: { angle: number; outerR: number }[]
  satDist?: number
  daggerBase?: number // extra rotation on this circle's daggers (deg), to clear the satellite/link angles
  // When set (shared-centre auxiliaries), every glyph of this circle must stay
  // within this radial band from its centre. The fit shrinks glyphs until they
  // do, so an auxiliary can never poke out of its allocated band into the core or
  // a sibling. The bands are allocated disjoint, so containment guarantees no
  // cross-circle overlap among shared-centre circles.
  clampInner?: number
  clampOuter?: number
  reach?: number // how far this circle's glyphs actually reach from its centre (core only)
}

function baseFrame(cx = C, cy = C): Frame {
  return {
    cx,
    cy,
    ringOuter: R_OUTER,
    ringInner: R_INNER,
    ringPlain: R_PLAIN,
    daggerR: R_DAGGER,
    modR: R_MOD,
    bandR: R_BAND,
    scale: 1,
    stroke: 5,
    drawHeart: true,
  }
}

function rescaleStrokes(body: string, s: number): string {
  return body.replace(
    /stroke-width:([\d.]+)px/g,
    (_, w) => `stroke-width:${(parseFloat(w) / s).toFixed(3)}px`,
  )
}

function place(
  key: string,
  cx: number,
  cy: number,
  target: number,
  rot = 0,
  fit: "w" | "h" = "w",
): string {
  const a: SigilAsset | undefined = SIGILS[key]
  if (!a) throw new Error(`unknown sigil ${key}`)
  const s = target / (fit === "w" ? a.w : a.h)
  const dw = a.w * s
  const dh = a.h * s
  return (
    `<g transform="translate(${cx.toFixed(2)},${cy.toFixed(2)}) rotate(${rot.toFixed(2)})">` +
    `<svg x="${(-dw / 2).toFixed(2)}" y="${(-dh / 2).toFixed(2)}" width="${dw.toFixed(2)}" height="${dh.toFixed(2)}" ` +
    `viewBox="0 0 ${a.w} ${a.h}" overflow="visible">${rescaleStrokes(a.body, s)}</svg></g>`
  )
}

function groupAngles(
  g: DaggerGroup,
  gi: number,
  nGroups: number,
  hasDirectional: boolean,
): number[] {
  if (g.placement === "directional") {
    // Keep the whole cluster inside ~120 degrees so a high count still reads
    // as one directed volley rather than a scatter.
    const spread = Math.min(38, 120 / Math.max(g.count - 1, 1))
    return Array.from({ length: g.count }, (_, i) => 90 + (i - (g.count - 1) / 2) * spread)
  }
  const step = 360 / Math.max(g.count, 1)
  // With a directional cluster at 90, anchor symmetric slots opposite it
  // (one slot at 270) so the two never collide; otherwise start at 0.
  const base = hasDirectional ? 270 % step : 0
  const offset = base + gi * (step / nGroups)
  return Array.from({ length: g.count }, (_, i) => offset + i * step)
}

// Sigils are placed with rot = ring angle, which points their authored "up"
// outward. Sigils authored sideways need a correction so their arrow points
// radially out instead of chasing the circle (expel's arrow points right in
// its own frame; G2 feedback caught the tangential drift).
const ORIENT: Partial<Record<string, number>> = { expel: -90 }

// A single placed sigil glyph: what to draw and where. Every glyph carries a
// `unit` tag so the fit pass and the no-overlap test can tell apart glyphs that
// are MEANT to share space (a dagger and its own modifier; the Heart's
// element + wrap + mode) from glyphs that must never touch (two different
// daggers, a dagger and a ring target). Ring circles and arcs are strokes, not
// glyphs, and are drawn separately, so they are never part of an overlap check.
export interface Box {
  unit: string
  key: string
  cx: number
  cy: number
  target: number
  rot: number
  fit: "w" | "h"
}

function drawnWH(key: string, target: number, fit: "w" | "h"): { w: number; h: number } {
  const a = SIGILS[key]
  if (!a) throw new Error(`unknown sigil ${key}`)
  const s = target / (fit === "w" ? a.w : a.h)
  return { w: a.w * s, h: a.h * s }
}

function renderBox(b: Box): string {
  return place(b.key, b.cx, b.cy, b.target, b.rot, b.fit)
}

// Oriented-bounding-box corners of a glyph, for the Separating Axis Theorem.
function corners(b: Box): [number, number][] {
  const { w, h } = drawnWH(b.key, b.target, b.fit)
  const r = (b.rot * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  const hw = w / 2
  const hh = h / 2
  const local: [number, number][] = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ]
  return local.map(([x, y]) => [b.cx + x * c - y * s, b.cy + x * s + y * c])
}

// True when two glyph boxes overlap. A cheap bounding-circle test rejects the
// common far-apart case; only near pairs pay for the full SAT on two quads. A
// tiny epsilon lets glyphs touch exactly at an edge without counting as overlap.
function overlaps(a: Box, b: Box): boolean {
  const A = drawnWH(a.key, a.target, a.fit)
  const B = drawnWH(b.key, b.target, b.fit)
  const ra = 0.5 * Math.hypot(A.w, A.h)
  const rb = 0.5 * Math.hypot(B.w, B.h)
  if (Math.hypot(a.cx - b.cx, a.cy - b.cy) >= ra + rb) return false
  const pa = corners(a)
  const pb = corners(b)
  const EPS = 0.5
  for (const poly of [pa, pb]) {
    for (let i = 0; i < 4; i++) {
      const [x1, y1] = poly[i]
      const [x2, y2] = poly[(i + 1) % 4]
      const nx = -(y2 - y1)
      const ny = x2 - x1
      let amin = Infinity
      let amax = -Infinity
      let bmin = Infinity
      let bmax = -Infinity
      for (const [px, py] of pa) {
        const d = px * nx + py * ny
        if (d < amin) amin = d
        if (d > amax) amax = d
      }
      for (const [px, py] of pb) {
        const d = px * nx + py * ny
        if (d < bmin) bmin = d
        if (d > bmax) bmax = d
      }
      if (amax <= bmin + EPS || bmax <= amin + EPS) return false
    }
  }
  return true
}

// Any two boxes from DIFFERENT units in one list overlap.
function overlapWithin(boxes: Box[]): boolean {
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++)
      if (boxes[i].unit !== boxes[j].unit && overlaps(boxes[i], boxes[j])) return true
  return false
}

// Any box in a overlaps any box in b (different unit).
function overlapBetween(a: Box[], b: Box[]): boolean {
  for (const x of a) for (const y of b) if (x.unit !== y.unit && overlaps(x, y)) return true
  return false
}

// Largest scale in (0.1, 1] for which pred holds. pred is monotone: shrinking a
// glyph toward its fixed centre can only reduce overlap, so binary search finds
// the roomiest size that still clears. Returns 1 immediately when nothing needs
// shrinking, so a seal that already fits renders byte-for-byte as before.
function fitLargest(pred: (s: number) => boolean): number {
  if (pred(1)) return 1
  let lo = 0.1
  let hi = 1
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2
    if (pred(mid)) lo = mid
    else hi = mid
  }
  return lo
}

function heartBoxes(f: Frame, seal: Seal): Box[] {
  if (!f.drawHeart) return []
  const out: Box[] = []
  const { element, mode, wrap } = seal.heart
  const k = f.scale
  const u = "heart"
  if (wrap !== "none")
    out.push({
      unit: u,
      key: `modifiers/${wrap}`,
      cx: f.cx,
      cy: f.cy,
      target: WRAP_W * k,
      rot: 0,
      fit: "w",
    })
  if (element === "caster-self") {
    // Blink Out's construction: the Caster target sigil serves as the Heart,
    // with the bare mode modifier beneath it (no pre-composed asset exists).
    out.push({
      unit: u,
      key: "targets/caster",
      cx: f.cx,
      cy: f.cy - 14 * k,
      target: CASTER_HEART_W * k,
      rot: 0,
      fit: "w",
    })
    out.push({
      unit: u,
      key: `modifiers/${mode}`,
      cx: f.cx,
      cy: f.cy + 56 * k,
      target: 80 * k,
      rot: 0,
      fit: "w",
    })
  } else {
    out.push({
      unit: u,
      key: `elements/${element}-${mode}`,
      cx: f.cx,
      cy: f.cy,
      target: HEART_W * k,
      rot: 0,
      fit: "w",
    })
  }
  return out
}

// Each dagger's angle around its ring, plus which group/slot it came from. When
// the artful placement puts two daggers on top of each other (e.g. two
// directional groups both centred at 90 degrees), no amount of shrinking can
// separate coincident centres, so fall back to an even spread around the whole
// ring, which always leaves a gap. Each dagger keeps its own sigil and mod; only
// the angles change.
function daggerAngles(
  f: Frame,
  seal: Seal,
): { gi: number; slot: number; ang: number; g: DaggerGroup }[] {
  const n = seal.daggers.length
  const hasDirectional = seal.daggers.some((g) => g.placement === "directional")
  const base = f.daggerBase ?? 0
  const units: { gi: number; slot: number; ang: number; g: DaggerGroup }[] = []
  seal.daggers.forEach((g, gi) => {
    groupAngles(g, gi, n, hasDirectional).forEach((a, slot) =>
      units.push({ gi, slot, ang: (((a + base) % 360) + 360) % 360, g }),
    )
  })
  const sorted = [...units].sort((x, y) => x.ang - y.ang)
  let minGap = 360
  for (let i = 0; i < sorted.length; i++) {
    const gap = (i + 1 < sorted.length ? sorted[i + 1].ang : sorted[0].ang + 360) - sorted[i].ang
    if (gap < minGap) minGap = gap
  }
  if (units.length > 1 && minGap < 6) {
    units.forEach((u, i) => (u.ang = (base + (i * 360) / units.length) % 360))
  }
  return units
}

// Every dagger glyph (and its modifier) at a given shrink scale. A dagger and
// its mod share a unit id: they are one composite glyph and are allowed to touch.
function daggerBoxes(f: Frame, seal: Seal, scale: number): Box[] {
  const k = f.scale * scale
  const out: Box[] = []
  daggerAngles(f, seal).forEach(({ gi, slot, ang, g }) => {
    // On a core carrying satellites, a dagger whose angle falls near a satellite
    // would collide with that satellite's inner content and with the link sigil
    // running along the same spoke. Drop it, the same way band glyphs under a
    // satellite are dropped (the source draws the core's daggers clear of each
    // satellite's attachment point). The sector is widened past the satellite's
    // own arc by the dagger's angular half-width plus the satellite glyph's, so a
    // dagger only NEAR (not just under) a satellite is cleared too.
    if (daggerUnderSatellite(f, ang)) return
    const u = `d${gi}_${slot}`
    const orient = ORIENT[g.dagger] ?? 0
    const a = (ang * Math.PI) / 180
    const dx = f.cx + f.daggerR * Math.sin(a)
    const dy = f.cy - f.daggerR * Math.cos(a)
    out.push({
      unit: u,
      key: `functions/${g.dagger}`,
      cx: dx,
      cy: dy,
      target: DAGGER_W * k,
      rot: ang + orient,
      fit: "w",
    })
    if (g.mod === "none") return
    if (g.mod === "senses") {
      // Senses sits adjacent to its sigil (Cloaking Blast's construction).
      const ra = (ang * Math.PI) / 180
      out.push({
        unit: u,
        key: "modifiers/senses",
        cx: f.cx + f.modR * Math.sin(ra),
        cy: f.cy - f.modR * Math.cos(ra),
        target: MOD_W * k,
        rot: ang,
        fit: "w",
      })
    } else {
      // Delay WRAPS its sigil (p8: "Expel with Delay" draws the brackets around
      // the arrow); Shape mods are set INTO the Shape sigil's slot. Either way
      // the mod shares the sigil's center AND final rotation so the composite
      // reads as one glyph.
      const w = (g.mod === "delay" ? 205 : 40) * k
      out.push({
        unit: u,
        key: `modifiers/${g.mod}`,
        cx: dx,
        cy: dy,
        target: w,
        rot: ang + orient,
        fit: "w",
      })
    }
  })
  return out
}

// Half-angle (deg, seen from the ring centre) that a satellite of radius ra,
// centred at distance D, cuts out of a ring of radius R. The ring arc must stop
// this far short of each satellite angle so the two never cross.
function satGapHalf(R: number, D: number, ra: number): number {
  const c = Math.max(-1, Math.min(1, (R * R + D * D - ra * ra) / (2 * R * D)))
  return (Math.acos(c) * 180) / Math.PI
}

function ptOnRing(cx: number, cy: number, R: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180
  return [cx + R * Math.sin(a), cy - R * Math.cos(a)]
}

// A ring circle, drawn whole, or (when the circle carries satellites) as arcs
// that stop short of each satellite so nothing crosses it.
function ringCircle(f: Frame, R: number, stroke: string): string {
  if (!f.satSpecs || !f.satSpecs.length || !f.satDist) {
    return `<circle cx="${f.cx}" cy="${f.cy}" r="${R}" ${stroke}/>`
  }
  const skips: [number, number][] = []
  for (const { angle: g, outerR } of f.satSpecs) {
    // Stop this ring exactly where it meets THIS satellite's own outer circle
    // (plain and detailed rings differ), so the two lines touch with neither a
    // gap nor a crossing.
    const h = satGapHalf(R, f.satDist, outerR)
    const s = (((g - h) % 360) + 360) % 360
    const e = (((g + h) % 360) + 360) % 360
    if (s <= e) skips.push([s, e])
    else {
      skips.push([s, 360])
      skips.push([0, e])
    }
  }
  skips.sort((a, b) => a[0] - b[0])
  const keeps: [number, number][] = []
  let cur = 0
  for (const [s, e] of skips) {
    if (s > cur) keeps.push([cur, s])
    cur = Math.max(cur, e)
  }
  if (cur < 360) keeps.push([cur, 360])
  const paths = keeps
    .filter(([a, b]) => b - a > 0.5)
    .map(([a, b]) => {
      const [x1, y1] = ptOnRing(f.cx, f.cy, R, a)
      const [x2, y2] = ptOnRing(f.cx, f.cy, R, b)
      const large = b - a > 180 ? 1 : 0
      return `M${x1.toFixed(2)},${y1.toFixed(2)} A${R},${R} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)}`
    })
  return `<path d="${paths.join(" ")}" fill="none" ${stroke}/>`
}

// True when a core dagger at this angle sits near enough a satellite to collide
// with its inner content or its link spoke. Wider than underSatellite: it adds
// the dagger's angular half-width and a margin for the satellite's inner glyphs.
function daggerUnderSatellite(f: Frame, angleDeg: number): boolean {
  if (!f.satSpecs || !f.satDist) return false
  const a = ((angleDeg % 360) + 360) % 360
  const extra = (Math.atan2(0.5 * DAGGER_W * f.scale, f.daggerR) * 180) / Math.PI + 12
  return f.satSpecs.some(({ angle: g, outerR }) => {
    const h = satGapHalf(f.daggerR, f.satDist!, outerR) + extra
    const d = Math.abs(((a - g + 540) % 360) - 180)
    return d < h
  })
}

// True when a band glyph at this angle sits near enough a satellite to collide
// with it. The +14 margin past the satellite's own arc covers the physical
// half-widths of both the core band glyph and the satellite's own inner glyphs,
// so a glyph merely NEAR a satellite is dropped too, not only one dead under it.
function underSatellite(f: Frame, angleDeg: number, R: number): boolean {
  if (!f.satSpecs || !f.satDist) return false
  const a = ((angleDeg % 360) + 360) % 360
  return f.satSpecs.some(({ angle: g, outerR }) => {
    const h = satGapHalf(R, f.satDist!, outerR) + 14
    const d = Math.abs(((a - g + 540) % 360) - 180)
    return d < h
  })
}

// The ring circles/arcs only (strokes, drawn under the glyphs, never part of an
// overlap check). The band glyphs that sit on the ring are produced by bandBoxes.
function ringStrokes(f: Frame, seal: Seal): string {
  const stroke = `style="fill:none;stroke:currentColor;stroke-width:${f.stroke}px;"`
  if (seal.ring.plain) return ringCircle(f, f.ringPlain, stroke)
  return ringCircle(f, f.ringOuter, stroke) + ringCircle(f, f.ringInner, stroke)
}

// The target/qualifier/trigger glyphs sitting on the ring band. Each is its own
// unit: two band glyphs must never touch. Glyphs that would fall under a
// satellite are dropped (the satellite occupies that arc).
function bandBoxes(f: Frame, seal: Seal, scale: number): Box[] {
  if (seal.ring.plain) return []
  const k = f.scale * scale
  const out: Box[] = []
  let bi = 0
  const put = (key: string, ang: number, target: number, fit: "w" | "h") => {
    if (underSatellite(f, ang, f.bandR)) return
    const a = (ang * Math.PI) / 180
    out.push({
      unit: `b${bi++}`,
      key,
      cx: f.cx + f.bandR * Math.sin(a),
      cy: f.cy - f.bandR * Math.cos(a),
      target,
      rot: ang,
      fit,
    })
  }
  const targets = seal.ring.targets
  targets.forEach((t, i) => {
    const step = 360 / targets.length
    // each target appears twice for symmetry (author's rings repeat strips)
    for (const base of [0, 180]) put(`targets/${t}`, base + i * (step / 2), TARGET_W * k, "w")
  })
  seal.ring.qualifiers.forEach((q, i) => {
    for (const kk of [0, 1, 2, 3]) put(`elements/${q}`, 45 + i * 22.5 + kk * 90, QUAL_H * k, "h")
  })
  if (seal.ring.trigger !== "none") {
    for (const kk of [0, 1, 2, 3])
      put(`triggers/${seal.ring.trigger}`, 22.5 + kk * 90, TRIGGER_W * k, "w")
  }
  return out
}

// The closed-loop fit: shrink the crowded glyph rings just enough that nothing
// overlaps. Daggers shrink first (theirs is the only ring whose count the user
// can push, up to 24) so they clear each other, the Heart, and the band; then
// the band shrinks to clear itself, the Heart, and the fitted daggers. A ring
// that already fits keeps scale 1, so an uncrowded seal is unchanged. Because
// the grammar is bounded (isValidSeal), this covers every seal a user can build.
// Every glyph corner stays within the frame's radial band (only enforced when a
// band is set, i.e. for shared-centre auxiliaries). Keeps a wide glyph (a delay
// bracket especially) from poking out of its band into a neighbour.
function withinBand(boxes: Box[], f: Frame): boolean {
  if (f.clampInner == null || f.clampOuter == null) return true
  for (const b of boxes)
    for (const [x, y] of corners(b)) {
      const r = Math.hypot(x - f.cx, y - f.cy)
      if (r < f.clampInner || r > f.clampOuter) return false
    }
  return true
}

// obstacles are glyph boxes from OTHER circles that this circle's glyphs must
// also clear (the core passes its satellites' boxes here, so a core dagger, and
// especially its wide delay bracket, shrinks until it no longer reaches a
// satellite). Empty for a standalone or single circle, so nothing changes there.
function circleBoxes(f: Frame, seal: Seal, obstacles: Box[] = []): Box[] {
  const heartB = heartBoxes(f, seal)
  const band1 = bandBoxes(f, seal, 1)
  const dScale = fitLargest((s) => {
    const d = daggerBoxes(f, seal, s)
    return (
      !overlapWithin(d) &&
      !overlapBetween(d, [...heartB, ...band1]) &&
      !overlapBetween(d, obstacles) &&
      withinBand(d, f)
    )
  })
  const dB = daggerBoxes(f, seal, dScale)
  const bScale = fitLargest((s) => {
    const b = bandBoxes(f, seal, s)
    return (
      !overlapWithin(b) &&
      !overlapBetween(b, [...heartB, ...dB]) &&
      !overlapBetween(b, obstacles) &&
      withinBand(b, f)
    )
  })
  return [...bandBoxes(f, seal, bScale), ...heartB, ...dB]
}

function circle(f: Frame, seal: Seal): string {
  return ringStrokes(f, seal) + circleBoxes(f, seal).map(renderBox).join("")
}

export function compose(seal: Seal): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">` +
    circle(baseFrame(), seal) +
    `</svg>`
  )
}

export function composeForSave(seal: Seal, bg: "white" | "transparent"): string {
  let svg = compose(seal).replace(/currentColor/g, "#000000")
  if (bg === "white") {
    svg = svg.replace(">", `><rect width="1000" height="1000" fill="#ffffff"/>`)
  }
  return svg
}

// --- Compound layout --------------------------------------------------------

const CONCENTRIC_BAND = 150 // radial width each concentric ring-band adds
// A satellite's centre sits exactly ON the core ring (Telekinesis / Floating
// Eye), so the core ring passes through its centre and is drawn as arcs that
// stop at it. Larger than the source's ~third so its inner icons stay readable
// (airy glyphs like magic/grasp otherwise vanish), still short of the link band.
const SAT_SCALE = 0.4

// Compute a Frame per circle, plus a square viewBox that contains them all.
// Circles work in a centre-origin space; the viewBox is squared and padded so
// on-screen (100% width) and 2000x2000 export both stay undistorted, matching
// the author's square 1000 / 1500 / 2000 canvases.
function layout(compound: CompoundSeal): { frames: Frame[]; view: string } {
  const frames: Frame[] = new Array(compound.circles.length)
  frames[0] = baseFrame(0, 0) // core

  const satellites: number[] = []
  compound.circles.forEach((node, i) => {
    if (i === 0) return
    if (node.placement === "beside") satellites.push(i)
  })

  // Satellites first, so the outward bands below know how far the satellites
  // reach and can start clear of them. Satellites sit with their centre exactly
  // ON the core ring, spaced evenly from the top. The core ring is drawn as arcs
  // that stop at each satellite (see ringCircle), so a satellite reads as sitting
  // on the rim with no line crossing it, exactly as the source draws Telekinesis
  // and Floating Eye.
  const satDist = R_OUTER
  // A satellite's real footprint is larger than its ring: its band target glyphs
  // sit at bandR and stick out past the ring by roughly half a target width, so
  // the outward bands must start beyond THIS radius, not just the ring radius.
  const satRadius = SAT_SCALE * (R_OUTER + TARGET_W * 0.5) + 12
  const satSpecs: { angle: number; outerR: number }[] = []
  satellites.forEach((i, slot) => {
    const angDeg = slot * (360 / satellites.length)
    const a = (angDeg * Math.PI) / 180
    const cx = satDist * Math.sin(a)
    const cy = -satDist * Math.cos(a)
    const f = baseFrame(cx, cy)
    f.scale = SAT_SCALE
    f.ringOuter *= SAT_SCALE
    f.ringInner *= SAT_SCALE
    f.ringPlain *= SAT_SCALE
    f.daggerR *= SAT_SCALE
    f.modR *= SAT_SCALE
    f.bandR *= SAT_SCALE
    f.stroke = 4
    frames[i] = f
    // The satellite's actual outermost line: a plain ring sits at ringPlain, a
    // detailed one at ringOuter. The core ring must stop exactly there.
    const outerR = compound.circles[i].seal.ring.plain ? f.ringPlain : f.ringOuter
    satSpecs.push({ angle: angDeg, outerR })
  })
  if (satSpecs.length) {
    frames[0].satSpecs = satSpecs
    frames[0].satDist = satDist
    // Push the core's daggers onto the diagonals so they clear the satellites
    // and link arrows sitting on the cardinal axes (the source draws it so).
    frames[0].daggerBase = 45
  }

  // Concentric and inside auxiliaries both share the core's centre and Heart, so
  // each must occupy its OWN disjoint annular band: two circles centred on the
  // same point cannot avoid each other any other way. The core already fills its
  // disk (Heart at the centre, daggers at 300, band at 453), so there is no free
  // interior annulus for a full circle; every shared-centre aux is therefore an
  // outward band, allocated by a single radius cursor that walks outward. The
  // cursor starts beyond the satellites' outer reach so a band never lands in the
  // satellite zone. Each band contains all of that circle's content (ring,
  // daggers, band glyphs), so no shared-centre circle can ever overlap the core,
  // a satellite, or another aux. Inside bands are drawn tighter than concentric
  // ones to still read as subordinate. (Faithful "nested inside the core"
  // rendering is impossible for a core that has daggers; folding inside into an
  // outward band is what makes the no-overlap guarantee hold for every input.)
  // How far the core's own glyphs actually reach (its band glyphs overhang the
  // ring), so the first band starts beyond them, not just past the ring radius.
  let coreReach = R_OUTER
  for (const b of circleBoxes(frames[0], compound.circles[0].seal)) {
    const { w, h } = drawnWH(b.key, b.target, b.fit)
    coreReach = Math.max(coreReach, Math.hypot(b.cx, b.cy) + 0.5 * Math.hypot(w, h))
  }
  frames[0].reach = coreReach
  let outer = Math.max(coreReach, satSpecs.length ? satDist + satRadius : 0)
  compound.circles.forEach((node, i) => {
    if (i === 0) return
    if (node.placement !== "concentric" && node.placement !== "inside") return
    const width = node.placement === "inside" ? 128 : CONCENTRIC_BAND
    // A wider inter-band gap leaves room for a link sigil to sit cleanly in the
    // ring between two shared-centre circles instead of being pushed to the margin.
    const gap = 54
    outer += gap + width
    const ringOuter = outer
    frames[i] = {
      cx: 0,
      cy: 0,
      ringOuter,
      ringInner: ringOuter - width * 0.4,
      ringPlain: ringOuter - width * 0.1,
      daggerR: ringOuter - width * 0.55, // daggers sit mid-band, contained
      modR: ringOuter - width * 0.28,
      bandR: ringOuter - width * 0.2,
      scale: node.placement === "inside" ? 0.5 : 0.72,
      stroke: node.placement === "inside" ? 4 : 5,
      drawHeart: false,
      // Every glyph of this circle is kept inside its own band by the fit; the
      // bands are disjoint, so no shared-centre circle can reach into another.
      clampInner: ringOuter - width + 6,
      clampOuter: ringOuter - 4,
    }
  })

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const f of frames) {
    const foot = Math.max(f.ringOuter, f.daggerR, f.modR) + 24
    minX = Math.min(minX, f.cx - foot)
    maxX = Math.max(maxX, f.cx + foot)
    minY = Math.min(minY, f.cy - foot)
    maxY = Math.max(maxY, f.cy + foot)
  }
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const side = Math.max(maxX - minX, maxY - minY) + 40
  const x0 = cx - side / 2
  const y0 = cy - side / 2
  const view = `${x0.toFixed(1)} ${y0.toFixed(1)} ${side.toFixed(1)} ${side.toFixed(1)}`
  return { frames, view }
}

// This circle's glyph reach from its own centre: the band for an auxiliary, the
// measured reach for the core, the ring radius as a fallback.
function radialSpan(f: Frame): { inner: number; outer: number } {
  if (f.clampInner != null && f.clampOuter != null)
    return { inner: f.clampInner, outer: f.clampOuter }
  return { inner: 0, outer: f.reach ?? f.ringOuter }
}

// The linking sigil for one edge. For a satellite link it sits radially in the
// clear gap between the core's inner content and the satellite, pointing toward
// the target circle (inward when the target is the core, outward when it is the
// satellite), the way the source arrows run between the core and each auxiliary.
// For a shared centre (concentric / inside) it sits in the empty ring gap between
// the two circles, sized to that gap, pointing toward the target circle. The
// resolver then sweeps the angle to a clear spot.
function linkBox(edge: CompoundSeal["links"][number], frames: Frame[], u: string): Box {
  const f = frames[edge.from]
  const t = frames[edge.to]
  const key = `functions/${edge.type}`
  const dx = t.cx - f.cx
  const dy = t.cy - f.cy
  const dist = Math.hypot(dx, dy)
  if (dist < 5) {
    const sf = radialSpan(f)
    const st = radialSpan(t)
    const innerOuter = Math.min(sf.outer, st.outer) // outer edge of the inner circle
    const outerInner = sf.outer >= st.outer ? sf.inner : st.inner // inner edge of the outer circle
    const gapMid = (innerOuter + outerInner) / 2
    const gapH = Math.max(16, outerInner - innerOuter)
    const target = Math.min(130, gapH - 6)
    const toIsOuter = st.outer >= sf.outer // the target circle is the outer one -> point outward
    const a = (35 * Math.PI) / 180
    return {
      unit: u,
      key,
      cx: f.cx + gapMid * Math.sin(a),
      cy: f.cy - gapMid * Math.cos(a),
      target,
      rot: 35 + (toIsOuter ? -90 : 90),
      fit: "h",
    }
  }
  // Satellite link: one endpoint is the core (it carries satAngles), the other a
  // satellite on the rim. Work from the core centre out along the satellite's
  // angle.
  const core = f.satSpecs ? f : t
  const aux = core === f ? t : f
  const aa = Math.atan2(aux.cx - core.cx, -(aux.cy - core.cy)) // radians, 0 = up
  // Sit in the clear band between the core's inner content (the wrap bracket
  // reaches ~162) and the satellite's inner edge (~280 at this scale), short
  // enough to touch neither. Centre ~222, half-length ~46, so it spans ~176..268.
  const rLink = R_OUTER * 0.46
  const px = core.cx + rLink * Math.sin(aa)
  const py = core.cy - rLink * Math.cos(aa)
  const angleDeg = (aa * 180) / Math.PI
  // The link sigils are authored pointing right (like expel), so a radial
  // outward arrow needs angle - 90; inward is the opposite.
  const pointOut = edge.to !== 0 // target is the satellite -> point outward
  return {
    unit: u,
    key,
    cx: px,
    cy: py,
    target: 92,
    rot: angleDeg + (pointOut ? -90 : 90),
    fit: "w",
  }
}

// Place the link sigils so no link overlaps a glyph or another link. Each link
// starts at its natural spot (linkBox) and, if that is blocked, tries a small
// fan of nearby radii and angles until it finds a clear spot. The canvas is
// large and links are few (at most MAX_CIRCLES - 1), so a clear spot always
// exists. Only the position moves; the arrow keeps its authored rotation.
function resolvedLinkBoxes(compound: CompoundSeal, frames: Frame[], glyphs: Box[]): Box[] {
  // Radius that clears every glyph: past this, the outer margin is empty, so a
  // link parked there is guaranteed not to touch any glyph.
  let clearR = 0
  for (const g of glyphs) {
    const { w, h } = drawnWH(g.key, g.target, g.fit)
    clearR = Math.max(clearR, Math.hypot(g.cx, g.cy) + 0.5 * Math.hypot(w, h))
  }
  // Angle offsets to try, nearest the natural direction first, sweeping the whole
  // circle. A satellite link keeps its spoke (offset 0 is usually clear); a
  // shared-centre link slides around the empty ring gap to a free angle.
  const angleOffsets = [0]
  for (let d = 6; d <= 180; d += 6) angleOffsets.push(d, -d)

  const placed: Box[] = []
  compound.links.forEach((e, i) => {
    const nat = linkBox(e, frames, `lnk${i}`)
    const R0 = Math.hypot(nat.cx, nat.cy) || R_OUTER * 0.46
    const baseAngDeg = (Math.atan2(nat.cx, -nat.cy) * 180) / Math.PI
    // The link's rotation relative to its radial angle stays fixed as it slides,
    // so the arrow keeps pointing the right way at whatever angle it lands.
    const rotOffset = nat.rot - baseAngDeg
    const at = (R: number, angDeg: number): Box => {
      const a = (angDeg * Math.PI) / 180
      return { ...nat, cx: R * Math.sin(a), cy: -R * Math.cos(a), rot: angDeg + rotOffset }
    }
    const clear = (cand: Box) =>
      !placed.some((p) => overlaps(p, cand)) && !glyphs.some((g) => overlaps(g, cand))
    let chosen: Box | null = null
    search: for (const rMul of [1, 1.1, 0.9, 1.22, 0.8, 1.34]) {
      for (const dDeg of angleOffsets) {
        const cand = at(R0 * rMul, baseAngDeg + dDeg)
        if (clear(cand)) {
          chosen = cand
          break search
        }
      }
    }
    if (!chosen) {
      // Nothing anywhere near was clear (rare). Park it in the empty outer margin
      // at an angle spread by link index, keeping it radial.
      const angDeg = (i * 360) / Math.max(compound.links.length, 1) + 10
      let cand = at(clearR + 46, angDeg)
      let guard = 0
      while (!clear(cand) && guard++ < 8) cand = at(clearR + 46 + guard * 40, angDeg)
      chosen = cand
    }
    placed.push(chosen)
  })
  return placed
}

// Frames, viewBox, per-circle glyph boxes (unit tag unique per circle) and the
// resolved link boxes for a whole compound. The single source of truth: both the
// renderer and the no-overlap test build from this, so the test checks the real
// output, not a parallel model.
function compoundParts(compound: CompoundSeal): {
  frames: Frame[]
  view: string
  circleB: Box[]
  linkB: Box[]
} {
  const { frames, view } = layout(compound)
  // Auxiliaries first; satellites (beside) become obstacles the core must clear.
  const auxB: Box[] = []
  const besideB: Box[] = []
  compound.circles.forEach((node, i) => {
    if (i === 0) return
    const bs = circleBoxes(frames[i], node.seal).map((b) => ({ ...b, unit: `c${i}:${b.unit}` }))
    auxB.push(...bs)
    if (node.placement === "beside") besideB.push(...bs)
  })
  const coreB = circleBoxes(frames[0], compound.circles[0].seal, besideB).map((b) => ({
    ...b,
    unit: `c0:${b.unit}`,
  }))
  const circleB = [...coreB, ...auxB]
  const linkB = resolvedLinkBoxes(compound, frames, circleB)
  return { frames, view, circleB, linkB }
}

export function composeCompound(compound: CompoundSeal): string {
  if (isSingle(compound)) return compose(compound.circles[0].seal)
  const { frames, view, circleB, linkB } = compoundParts(compound)
  const strokes = frames.map((f, i) => ringStrokes(f, compound.circles[i].seal)).join("")
  const glyphs = [...circleB, ...linkB].map(renderBox).join("")
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}">` + strokes + glyphs + `</svg>`
}

// Every glyph box for a whole compound (single or multi-circle), in one shared
// coordinate space. Ring circles/arcs are strokes, not glyphs, so they are absent.
export function compoundGlyphBoxes(compound: CompoundSeal): Box[] {
  if (isSingle(compound)) return circleBoxes(baseFrame(), compound.circles[0].seal)
  const { circleB, linkB } = compoundParts(compound)
  return [...circleB, ...linkB]
}

// The first pair of different-unit glyphs that overlap, or null when none do.
// The no-overlap invariant (Sealcarver plan, Task 14) holds exactly when this is
// null for every seal a user can build.
export function firstOverlap(compound: CompoundSeal): { a: Box; b: Box } | null {
  const boxes = compoundGlyphBoxes(compound)
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++)
      if (boxes[i].unit !== boxes[j].unit && overlaps(boxes[i], boxes[j]))
        return { a: boxes[i], b: boxes[j] }
  return null
}

export function composeCompoundForSave(
  compound: CompoundSeal,
  bg: "white" | "transparent",
): string {
  if (isSingle(compound)) return composeForSave(compound.circles[0].seal, bg)
  let svg = composeCompound(compound).replace(/currentColor/g, "#000000")
  if (bg === "white") {
    const vb = svg.match(/viewBox="([^"]+)"/)
    if (vb) {
      const [x, y, w, h] = vb[1].split(" ")
      svg = svg.replace(">", `><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff"/>`)
    }
  }
  return svg
}
