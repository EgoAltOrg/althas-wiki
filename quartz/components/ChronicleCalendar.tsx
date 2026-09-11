import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
// @ts-ignore
import script from "./scripts/chronicle.inline"
import style from "./styles/chronicle.scss"
import { classNames } from "../util/lang"

// The Chronicle's month-grid navigation layer. This component renders only the
// static shell; chronicle.inline.ts indexes the page's already-rendered date
// sections (Quartz renders all content, including the gm-strip upstream in
// sync) and drives the grid. Mounted behind a slug check in quartz.layout.ts
// so it renders only on setting/chronicle. Without JS the page is a plain
// readable chronicle and this shell stays empty.
export default (() => {
  const ChronicleCalendar: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
    const fm = fileData.frontmatter as Record<string, unknown> | undefined
    const currentDate =
      typeof fm?.["current-date"] === "string" ? (fm["current-date"] as string) : ""
    return (
      <div class={classNames(displayClass, "chronicle-calendar")} data-current-date={currentDate}>
        <div class="chronicle-nav">
          <button type="button" class="chronicle-btn chronicle-prev" aria-label="Previous month">
            &larr;
          </button>
          <span class="chronicle-month-label" aria-live="polite"></span>
          <button type="button" class="chronicle-btn chronicle-next" aria-label="Next month">
            &rarr;
          </button>
          <button type="button" class="chronicle-btn chronicle-today-btn">
            Today
          </button>
        </div>
        <div class="chronicle-grid-wrap">
          <div class="chronicle-grid"></div>
        </div>
        <ul class="chronicle-legend">
          <li>
            <span class="chronicle-swatch swatch-weekend"></span> Weekend
          </li>
          <li>
            <span class="chronicle-swatch swatch-prayer"></span> Prayer
          </li>
          <li>
            <span class="chronicle-swatch swatch-event"></span> Recorded day
          </li>
          <li>
            <span class="chronicle-swatch swatch-today"></span> Today
          </li>
        </ul>
      </div>
    )
  }
  ChronicleCalendar.css = style
  ChronicleCalendar.afterDOMLoaded = script
  return ChronicleCalendar
}) satisfies QuartzComponentConstructor
