# Fix progress: review findings and example quality (`feat/temporal-grammar`)

Status as of 2026-10-09: **all items are done**. The details, commits, performance numbers, screenshots and the list of what was not fixed are in [temporal-grammar-report.md, Round 2](temporal-grammar-report.md#round-2-review-fixes-performance-and-figure-quality).

| Section | Status |
|---|---|
| A. Review findings S1–S9, M1–M10, §4 tests, §5 code quality | Done |
| B. Performance | Done. The slowness was the new FitBit cycles example (51 s of blocking per 10 zoom steps → about 3–4 s). There was no regression on the examples shared with `fix/temporal-bugs`. |
| C. Global rules G1–G7 and per-example fixes | Done for all 14 temporal examples, checked at load, after zoom and after drag |
| E1. Editor thumbnails | Done (14, made after the visual fixes) |

**State:**
- The suite has 438 tests, all passing, and `tsc --noEmit` is clean.
- Every commit is pushed to `denisseram/feat/temporal-grammar`.
- Compiled genomic examples are identical to `fix/temporal-bugs`.

**Tools for checking renders:**
- `scripts/render-regression.cjs` compares interactive renders of `MARK_DISPLACEMENT` with a reference branch. It needs `playwright`, `pixelmatch` and `pngjs` installed in a scratch folder; the header of the script explains how to run it.
- Run each dev server one at a time when worktrees share `node_modules`. Several servers optimizing dependencies at once serve blank pages (504).
