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
// core (each a full small circle), concentric and nested circles add ring-bands
// that share the core's centre and Heart, and the linking sigils (Transfer,
// Disperse, Fuse) are drawn between the circles they join.

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

// Place a sigil on a ring of the given absolute radius around a frame's centre.
function onRing(
  f: Frame,
  key: string,
  radius: number,
  angleDeg: number,
  target: number,
  fit: "w" | "h" = "w",
): string {
  const a = (angleDeg * Math.PI) / 180
  return place(key, f.cx + radius * Math.sin(a), f.cy - radius * Math.cos(a), target, angleDeg, fit)
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

function heart(f: Frame, seal: Seal): string {
  if (!f.drawHeart) return ""
  const parts: string[] = []
  const { element, mode, wrap } = seal.heart
  const k = f.scale
  if (wrap !== "none") parts.push(place(`modifiers/${wrap}`, f.cx, f.cy, WRAP_W * k))
  if (element === "caster-self") {
    // Blink Out's construction: the Caster target sigil serves as the Heart,
    // with the bare mode modifier beneath it (no pre-composed asset exists).
    parts.push(place("targets/caster", f.cx, f.cy - 14 * k, CASTER_HEART_W * k))
    parts.push(place(`modifiers/${mode}`, f.cx, f.cy + 56 * k, 80 * k))
  } else {
    parts.push(place(`elements/${element}-${mode}`, f.cx, f.cy, HEART_W * k))
  }
  return parts.join("")
}

function daggers(f: Frame, seal: Seal): string {
  const parts: string[] = []
  const n = seal.daggers.length
  const k = f.scale
  const hasDirectional = seal.daggers.some((g) => g.placement === "directional")
  const daggerBase = f.daggerBase ?? 0
  seal.daggers.forEach((g, gi) => {
    for (const ang0 of groupAngles(g, gi, n, hasDirectional)) {
      const ang = ang0 + daggerBase
      const orient = ORIENT[g.dagger] ?? 0
      const a = (ang * Math.PI) / 180
      const dx = f.cx + f.daggerR * Math.sin(a)
      const dy = f.cy - f.daggerR * Math.cos(a)
      parts.push(place(`functions/${g.dagger}`, dx, dy, DAGGER_W * k, ang + orient))
      if (g.mod === "none") continue
      if (g.mod === "senses") {
        // Senses sits adjacent to its sigil (Cloaking Blast's construction).
        parts.push(onRing(f, `modifiers/${g.mod}`, f.modR, ang, MOD_W * k))
      } else {
        // Delay WRAPS its sigil (p8: "Expel with Delay" draws the brackets
        // around the arrow); Shape mods are set INTO the Shape sigil's slot.
        // Either way the mod shares the sigil's center AND final rotation so
        // the composite reads as one glyph.
        const w = (g.mod === "delay" ? 205 : 40) * k
        parts.push(place(`modifiers/${g.mod}`, dx, dy, w, ang + orient))
      }
    }
  })
  return parts.join("")
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
    const s = ((g - h) % 360 + 360) % 360
    const e = ((g + h) % 360 + 360) % 360
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

// True when a band glyph at this angle would sit under a satellite.
function underSatellite(f: Frame, angleDeg: number, R: number): boolean {
  if (!f.satSpecs || !f.satDist) return false
  const a = ((angleDeg % 360) + 360) % 360
  return f.satSpecs.some(({ angle: g, outerR }) => {
    const h = satGapHalf(R, f.satDist!, outerR) + 4
    const d = Math.abs(((a - g + 540) % 360) - 180)
    return d < h
  })
}

function ring(f: Frame, seal: Seal): string {
  const stroke = `style="fill:none;stroke:currentColor;stroke-width:${f.stroke}px;"`
  if (seal.ring.plain) {
    return ringCircle(f, f.ringPlain, stroke)
  }
  const k = f.scale
  const parts = [ringCircle(f, f.ringOuter, stroke), ringCircle(f, f.ringInner, stroke)]
  const targets = seal.ring.targets
  targets.forEach((t, i) => {
    const step = 360 / targets.length
    for (const base of [0, 180]) {
      // each target appears twice for symmetry (author's rings repeat strips)
      const ang = base + i * (step / 2)
      if (underSatellite(f, ang, f.bandR)) continue
      parts.push(onRing(f, `targets/${t}`, f.bandR, ang, TARGET_W * k))
    }
  })
  seal.ring.qualifiers.forEach((q, i) => {
    for (const kk of [0, 1, 2, 3]) {
      const ang = 45 + i * 22.5 + kk * 90
      if (underSatellite(f, ang, f.bandR)) continue
      parts.push(onRing(f, `elements/${q}`, f.bandR, ang, QUAL_H * k, "h"))
    }
  })
  if (seal.ring.trigger !== "none") {
    for (const kk of [0, 1, 2, 3]) {
      const ang = 22.5 + kk * 90
      if (underSatellite(f, ang, f.bandR)) continue
      parts.push(onRing(f, `triggers/${seal.ring.trigger}`, f.bandR, ang, TRIGGER_W * k))
    }
  }
  return parts.join("")
}

function circle(f: Frame, seal: Seal): string {
  return ring(f, seal) + heart(f, seal) + daggers(f, seal)
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
// Eye), at ~a third of the core's size, so the core ring passes through its
// centre and is drawn as arcs that stop at it.
const SAT_SCALE = 0.33

// Compute a Frame per circle, plus a square viewBox that contains them all.
// Circles work in a centre-origin space; the viewBox is squared and padded so
// on-screen (100% width) and 2000x2000 export both stay undistorted, matching
// the author's square 1000 / 1500 / 2000 canvases.
function layout(compound: CompoundSeal): { frames: Frame[]; view: string } {
  const frames: Frame[] = new Array(compound.circles.length)
  frames[0] = baseFrame(0, 0) // core

  let concentric = 0
  let nested = 0
  const satellites: number[] = []
  compound.circles.forEach((node, i) => {
    if (i === 0) return
    if (node.placement === "beside") satellites.push(i)
  })

  compound.circles.forEach((node, i) => {
    if (i === 0) return
    if (node.placement === "concentric") {
      const level = ++concentric
      const ringOuter = R_OUTER + level * CONCENTRIC_BAND
      frames[i] = {
        cx: 0,
        cy: 0,
        ringOuter,
        ringInner: ringOuter - 58,
        ringPlain: ringOuter - 15,
        daggerR: ringOuter - 96, // daggers sit in the new outer band
        modR: ringOuter - 40,
        bandR: ringOuter - 28,
        scale: 0.72,
        stroke: 5,
        drawHeart: false,
      }
    } else if (node.placement === "inside") {
      const level = ++nested
      const ringOuter = Math.max(120, 250 - (level - 1) * 70) // small ring(s) within the core
      frames[i] = {
        cx: 0,
        cy: 0,
        ringOuter,
        ringInner: ringOuter - 40,
        ringPlain: ringOuter - 12,
        daggerR: Math.max(64, ringOuter - 64),
        modR: ringOuter - 22,
        bandR: ringOuter - 18,
        scale: 0.42,
        stroke: 4,
        drawHeart: false,
      }
    }
  })

  // Satellites sit with their centre exactly ON the core ring, spaced evenly
  // from the top. The core ring is drawn as arcs that stop at each satellite
  // (see ringCircle), so a satellite reads as sitting on the rim with no line
  // crossing it, exactly as the source draws Telekinesis and Floating Eye.
  const satDist = R_OUTER
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

// The linking sigil for one edge. For a satellite link it sits radially in the
// clear gap between the core's inner content and the satellite, pointing toward
// the target circle (inward when the target is the core, outward when it is the
// satellite), the way the source arrows run between the core and each auxiliary.
// For a shared centre (concentric / nested) it sits in the band between rings.
function linkSigil(edge: CompoundSeal["links"][number], frames: Frame[]): string {
  const f = frames[edge.from]
  const t = frames[edge.to]
  const key = `functions/${edge.type}`
  const dx = t.cx - f.cx
  const dy = t.cy - f.cy
  const dist = Math.hypot(dx, dy)
  if (dist < 5) {
    const rr = (f.ringOuter + t.ringOuter) / 2
    return onRing(f, key, rr, 35, 150)
  }
  // Satellite link: one endpoint is the core (it carries satAngles), the other a
  // satellite on the rim. Work from the core centre out along the satellite's
  // angle.
  const core = f.satSpecs ? f : t
  const aux = core === f ? t : f
  const aa = Math.atan2(aux.cx - core.cx, -(aux.cy - core.cy)) // radians, 0 = up
  const rLink = R_OUTER * 0.46
  const px = core.cx + rLink * Math.sin(aa)
  const py = core.cy - rLink * Math.cos(aa)
  const angleDeg = (aa * 180) / Math.PI
  // The link sigils are authored pointing right (like expel), so a radial
  // outward arrow needs angle - 90; inward is the opposite.
  const pointOut = edge.to !== 0 // target is the satellite -> point outward
  return place(key, px, py, 150, angleDeg + (pointOut ? -90 : 90))
}

export function composeCompound(compound: CompoundSeal): string {
  if (isSingle(compound)) return compose(compound.circles[0].seal)
  const { frames, view } = layout(compound)
  const circles = compound.circles.map((node, i) => circle(frames[i], node.seal)).join("")
  const links = compound.links.map((e) => linkSigil(e, frames)).join("")
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}">` + circles + links + `</svg>`
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
