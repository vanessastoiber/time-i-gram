# time-i-gram

**A grammar for interactive visualization of time-based data.**

time-i-gram extends [Gosling.js](https://github.com/gosling-lang/gosling.js) with a temporal field type,
time-aware data sources (`csv-time`, `json-time`), a time axis, time coordinate systems (calendar periods
such as "week of the year" and offsets relative to an event), calendar units with aggregation, and time
transforms. A visualization is a JSON spec; `embed` renders it, with zooming, brushing and linked views.

This package is a single self-contained ES module: React, PixiJS, HiGlass and their CSS are bundled, so
there is nothing else to install.

The grammar, the editor with examples and the source code: https://github.com/vanessastoiber/time-i-gram

## Install

From a CDN, nothing to install:

```js
import { embed } from 'https://cdn.jsdelivr.net/npm/time-i-gram@0.1.0/dist/index.js';
```

With a bundler (Vite, esbuild, webpack, ...):

```bash
npm install time-i-gram
```

```js
import { embed } from 'time-i-gram';
```

## Usage in a plain HTML page

```html
<!DOCTYPE html>
<html>
<body>
  <div id="container"></div>
  <script type="module">
    import { embed } from 'https://cdn.jsdelivr.net/npm/time-i-gram@0.1.0/dist/index.js';

    const spec = {
      title: 'Seattle Weather',
      tracks: [{
        data: {
          url: 'https://raw.githubusercontent.com/vega/vega/main/docs/data/seattle-weather.csv',
          type: 'csv-time',
          dateFields: ['date']
        },
        mark: 'bar',
        x: { field: 'date', type: 'temporal', axis: 'bottom', domain: { interval: [1325376000, 1451606400] } }, // 2012-2015 in Unix seconds
        y: { field: 'precipitation', type: 'quantitative' },
        width: 800,
        height: 200
      }]
    };

    embed(document.getElementById('container'), spec);
  </script>
</body>
</html>
```

`embed(element, spec, options?)` returns a promise of the visualization's API (zoom to a range, subscribe to
events, export images).

## Usage in Observable

In an [Observable notebook](https://observablehq.com), `embed(spec)` returns an element that the cell displays:

```js
embed = (await import('https://cdn.jsdelivr.net/npm/time-i-gram@0.1.0/dist/index.js')).embed
```

```js
embed({ /* a time-i-gram spec */ })
```

In [Observable Framework](https://observablehq.com/framework/):

```js
import { embed } from 'npm:time-i-gram@0.1.0';

display(await embed({ /* a time-i-gram spec */ }));
```

## TypeScript

The package includes types for `embed` and for specs:

```ts
import { embed, type GoslingSpec } from 'time-i-gram';
```

## Citation

If you use time-i-gram in your research, please cite:

> V. Stoiber, D. Chacón-Ramírez, N. Gehlenborg, W. Aigner, and M. Streit, "time-i-gram: A Grammar for
> Interactive Visualization of Time-based Data," Center for Open Science (preprint), 2026.
> doi: [10.31219/osf.io/m9ubg_v2](https://doi.org/10.31219/osf.io/m9ubg_v2)

```bibtex
@article{Stoiber2026,
  title     = {time-i-gram: A Grammar for Interactive Visualization of Time-based Data},
  doi       = {10.31219/osf.io/m9ubg_v2},
  url       = {https://doi.org/10.31219/osf.io/m9ubg_v2},
  publisher = {Center for Open Science},
  author    = {Stoiber, Vanessa and Chacón-Ramírez, Denisse and Gehlenborg, Nils and Aigner, Wolfgang and Streit, Marc},
  year      = {2026},
  month     = aug
}
```

## License

MIT. time-i-gram is built on [Gosling.js](https://github.com/gosling-lang/gosling.js) (MIT) and
[HiGlass](https://github.com/higlass/higlass) (MIT).
