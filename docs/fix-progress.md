# Fix progress: review findings and example quality (`feat/temporal-grammar`)

Status as of 2026-10-08. Sources: [review-temporal-grammar.md](review-temporal-grammar.md) (section A) and the requests for performance (B), example quality (C) and editor thumbnails (E1).

**State:** every commit is pushed to `denisseram/feat/temporal-grammar`. The last code commit is `0b05f99`. The suite has 394 tests, all passing, and `tsc --noEmit` is clean. Nothing is half-done.

**Genomic check:** compiled output of all 57 genomic and doc examples is identical to `fix/temporal-bugs`. `MATRIX` differs only by its random demo data, the same as base vs base.

## A. Review findings

| Item | Status | Commit |
|---|---|---|
| S1 `quarter` in a shifted year | Done | `6e2ef31` |
| S2 links dropped by view order | Done | `de5638d` |
| S3 `displace` back on the upstream path + `docs/upstream-proposals.md` | **Next** (group 2) | |
| S4 week labels overlap | To do (group 2) | |
| S5 temporal-only properties on genomic x | Done: a schema error (an `if`/`then` on `X`, added in `scripts/generate-schemas.mjs`) and a compiler warning | `e2452d1` |
| S6 ring draws rows outside the visible arc | To do (group 2) | |
| S7 period ticks before the period; no zoom limit | Done | `68b0cb8` |
| S8 empty rule list deletes the track | Done: the track falls back to raw rows with a warning; schema `minItems: 1` | `1749e80` |
| S9 partial yearly unit at the data edge | To do (example + one sentence in the semantics) | |
| M1 ring brush notch | To do (group 2) | |
| M2 week-53 gap | Done: the gap is now at the end of the season | `3683cd8` |
| M3 domains of the wrong kind | Done | `6944185` |
| M4 1,000-piece cap reported | Done | `e072928` |
| M5 skipped tiles transformed | To do (group 2) | |
| M6 once-per-page warnings | Done: once per compiled spec, via `warnOnce` in `temporal-warnings.ts` | `e072928` |
| M7 relative tick count by width | To do (group 2, with S4) | |
| M8 document internal names | To do (README) | |
| M9 label collisions | To do (with section C) | |
| M10 one sentence in Limitations | To do (report) | |
| §4 missing tests | Partly done: tests for S1, S2 (view order + brush), S5, S7, S8 added. **Still missing:** the render-level regression test for an interactive genomic example | |
| §5 code quality | Done: shared helpers `eec76af`, `linking.ts` import `e1f1b7c`, single resolved flag `0b05f99` | |

**Behavior changes to note in the report:**
- **S2:** a `linkingId` that spans several coordinate systems is now split into one link per system. A view left alone in its system is not linked.
- **S7:** period views now default to an upper zoom limit of one period.
- **Resolved flag:** it is set on temporal tracks only, so compiled genomic specs are unchanged.

## B. Performance

Not started. Nothing has been measured yet.

**To resume:**
1. Run `fix/temporal-bugs` in a worktree on port 3457 and this branch on 3456.
2. Measure in headless Chromium (Apple M1, 8 GB):
   - load time;
   - frame times during wheel zoom and drag-pan;
   - on the 5 new examples (this branch only), S5 and S7 (both branches), and `MARK_DISPLACEMENT` and `LINKING` (both branches).
3. Suspected costs in `gosling-track.ts`, all run on every `draw()`:
   - `processAllTiles` re-merges tiles (`merged = [...merged, ...rows]`);
   - `#getResolvedTracks` runs `structuredClone`;
   - `#rowsOfTileForTimeUnit` calls `floorTime` per row;
   - `binByTimeUnit` re-runs.

## C. Example quality (G1–G7, per example)

Not started.

**Design decided, not built.** For temporal linear tracks only, so genomic output stays the same:
- **Header strip:** reserve one at the top of each track by giving quantitative `y` the range `[0, rowHeight - header]` in `gosling-track-model.ts`. The y axis in `axis.ts` follows the range.
- **Title and legend:** the HiGlass title stays on the left of the strip. A compact inline legend with its title goes on the right. Extend `style.inlineLegend` / `color.title` in `legend.ts`.
- **New `style.legendLabel`:** for overlaid members with a constant color (bar vs line, orange vs green). It needs a schema change.
- **New `y.title`:** the y-axis title, drawn rotated outside the track on the axis side. It needs a schema change.
- **G5:** context label computed from the visible range in `time-axis-ticks.ts`, and not drawn on circular axes (`unix-time-track.ts`).

## E1. Thumbnails

Not started.

**Plan:** render each temporal example after the visual fixes, then save it to `editor/example/thumbnails/<ID>.png` (500 px wide, like the genomic ones). Import it in `editor/example/thumbnails.ts` and set `image:` in `editor/example/index.ts`.

## Next

1. Group 2, in this order: S3, M5, S6, M1, S4/M7, then B (measure, fix, measure again).
2. Push.
3. Then C, S9, M8–M10, E1, re-render and check every screenshot, and the report.

## Resume notes

- **Render scripts:** the Playwright scripts (`render.js`, `zoom.js`, `compare.js`) were in the session scratchpad under `pw/`. The same scripts are in the earlier session's scratchpad: `/private/tmp/claude-501/-Users-cdr-c-Documents-time-i-gram/4a664fa4-.../scratchpad/pw`. `/tmp` may be cleared on shutdown; if so, reinstall `playwright@1.63`, `pixelmatch` and `pngjs` in a scratch folder.
- **Dev server:** `npx vite --mode editor --port 3456 --strictPort`. Examples open at `?example=<ID>&full=true`, rendered at 1300×950.
- **Formatting:** run `npx prettier` only on files this branch added. On inherited files (e.g. `data-transform.ts`, `polar.ts`), it reformats upstream code.
- **Schemas:** regenerate with `node scripts/generate-schemas.mjs` (deterministic).
