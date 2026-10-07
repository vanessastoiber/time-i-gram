import type { GoslingSpec } from '@gosling-lang/gosling-schema';

// Reproduces the paper's running example (Section 3, Figure 4): monthly
// unemployment counts across five U.S. industry sectors (2000-2010),
// shown as a circular overview (revealing annual cycles across the decade)
// linked via a brush to a linear detail view, both with a series-colored,
// overlaid line mark and a shared chronological time scale.

const SECTORS = ['Government', 'Manufacturing', 'Construction', 'Information', 'Education and Health'];
const COLORS = ['#4C72B0', '#DD8452', '#55A868', '#C44E52', '#8172B2'];

const data = {
    url: 'https://raw.githubusercontent.com/vega/vega/main/docs/data/unemployment-across-industries.json',
    type: 'json-time' as const,
    // `json-time`'s processRow() only recognizes 'year'/'month'/'day' as keys it can
    // assemble into a date -- a single ISO field like `dateFields: ['date']` silently
    // collapses every row to 1970-01-01 instead of parsing it. Use the two fields this
    // dataset already has, which the fetcher writes the computed epoch back into
    // `row[dateFields[0]]` (i.e. `row.year`), so the x channel must read `field: 'year'`.
    dateFields: ['year', 'month']
};

// `tilesetInfo()` in json-time-data-fetcher.ts returns a hardcoded multi-century
// min/max position instead of one derived from the data, so the default zoom shows
// almost nothing. Force the initial view to the dataset's actual 2000-2010 range
// (epoch seconds, matching what processRow() computes).
const xDomain = { interval: [946684800, 1267401600] as [number, number] };

const dataTransform = [{ type: 'filter' as const, field: 'series', oneOf: SECTORS }];

const color = {
    field: 'series',
    type: 'nominal' as const,
    domain: SECTORS,
    range: COLORS,
    legend: true
};

const y = {
    field: 'count',
    type: 'quantitative' as const,
    domain: [0, 2500]
};

export const EX_SPEC_TEMPORAL_UNEMPLOYMENT_CIRCULAR_LINEAR: GoslingSpec = {
    title: 'Temporal Data',
    subtitle: 'Unemployment across industries: circular overview + linear detail',
    arrangement: 'horizontal',
    views: [
        {
            layout: 'circular',
            static: true,
            tracks: [
                {
                    alignment: 'overlay',
                    data,
                    dataTransform,
                    mark: 'line',
                    x: { field: 'year', type: 'temporal', domain: xDomain },
                    y,
                    color,
                    tracks: [
                        {},
                        {
                            mark: 'brush',
                            x: { linkingId: 'unemployment-brush' },
                            color: { value: 'steelBlue' }
                        }
                    ],
                    width: 420,
                    height: 420
                }
            ]
        },
        {
            tracks: [
                {
                    title: 'Detail',
                    data,
                    dataTransform,
                    mark: 'line',
                    x: { field: 'year', type: 'temporal', axis: 'bottom', linkingId: 'unemployment-brush', domain: xDomain },
                    y,
                    color,
                    width: 700,
                    height: 350
                }
            ]
        }
    ]
};
