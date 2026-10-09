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
    dateFields: ['date']
};

// The initial view: January 2000 to March 2010, the extent of the dataset (Unix seconds).
// Without a domain, a view starts at the default extent of a genomic axis.
const xDomain = { interval: [946684800, 1267401600] as [number, number] };

const dataTransform = [{ type: 'filter' as const, field: 'series', oneOf: SECTORS }];

const color = {
    field: 'series',
    type: 'nominal' as const,
    domain: SECTORS,
    range: COLORS,
    legend: true,
    title: 'Industry'
};

const y = {
    field: 'count',
    type: 'quantitative' as const,
    domain: [0, 2500],
    title: 'Unemployed (thousands)'
};

export const EX_SPEC_TEMPORAL_UNEMPLOYMENT_CIRCULAR_LINEAR: GoslingSpec = {
    title: 'Does unemployment follow a yearly cycle in every industry?',
    subtitle: 'Five industries, 2000 to 2010. Brush the ring to zoom the detail. Source: U.S. Bureau of Labor Statistics',
    arrangement: 'horizontal',
    views: [
        {
            layout: 'circular',
            static: true,
            centerRadius: 0.45,
            tracks: [
                {
                    alignment: 'overlay',
                    data,
                    dataTransform,
                    mark: 'line',
                    x: { field: 'date', type: 'temporal', domain: xDomain },
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
                    title: 'Detail (brushed period)',
                    data,
                    dataTransform,
                    mark: 'line',
                    x: { field: 'date', type: 'temporal', axis: 'bottom', linkingId: 'unemployment-brush', domain: xDomain },
                    y,
                    color,
                    width: 700,
                    height: 350
                }
            ]
        }
    ]
};
