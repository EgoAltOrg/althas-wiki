import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
// @ts-ignore
import script from "./scripts/sealcarver.inline"
import style from "./styles/sealcarver.scss"
import { classNames } from "../util/lang"

// The player-facing Sealcarver. Like DiceRoller, this component renders only
// the static shell; all behavior lives in sealcarver.inline.ts, which bundles
// the sigil art (generated sigils.gen.ts) at build time so the page makes
// zero external requests and PNG export never taints its canvas. Mounted
// behind a slug check in quartz.layout.ts so it appears only on /sealcarver.
// Sigil art: Codex of Arcane Arts, Roc Humet Vidal, CC-BY 4.0 (attribution
// callout lives in content/sealcarver.md).
export default (() => {
  const Sealcarver: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
    return (
      <div class={classNames(displayClass, "sealcarver")}>
        <div class="sc-canvas" aria-label="Your seal"></div>
        <p class="sc-name" aria-live="polite"></p>

        <div class="sc-toolbar" role="group" aria-label="Seal actions">
          <button type="button" class="sc-btn sc-surprise">
            Surprise me
          </button>
          <button type="button" class="sc-btn sc-share">
            Copy link
          </button>
          <button type="button" class="sc-btn sc-save-svg">
            SVG
          </button>
          <button type="button" class="sc-btn sc-save-png">
            PNG
          </button>
          <button type="button" class="sc-btn sc-save-png-t">
            PNG (transparent)
          </button>
        </div>
        <div class="sc-save-preview"></div>

        <div class="sc-circles" role="tablist" aria-label="Circles"></div>
        <div class="sc-circle-config"></div>

        <section class="sc-editor">
          <h3>The Heart</h3>
          <div class="sc-zone-heart"></div>
          <h3>The Daggers</h3>
          <div class="sc-zone-daggers"></div>
          <h3>The Ring</h3>
          <div class="sc-zone-ring"></div>
        </section>

        <section class="sc-gallery-section">
          <h2>Codex Seals</h2>
          <p class="sc-gallery-hint">
            Seal designs recorded by Codex casters for the spells of the three known grimoires. Tap
            one to load it onto the slate.
          </p>
          <div class="sc-gallery"></div>
        </section>
      </div>
    )
  }

  Sealcarver.css = style
  Sealcarver.afterDOMLoaded = script

  return Sealcarver
}) satisfies QuartzComponentConstructor
