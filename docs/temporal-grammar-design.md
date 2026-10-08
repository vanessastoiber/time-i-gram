# Temporal grammar design: branch `feat/temporal-grammar`

Status: **proposal, awaiting approval**. Nothing described here is implemented yet.

This branch adds four time-specific grammar features to time-i-gram. They are the features the paper already claims but the code lacks ([grammar-audit.md](grammar-audit.md) §2.1 items 5–8, §5):

1. Calendar granularity as syntax: units, date-string domains, durations, `timeUnit` aggregation, granularity transition rules.
2. Period-based cyclic layout (`period`).
3. Relative time scale (`relative`).
4. Spans (optional).

Reviewer requests addressed: R1 ("show by month" rather than raw timestamps) is addressed by feature 1. R2/R3 (no novel abstraction; unclear what is new versus Gosling) is addressed by features 2 and 3, plus the zoom-dependent part of feature 1. The Vega-Lite comparison for each feature says where time-i-gram goes beyond Vega-Lite and where it only matches it.

---

## 0. Ground rules

These hold for every feature below.

- **Coordinates stay in seconds.** A temporal x axis is still a linear scale over seconds, so HiGlass zoom, tiles, brushes and `visibility` thresholds keep working unchanged. The new features change *which* seconds a row maps to:
  - absolute: Unix seconds (today's behaviour);
  - period: seconds inside a fixed reference period (§2);
  - relative: signed seconds from an anchor (§3).

  Every temporal x axis therefore has one of three **time coordinate systems**: `absolute`, `period(unit, options)` or `relative`. Linking (§2.5) and validation are defined in terms of this coordinate system.
- **UTC everywhere.** Truncation, ISO weeks, period positions and labels are all computed in UTC, matching how the fetchers have parsed dates since Phase 1 (item 4).
- **Backward compatible.**
  - Every new property is optional.
  - Every place that took a number still takes the same number with the same meaning.
  - Every new property is accepted only on `type: "temporal"` channels and temporal views. Anywhere else it is a validation error, so genomic behaviour cannot change.
  - The existing experimental `aggregate` (`aggregateData`, which groups by one nominal field) keeps its current behaviour whenever `timeUnit` is absent.
- **Sugar is resolved early.** Date strings and durations are converted to numbers in `spec-preprocess.ts`, before the compiler or any track sees the spec. Granularity rules are expanded into plain tracks there too. Downstream code only ever sees numbers and plain tracks.
- **One shared module.** All calendar arithmetic lives in a new pure module, `src/core/utils/time-units.ts`, used by the preprocessor, the fetchers, the track and the axis, and unit-tested on its own. It provides `floor`, `offset`, `ceil`, ISO week, `parseTimeValue`, `parseDuration`, period position and key, and relative offset.

### Granularity hierarchy

```ts
type TimeUnit = 'millisecond' | 'second' | 'minute' | 'hour' | 'day'
              | 'week' | 'month' | 'quarter' | 'year' | 'decade';
```

- `week` is the **ISO week**: Monday 00:00 UTC to the next Monday.
- `quarter` starts in January, April, July and October.
- `decade` starts in a year divisible by 10.
- `floor(t, unit)` is the start of the unit containing `t`, so for instants before 1970 it rounds toward the past. For example, `floor(1969-12-31T12:00Z, day)` is `1969-12-31T00:00Z`.
- Units nest in order, with one exception: weeks do not nest in months, quarters, years or decades.

---

## 1. Calendar granularity as syntax

### 1.1 Date strings in temporal domains

**Syntax**

```jsonc
// x channel
"x": { "field": "date", "type": "temporal", "domain": { "interval": ["2000-01", "2010-12"] } }

// view-level, inherited by its tracks
{ "xDomain": { "interval": ["2016-04-12", "2016-05-12T23:59:59Z"] }, "tracks": [ … ] }

// numbers keep working, and the two forms can be mixed
"domain": { "interval": [946684800, "2010"] }
```

Accepted strings are:
- `YYYY`, `YYYY-MM`, `YYYY-MM-DD`;
- `YYYY-Www`: an ISO week, e.g. `2015-W53`;
- full ISO date-times, e.g. `2010-01-03T23:00:00Z` or `…+01:00`. A date-time without a zone is read as UTC, as in the fetchers.

Years may be before 1970 (e.g. `"1918-09"`). Years before 1000 must be written with four digits (`"0800"`).

**Semantics (for the paper).** *A date string as the start of a temporal domain denotes the first instant of the calendar unit it names; as the end it denotes the last instant of that unit, so `["2000-01", "2010-12"]` covers January 2000 through December 2010 inclusive. A full date-time denotes exactly that instant, and a number denotes Unix seconds.*

**Where it lives:** scale (domain). It replaces the `timeDomain` that the paper presents as grammar but that only exists as a JavaScript variable (audit §2.1(9)).

**Compiles to:** `spec-preprocess.ts` replaces every string in a temporal `interval` with Unix seconds, using `parseTimeValue` with the start/end rule above. `["2000-01", "2010-12"]` becomes `[946684800, 1293840000]`. Nothing downstream changes.

**Files:**
- `gosling.schema.ts`: `TimeInterval.interval: [TimeValue, TimeValue]`, with `TimeValue = number | string`. `xDomain` accepts `TimeInterval`.
- `time-units.ts`;
- `spec-preprocess.ts`;
- `validate.ts`: an unparseable string is an error that quotes the string.

**Interactions:**
- *Layouts:* same in linear and circular.
- *Brush, linkingId:* none; domains are numbers by the time they are compiled.
- *Semantic zoom:* none.
- *Tiling:* none.

**Not covered:**
- relative date expressions (`"now - 1 year"`);
- time zones other than UTC or an explicit offset;
- dates BCE;
- string domains on genomic views (an error, because `"2010"` would be ambiguous there).

### 1.2 Durations

**Syntax**

```jsonc
"visibility": [{ "measure": "zoomLevel", "operation": "lt", "threshold": "3 months", "target": "track" }]
"zoomLimits": ["1 hour", "20 years"]
"zoomLimits": [3600, null]            // numbers (seconds) keep working
```

A duration string is `<number> <unit>`. The unit is any `TimeUnit`, singular or plural, or one of the short forms `ms`, `s`, `min`, `h`, `d`, `wk`, `mo`, `q`, `y`. Examples: `"90 minutes"`, `"1.5 days"`, `"2 weeks"`.

**Semantics.** *A duration is a length of time in seconds. Units up to a week have their exact length; a month is 1/12 of a mean Gregorian year (30.436875 days), a quarter three such months, a year 365.2425 days and a decade ten years.*

A duration measures a span. It is not calendar arithmetic, which is used only in §1.3 and §4.

**Where it lives:** interaction. It applies to the thresholds of semantic zoom and to the zoom limits. Both compare against the visible span, which is in seconds on a temporal axis. HiGlass `zoomLimits` are `[min visible span, max visible span]` in x units (`hglib.js`, `calculateZoomLimits`), so durations apply to them directly.

**Compiles to:** `spec-preprocess.ts` replaces each duration string with seconds via `parseDuration`.

**Files:**
- `gosling.schema.ts`: `ZoomLevelVisibilityCondition.threshold: number | Duration`; `ZoomLimits = [number | Duration | null, number | Duration | null]`; the doc comments are updated.
- `time-units.ts`;
- `spec-preprocess.ts`;
- `validate.ts`: a duration on a genomic track or view is an error.

**Interactions:**
- *Layouts:* same in linear and circular. The visible span of a circular track is its domain span.
- *Brush, linkingId:* none.
- *Semantic zoom:* this is its main use.
- *Tiling:* none.

**Not covered:**
- calendar-exact spans: `"1 month"` is always 30.44 days, whichever month is visible;
- size-based visibility thresholds, which stay in pixels.

### 1.3 Aggregation by calendar unit: `timeUnit`

`timeUnit` has two forms. The **transform** truncates rows, one by one. The **channel property** is the "show by month" form: it truncates, and when another channel aggregates, it groups.

**Syntax**

```jsonc
// (a) transform: truncate a field and keep every row
"dataTransform": [
  { "type": "timeUnit", "field": "date", "unit": "month", "newField": "month", "endField": "monthEnd" }
]

// (b) channel: "unemployment by month, summed over industries"
"x": { "field": "date", "type": "temporal", "timeUnit": "month" },
"y": { "field": "count", "type": "quantitative", "aggregate": "sum" }

// (b) with a nominal channel: one monthly mean per series
"x": { "field": "date", "type": "temporal", "timeUnit": "quarter" },
"y": { "field": "rate", "type": "quantitative", "aggregate": "mean" },
"color": { "field": "series", "type": "nominal" }
```

`Aggregate` gains `sum` and `median`. The full set becomes `count | sum | mean | median | min | max`; the existing `bin` keeps its current meaning.

**Semantics.**
- *Transform:* `timeUnit` replaces a time value by the start of the calendar unit that contains it (`newField`, or the field itself if `newField` is absent). It can also write the start of the next unit (`endField`), so that each row spans its unit.
- *Channel:* when the x channel has a `timeUnit`, every record is placed at the start of its unit. If any channel of the track has an `aggregate`, the records are grouped by that unit and by the values of the track's nominal channels (color, row, stroke, …), and each aggregated channel is reduced with its operation, giving one mark per unit and group.

**Where it lives.**
- The transform lives in `dataTransform`, because it is a per-row derivation like `log` or `concat`.
- The channel form lives in the encoding, because it is the declarative "show by month" request R1 asks for, as in Vega-Lite.
- The channel form is **sugar for the transform** plus a group-by step. `bar` and `rect` marks without `xe` also get `xe = endField`, so a bar spans its whole month.

**Compiles to:**
- **Preprocessing.** `x.timeUnit: u` becomes a `timeUnit` transform appended to the track's `dataTransform`, writing into internal fields `__<field>_<u>` and `__<field>_<u>_end`. `x.field` (and `xe.field` for bar/rect) is rewritten to those fields. The aggregated channels are recorded as an internal `_timeAggregate` spec on the track.
- **Track.** `gosling-track.ts` runs the dataTransforms as today, then a new `aggregateByTimeUnit` (`data-transform.ts`) when `_timeAggregate` is present.
- **Tile exactness.** Transforms run per tile, and tile edges are arbitrary seconds, so a month straddling two tiles would be aggregated twice, once per partial month. The fix has two parts:
  - The time fetchers learn the units used by the HiGlass track's sub-tracks, passed as an internal `timeUnits` entry in `hgTrack.data` (`gosling-to-higlass.ts`). A row then belongs to tile `(minX, maxX]` if `floor(t, u)` lies in it for **any** used unit `u`. Raw, untruncated tracks keep `t` itself.
  - Before transforming, `gosling-track.ts` keeps for each sub-track only the rows whose `floor(t, u_track)` lies in that tile.

  Each unit therefore lands entirely in exactly one tile, even when overlaid sub-tracks use different units (needed by §1.4).

**Files:**
- `gosling.schema.ts`: `TimeUnitTransform`, `X.timeUnit`, `Aggregate`;
- `time-units.ts`;
- `data-transform.ts`;
- `spec-preprocess.ts`;
- `gosling-track.ts`;
- `gosling-to-higlass.ts`;
- `csv-time-data-fetcher.ts`, `json-time-data-fetcher.ts`;
- `validate.ts`.

**Interactions:**
- *Linear/circular:* identical.
- *Period channel (§2):* units are truncated in absolute time and then mapped into the period. Monthly means per year on a year ring therefore work. The unit must be finer than the period: `timeUnit: "year"` with `period: "year"` is an error.
- *Relative channel (§3):* units count from the anchor (`[a + k·u, a + (k+1)·u)`). Only fixed-length units, up to `week`, are allowed there.
- *Brush, linkingId:* none; the coordinates are still seconds.
- *Semantic zoom:* see §1.4.
- *Tiling:* as above, exact for `csv-time` and `json-time`. Other data sources with a temporal x, such as plain `json` with Unix seconds, aggregate per tile, which is documented as approximate.

**Not covered:**
- weeks other than ISO weeks (no Sunday-based US weeks);
- fiscal years, except through `period.start` in §2;
- weighted means;
- aggregation of `xe` intervals by overlap (an interval is assigned by its start);
- lines and areas still break at tile boundaries (inherited; bugfix report, follow-ups).

### 1.4 Granularity transition rules

This is the smallest construct that lets a track change granularity with zoom. It is **pure sugar over `timeUnit` + `visibility`**, and the paper should say so.

**Syntax**

```jsonc
// daily below 3 months of visible time, weekly below 2 years, monthly above
"x": {
  "field": "date", "type": "temporal",
  "timeUnit": [
    { "unit": "day",   "maxSpan": "3 months" },
    { "unit": "week",  "maxSpan": "2 years" },
    { "unit": "month" }
  ]
},
"y": { "field": "count", "type": "quantitative", "aggregate": "sum" }
```

```jsonc
// raw data when zoomed in, yearly means when zoomed out
"timeUnit": [ { "unit": "none", "maxSpan": "5 years" }, { "unit": "year" } ]
```

**Semantics.** *A granularity transition rule list orders time units from fine to coarse, each with the largest visible span (`maxSpan`) at which it applies; at any zoom level the track is drawn at the first unit whose `maxSpan` exceeds the visible time span, and the last rule has no limit.*

Rules:
- `maxSpan` is a duration (§1.2) and must increase along the list.
- `unit: "none"` means the rows are not truncated.

**Where it lives:** encoding (`x.timeUnit` takes a unit or a rule list). Its effect is interaction, i.e. semantic zoom.

**Compiles to:** `spec-preprocess.ts` replaces the track with an overlay of *n* copies:
- copy *i* gets `x.timeUnit = unit_i`, plus `visibility` conditions `[{ measure: "zoomLevel", operation: "gtet", threshold: maxSpan_{i-1} }, { measure: "zoomLevel", operation: "lt", threshold: maxSpan_i }]`, with `target: "track"`;
- the first copy has no lower bound and the last has no upper bound;
- any `visibility` the user wrote is kept on every copy and ANDed, which is how `trackVisibility` already combines conditions.

The copies share `data`, so they become one HiGlass track with one fetcher, and §1.3 keeps every unit tile-exact. No new runtime code is needed.

**Files:** `gosling.schema.ts` (`TimeUnitRule`), `spec-preprocess.ts`, `validate.ts` (ordering, last rule without `maxSpan`).

**Interactions:**
- *Linear/circular:* identical.
- *Brush and linked views:* each view switches on its own visible span. Linked views with equal widths share a span, so they switch together.
- *Tiling:* as in §1.3.

**Not covered:**
- **Smooth transitions:** the switch is abrupt. `transitionPadding` only applies to `target: "mark"`.
- **Pixel-based switching** ("at most one bar per 3 px"): this would need a new visibility measure.
- **Other properties switching with zoom,** such as mark or color. Users can still write overlays with `visibility` by hand for that.

### 1.5 Vega-Lite comparison (feature 1)

| Capability | Vega-Lite | time-i-gram |
|---|---|---|
| Calendar units, truncation, aggregation by unit | **Native**: `timeUnit` on encodings and as a transform, `utc` variants, all aggregates. | Same expressiveness: **parity, not novelty.** Differences: an ISO `week` (Vega-Lite's `week` starts on Sunday), a `decade` unit, and exact results under tiled loading. |
| Date strings in domains | **Native** (DateTime objects / date strings in `scale.domain`) | Parity. Adds the inclusive end-of-unit reading of partial dates. |
| Durations as literals | **Not available**: Vega-Lite has no duration type, and its zoom is not bounded by a span. | New, but minor. |
| Granularity that changes with zoom | **Workaround:** an interval selection bound to the scales, plus layers filtered by an expression on the selection's extent (e.g. `span(brush.date) < 90*864e5`). This needs Vega expressions, and all data stays in memory. | **Native** as one channel property (§1.4), with tile-based loading. |

---

## 2. Period-based cyclic layout: `period`

### 2.1 Syntax

```jsonc
// Fig 1A: one ring, every flu season on top of the others, coloured by ISO week-year
{
  "layout": "circular",
  "data": { "type": "csv-time", "url": ".../who_flu_usa.csv",
            "dateFields": ["ISO_YEAR", "ISO_WEEK"], "includesCalendarWeek": true },
  "mark": "line",
  "x": { "field": "ISO_YEAR", "type": "temporal", "period": { "unit": "year", "weekBased": true }, "axis": "top" },
  "y": { "field": "INF_A", "type": "quantitative" },
  "color": { "field": "ISO_YEAR_year", "type": "nominal", "legend": true }
}
```

```jsonc
// one concentric ring per year (row channel), monthly means
"x":   { "field": "date", "type": "temporal", "period": "year", "timeUnit": "month" },
"y":   { "field": "rate", "type": "quantitative", "aggregate": "mean" },
"row": { "field": "date_year", "type": "nominal" }
```

```jsonc
// daily cycle: taxi pickups by time of day, linear, one line per weekday
"x":     { "field": "pickup_datetime", "type": "temporal", "period": "day", "timeUnit": "hour" },
"y":     { "field": "id", "type": "quantitative", "aggregate": "count" },
"color": { "field": "pickup_datetime_day", "type": "nominal" }
```

`period` takes one of the units `"year" | "month" | "week" | "day"`, or an object:

```ts
interface Period {
  unit: 'year' | 'month' | 'week' | 'day';
  /** Field that receives each row's period (e.g. "2010"). Default: `<field>_<unit>` */
  newField?: string;
  /** Years made of ISO weeks: week 1 is the start of the period (only for unit "year"). Default: false */
  weekBased?: boolean;
  /** Where the period begins: a month (1-12) for calendar years, an ISO week (1-53) for week-based
   *  years, a weekday (1 = Monday) for weeks, an hour (0-23) for days. Default: the first. */
  start?: number;
}
```

### 2.2 Semantics (for the paper)

*A period channel positions each instant by its place within its calendar period: its month, day and time for a year; its weekday and time for a week; its time of day for a day. All periods therefore share one axis, or one revolution in a circular layout. Each record also receives the period it belongs to as a field, which can be encoded like any other field, e.g. with color to overlay periods or with row to draw one ring per period.*

Precise rules:

- **Calendar-date alignment.** Positions are expressed inside a fixed reference period, and the axis labels positions within the period, never absolute dates.
  - **Year:** the reference is the leap year 2000, so 1 March is at the same angle in every year. Feb 29 has a place, and non-leap years leave a one-day gap there (0.27% of the ring).
  - **Month:** days 1–31 (reference January 2000). Days 29–31 only occur in some months.
  - **Week:** Monday 00:00 → Sunday 24:00.
  - **Day:** 00:00 → 24:00.
- **Week-based years** (`weekBased: true`).
  - *Position:* `(ISO week − 1) · 7 days + (ISO weekday − 1) · 1 day + time of day`, inside a 53-week reference ISO year.
  - *Period key:* the ISO week-year.
  - *Result:* week 1 is always at the start of the ring, even when it begins on 29 December. This removes the hand-made `who_flu_usa_superimposed` file and its misplaced week-1 points (audit §7.3, S7).
  - *Week 53:* exists only in long ISO years. In other years the last week of the ring is empty.
- **Shifted periods** (`start`).
  - *Example:* `{ unit: "year", start: 8 }` makes each period run from 1 August to 31 July. With `weekBased`, `start: 40` makes it run from ISO week 40, the usual flu season.
  - *Keys:* a shifted year's key names both years: `"2010/11"`.
- **Period keys** are strings that sort chronologically:

  | Period | Key example |
  |---|---|
  | year, week-based year | `"2010"` |
  | shifted year | `"2010/11"` |
  | month | `"2010-03"` |
  | week | `"2010-W05"` |
  | day | `"2010-03-01"` |

### 2.3 Where it lives and why

It lives in the **encoding**, as a property of the temporal x channel. It changes how a time value maps onto the x scale, i.e. it sets the time coordinate system. It is not a transform the user writes, for three reasons:

- the x scale's domain becomes the period;
- the axis has to label within-period positions;
- linking has to know that this axis is not absolute time.

It is also not a layout, because the same property works in `linear` (superposed periods) and `circular` (one revolution per period). The layout is unchanged: `layout: "circular"` still maps the x domain to one revolution, and `period` makes that domain one period long.

### 2.4 How it compiles

1. **`spec-preprocess.ts`:**
   - normalizes `period` to its object form;
   - sets the x domain to the reference period if no domain is given (in v1 a domain on a period channel is an error, see Not covered);
   - rewrites `x.field` (and `xe` / `x1` / `x1e` when they are temporal) to an internal coordinate field `__<field>_p`;
   - keeps the original field untouched, so tooltips still show the real date.
2. **`gosling-to-higlass.ts`:**
   - adds an internal `period: { unit, weekBased, start, sourceFields, coordFields, keyField }` to `hgTrack.data`. The fetcher's tile filter already uses `x` / `xe` from `hgTrack.data`, and those are now the coordinate fields.
   - passes `timeScale: { kind: "period", unit, weekBased, start }` to the time axis track (`higlass-model.ts`, `setUnixTimeTrack`).
3. **Fetchers** (`csv-time`, `json-time`): after parsing, a shared `applyPeriod(row, config)` in `time-units.ts` writes the coordinate fields and the key field. An `x`/`xe` interval that crosses a period boundary is split at the boundary into two rows, each with the key of the period it lies in.
4. **Time axis** (`unix-time-track.ts`): tick positions still come from d3 `scaleUtc` over the reference period, so month ticks fall on real month starts. Tick *labels* use a period format without the year:

   | Period | Labels |
   |---|---|
   | year | `Jan`…`Dec`; zoomed in: `Jan 15` |
   | week-based year | `W1`, `W5`, … |
   | month | `1`…`31` |
   | week | `Mon`…`Sun`; zoomed in: `Mon 06:00` |
   | day | `00:00`…`23:00` |

**Files:**
- `gosling.schema.ts`: `X.period`, `Period`;
- `time-units.ts`;
- `spec-preprocess.ts`;
- `gosling-to-higlass.ts`, `higlass-model.ts`;
- both fetchers (plus `includesCalendarWeek` accepting week 53, which today's regex rejects);
- `unix-time-track.ts`;
- `validate.ts`;
- `create-higlass-models.ts` (linking, below).

### 2.5 Interactions

- **Circular:** one revolution = one period. Concentric rings per period come from `row` on the key field (rows are radial bands in circular layouts). Overlaid periods come from `color`.
- **Linear:** periods are superposed on one axis. Zooming into a period view zooms into the within-period positions, e.g. the winter weeks of every year at once.
- **`timeUnit`** (§1.3) works inside a period. **`relative`** (§3) cannot be combined with `period` on the same channel; that is an error.
- **Semantic zoom:** the visible span is measured in period seconds, so `"threshold": "2 months"` means two months of the ring.
- **Tiling:** each tile covers part of the reference period and holds rows from *all* periods at those positions. The fetcher filters on the coordinate field, so tiling is correct without changes to HiGlass.
- **Brush and `linkingId` — decision:** linking is allowed only between views with the **same time coordinate system**:
  - absolute with absolute;
  - period with period of the same `unit`, `weekBased` and `start`;
  - relative with relative.

  If one `linkingId` joins views with different systems, for example a period ring and an absolute timeline:
  - validation reports a warning naming the `linkingId` and the two systems;
  - the compiler leaves the mismatched views **out of that zoom/location lock and out of that brush**;
  - the rest of the spec renders.

  *Why not a mapping?* A within-period position, e.g. "15 March", corresponds to many absolute instants. The opposite direction, absolute → period, is defined but not one-to-one (an interval longer than a period covers the whole ring). Silently linking the raw seconds, which is what happens today, would make the absolute view jump to 2000 whenever the ring is touched. A *highlight mapping* is left as future work: brushing a ring would highlight the matching window in every period of an absolute view.

  Linking *within* a period space is useful and supported. Example: a year ring with a brush, linked to a linear period view that shows the brushed weeks of every year.

### 2.6 Not covered

- **Custom domains on a period channel** (e.g. only Oct–Mar). In v1 the period channel always starts at the full period; use zoom, a brush or `start`.
- **Periods that are not calendar units:** a 7-day period starting on an arbitrary day of the dataset, solar years, or lunar months.
- **A period unit at or below the data's own granularity,** e.g. `period: "day"` for daily data. This is accepted, but every row lands at 00:00.
- **Proportional alignment.** Non-leap years leave a gap at Feb 29; the alternative, stretching each year to the full circle, was rejected because it misaligns dates.
- **Temporal y** (out of scope).

### 2.7 Vega-Lite comparison (feature 2)

| Capability | Vega-Lite | time-i-gram |
|---|---|---|
| Superposed periods on a **linear** axis | **Native**: `x: { timeUnit: "monthdate" }` + `color: { timeUnit: "year" }` (Vega-Lite also uses a leap reference year) | Parity |
| Periodic **bar/rose** on a circle | **Native**: `arc` mark with `theta: { timeUnit: "month" }` | Parity |
| Periodic **line/area** around a circle, with a time axis | **Workaround:** compute x/y with `calculate` (sin/cos) on a point/line chart. No polar axis, no polar zoom. | **Native** (`layout: "circular"` + `period`) |
| ISO week-years with week 1 at the start | **Workaround:** `calculate` with Vega expressions for the ISO week. Vega-Lite's `week` is Sunday-based. | **Native** (`weekBased: true`) |
| One concentric ring per period | **Workaround:** `radius` offset per year in an `arc` layer; bars only | **Native** (`row` on the period key) |
| Zoomable cyclic view linked to linear views (brush on the ring) | **Not possible:** interval selections are not supported on `theta`/`radius`, and polar views cannot zoom. | **Native** (same-period linking, §2.5) |
| Seasons not starting in January (`start`) | **Workaround** (`calculate`) | **Native** |

This is the clearest place where time-i-gram goes beyond Vega-Lite: **a continuous, zoomable, circular periodic layout with per-period addressability, linked to other multi-scale views.**

---

## 3. Relative time scale: `relative`

### 3.1 Syntax

```jsonc
// unemployment aligned to the collapse of Lehman Brothers, in months
"x": { "field": "date", "type": "temporal",
       "relative": { "anchor": "2008-09-15", "unit": "month" },
       "domain": { "interval": ["-36 months", "24 months"] } }
```

```jsonc
// flu seasons aligned to their own peak (data: dateFields: ["ISO_SDATE"], so ISO_YEAR stays a raw column)
"x": { "field": "ISO_SDATE", "type": "temporal",
       "relative": { "anchor": { "argmax": "INF_A" }, "groupby": "ISO_YEAR", "unit": "week" } }
```

```jsonc
// patients aligned to their first record, or to a date column
"relative": { "anchor": "first", "groupby": "patient_id", "unit": "day" }
"relative": { "anchor": { "field": "diagnosis_date" }, "unit": "day" }
```

```ts
interface Relative {
  /** The reference event (offset 0):
   *  - a date (string as in §1.1, or Unix seconds): the same instant for all rows;
   *  - "first" | "last": the earliest / latest time in the row's group;
   *  - { argmax: field } | { argmin: field }: the time of the group's largest / smallest value of `field`
   *    (ties: the earliest);
   *  - { field: name }: a per-row reference time read from a column (parsed like `dateFields`). */
  anchor: TimeValue | 'first' | 'last' | { argmax: string } | { argmin: string } | { field: string };
  /** Field(s) that define the groups for "first", "last", argmax and argmin. Default: all rows form one group. */
  groupby?: string | string[];
  /** Unit of the axis labels ("-2 wk", "0", "+3 wk") and of `timeUnit` bins. Default: chosen from the visible span. */
  unit?: TimeUnit;
}
```

### 3.2 Semantics (for the paper)

*A relative time channel positions each record at its signed offset from a reference event of its group (a fixed date, the group's first or last record, the time of the group's maximum or minimum of a field, or a date read from the record itself). The axis shows these offsets in a chosen unit, with 0 at the reference event, so that series that happened at different times are compared from a common origin.*

Precise rules:
- Offsets are in seconds.
- `unit` only affects ticks and labels, plus `timeUnit` binning (§1.3), which counts whole units from the anchor.
- Units up to a week are exact. `month`, `quarter`, `year` and `decade` are labelled with the nominal lengths of §1.2: `+3 mo` = 3 × 30.44 days.
- A domain on a relative channel is given in offsets, as durations or seconds. A leading `-` makes a duration negative.
- If no domain is given, the default is ±1 year, and validation warns that a domain should be set.

### 3.3 Transform, scale type, or both?

**To the user it is a scale property; inside, it is computed by a load-time transform.**

- **Syntax:** `relative` sits on the x channel, next to `domain` and `period`, because it defines the x scale: its origin, its units and its labels. It also defines the time coordinate system that linking checks (§2.5).
- **Implementation:** the offsets are computed when the data are loaded, in the fetcher. This cannot be an ordinary `dataTransform`, for two reasons:
  - "first record of each group" and argmax need the *whole* dataset, while `dataTransform`s run per tile;
  - the tile filter must already see offsets.

There is no separate user-facing `relative` transform. Someone who wants offsets as a plain number can still compute them in their own data.

### 3.4 How it compiles

1. **`spec-preprocess.ts`:** normalizes `anchor`, parses date anchors and duration domains, and rewrites the temporal x fields to `__<field>_r`.
2. **`gosling-to-higlass.ts`:**
   - adds an internal `relative: { anchor, groupby, sourceFields, coordFields }` to `hgTrack.data`;
   - passes `timeScale: { kind: "relative", unit }` to the axis.
3. **Fetchers:** once all rows are parsed, `applyRelative(rows, config)` in `time-units.ts`:
   - computes one anchor per group in a single pass;
   - writes `t − anchor` into the coordinate fields;
   - drops rows whose group has no valid anchor, with one warning per data source.
4. **Time axis:**
   - *Ticks:* nice multiples of the unit, from d3 `ticks` on the offset domain divided by the unit length.
   - *Labels:* `-2 wk`, `0`, `+3 wk`. The short unit names are `ms`, `s`, `min`, `h`, `d`, `wk`, `mo`, `q`, `y`, `dec`.

**Files:**
- `gosling.schema.ts`: `X.relative`, `Relative`;
- `time-units.ts`;
- `spec-preprocess.ts`;
- `gosling-to-higlass.ts`, `higlass-model.ts`;
- both fetchers;
- `unix-time-track.ts`;
- `validate.ts`;
- `create-higlass-models.ts`.

### 3.5 Interactions

- **Linear:** the natural layout. **Circular:** allowed, as a ring of offsets, but rarely useful.
- **`period` and `relative` on the same channel:** an error.
- **`timeUnit`:** bins are `[anchor + k·u, anchor + (k+1)·u)`. Only units up to `week` are allowed here; coarser units are an error.
- **Brush, `linkingId`:**
  - relative views link with each other (shared offset space);
  - linking a relative view to an absolute or period view gets the treatment of §2.5 (warning, not linked);
  - two relative views with different anchors are linked without a warning, because the offsets are comparable by construction.
- **Semantic zoom:** thresholds are spans of offsets, so durations work unchanged.
- **Tiling:** the tile filter runs on the offset field. A data source's anchors are computed once per load, not per tile, so they do not depend on what is visible.

### 3.6 Not covered

- **Groups or anchors computed by `dataTransform`s:** `groupby` and anchor fields must be data columns or period keys, because anchors are computed before tiling. Period keys are available only if the same data source also declares a period; that case is rare, and documented.
- **Anchors from another data source.**
- **Several reference events per group,** e.g. aligning both onset and peak by stretching time between them (time warping).
- **Calendar-exact month and year offsets.**

### 3.7 Vega-Lite comparison (feature 3)

| Capability | Vega-Lite | time-i-gram |
|---|---|---|
| Offset from a fixed date | **Workaround:** `calculate: "datum.date - datetime(2008,8,15)"`, a quantitative x, and `axis.labelExpr` to print "+3 mo" | **Native** (`relative.anchor: "2008-09-15"`) |
| Per-group anchor (first / argmax) | **Workaround:** `joinaggregate` (`min` or `argmax`) + `calculate` + `labelExpr`, about 3–4 constructs | **Native** (one property) |
| Offset-aware binning | **Workaround:** a `bin` transform on the offset with `step`; no calendar units | **Native** for fixed-length units (`timeUnit` counted from the anchor) |
| Linked zoomable aligned views | Interval selections on the quantitative offset: **possible**, but data is not tiled | **Native**, with tiles |

Be honest in the paper: Vega-Lite *can* express a relative timeline with a workaround. time-i-gram's contribution is making the reference event and its unit a **first-class scale concept**, with offset labels, offset domains, anchor-relative binning, and coordinate-aware linking.

---

## 4. Spans (optional, only if time allows)

### 4.1 Syntax

```jsonc
// taxi trips from start + duration in seconds
"dataTransform": [ { "type": "span", "field": "pickup_datetime", "duration": "trip_duration",
                     "unit": "second", "newField": "dropoff_est" } ],
"x":  { "field": "pickup_datetime", "type": "temporal" },
"xe": { "field": "dropoff_est", "type": "temporal" }
```

```jsonc
// a fixed span: every event lasts 2 weeks
{ "type": "span", "field": "start", "duration": "2 weeks", "newField": "end" }
```

`duration` is either the name of a numeric column, interpreted in `unit`, or a duration literal (§1.2).

### 4.2 Semantics

*A span is a duration that is not tied to a position in time; combined with a start field it yields an interval that ends `duration` later.*
- Fixed-length units are added exactly.
- `month`, `quarter`, `year` and `decade` are added on the calendar (31 January + 1 month = 29 February 2000), clamped to the last day of the month.
- Negative durations give intervals that end before they start; they are reported as an error.

### 4.3 Where, compiles to, files

- **Where:** `dataTransform`. It is a per-row derivation, and it is tile-safe: a row belongs to the tile of its start, as intervals already do today.
- **Compiles to:** `addSpan` in `data-transform.ts`, dispatched in `gosling-track.ts`.
- **Files:** `gosling.schema.ts` (`SpanTransform`), `data-transform.ts`, `gosling-track.ts`, `time-units.ts`.

### 4.4 Interactions and limits

- **Period channel:** a span that crosses the period boundary is *not* split, because the transform runs after the fetcher's split (§2.4). It is clipped at the period end, with a warning.
- **Not covered:** a *duration axis*. A span shown on its own, e.g. as bar length, stays an ordinary quantitative field with no "2 h 30 min" labels.
- **Vega-Lite:** a **workaround** with `calculate` (`datum.start + datum.dur * 1000`) or `timeOffset('month', datum.start, n)` for calendar units, then `x` / `x2`. time-i-gram only adds the declarative form: parity with convenience, not novelty.

---

## 5. Summary: new versus Gosling versus Vega-Lite

| Feature | In Gosling.js? | Vega-Lite | Contribution |
|---|---|---|---|
| Date-string domains | no | native | parity (+ inclusive partial dates) |
| Durations in zoom thresholds / limits | no | n/a (no semantic zoom) | new, minor |
| `timeUnit` truncation + aggregation | no (numeric `aggregate` only) | native | parity; exact under tiles |
| Granularity transition rules | no | workaround (params + filter) | **new** declarative semantic zoom by calendar unit |
| `period` (linear) | no | native (`monthdate` etc.) | parity |
| `period` (circular line/area, rings per period, ISO week-years, shifted seasons) | no (one revolution = whole domain) | workaround / not possible | **new** |
| Linked, zoomable periodic views; coordinate-aware linking | no | not possible | **new** |
| `relative` time scale | no | workaround (3–4 constructs + `labelExpr`) | **new as a scale concept** |
| Spans | no | workaround | convenience |

**Suggested framing for R2/R3.** Gosling provides the tiled, linked, multi-scale substrate. time-i-gram adds a calendar-aware *time coordinate system* on top of it (absolute, periodic or relative), plus calendar granularity that can change with zoom.

## 6. Test plan (Phase B)

**Unit tests** (vitest) for `time-units.ts`:
- `floor` / `offset` for every unit, including pre-1970 instants;
- year boundaries;
- 29 Feb, and 29 Feb + 1 year;
- ISO weeks: 2015-W53, 2009-W53, 2014-W01 = 2013-12-30, 2010-W01 = 2010-01-04;
- `parseTimeValue`: start and end rule, `YYYY-Www`, offsets, string vs. numeric;
- `parseDuration`: plural and short forms, negative values, rejects.

**Feature tests:**
- the transform and the aggregation, including tile exactness (a month split across two tiles gives one correct value);
- rule expansion;
- period position, key, `weekBased`, `start`, and the boundary split;
- relative anchors (fixed, first, last, argmax ties, field, missing anchor);
- axis labels per kind;
- link validation;
- schema validity of all examples.

**Checks after each commit:** `npx vitest run` and `npx tsc --noEmit`.
