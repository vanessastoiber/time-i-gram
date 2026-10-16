import type { GoslingSpec } from '@gosling-lang/gosling-schema';

// Monthly mean CO2 at Mauna Loa, March 1958 to April 2020 (the Keeling curve; NOAA GML and Scripps), as published in
// vega-datasets: `Date`, `CO2` (ppm) and `adjusted CO2` (the seasonal cycle removed).
//
// - Rings: one ring per decade (`period: "decade"`, filtered by each row's decade, with the CO2 range of the decade as
//   the ring's scale), the monthly means against the seasonally adjusted trend (grey): the swing around the trend is
//   the seasonal cycle. The grammar has no arithmetic transform, so the swing cannot be computed as CO2 - trend (Brehmer's radial chronological
//   segmented timeline, one ring per decade; the TimeViz Browser's Spiral Graph, with rings for the turns).
// - Overview: absolute time with granularity rules, by month, by year above 15 years and by decade above 70, colored
//   by decade: a readable label from the `timeUnit` transform (`labelField`).

const DATA = {
    type: 'csv-time',
    url: 'https://raw.githubusercontent.com/vega/vega-datasets/main/data/co2-concentration.csv',
    dateFields: ['Date']
};

const DECADES = ['1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'];
const DECADE_COLORS = ['#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b', '#041b3d'];
const PPM = 'CO₂ (ppm)';

/** The CO2 range of each decade (ppm), the y scale of its ring, so that the seasonal swing fills the ring. */
const DECADE_RANGES: Record<string, [number, number]> = {
    '1950s': [312, 318],
    '1960s': [315, 328],
    '1970s': [323, 340],
    '1980s': [336, 356],
    '1990s': [350, 370],
    '2000s': [365, 392],
    '2010s': [385, 415],
    '2020s': [408, 418]
};

/** One decade as a ring (`period: "decade"`): the monthly means and the seasonally adjusted trend. */
function decadeRing(decade: string) {
    const i = DECADES.indexOf(decade);
    const y = (field: string) => ({ field, type: 'quantitative', domain: DECADE_RANGES[decade], axis: 'none' });
    return {
        title: decade,
        alignment: 'overlay',
        data: DATA,
        // the period field names each row's decade, which filters the ring's rows
        dataTransform: [{ type: 'filter', field: 'decade', oneOf: [decade] }],
        x: {
            field: 'Date',
            type: 'temporal',
            period: { unit: 'decade', newField: 'decade' },
            axis: decade === '2010s' ? 'top' : 'none'
        },
        tracks: [
            { mark: 'line', y: y('adjusted CO2'), color: { value: '#bdbdbd' }, size: { value: 1.5 } },
            { mark: 'line', y: y('CO2'), color: { value: DECADE_COLORS[i] }, size: { value: 1.2 } }
        ],
        width: 600,
        height: 34
    };
}

const spec = {
    title: 'How fast has CO\u2082 risen in each decade, and how much does it swing within each year?',
    subtitle: 'Monthly mean CO₂ at Mauna Loa, 1958 to 2020. Source: NOAA GML and Scripps (Keeling), via vega-datasets',
    arrangement: 'vertical',
    spacing: 40,
    zoomLimits: ['1 year', '150 years'],
    views: [
        {
            arrangement: 'horizontal',
            views: [
                {
                    layout: 'circular',
                    centerRadius: 0.3,
                    spacing: 2,
                    // one ring per decade (outer: the 2010s; the 2020s have 4 months), each with its own CO2 scale
                    tracks: DECADES.filter(d => d !== '2020s').reverse().map(decadeRing)
                }
            ]
        },
        {
            tracks: [
                {
                    title: 'Overview: monthly means, yearly above 15 years, by decade above 70 years',
                    alignment: 'overlay',
                    data: DATA,
                    x: {
                        field: 'Date',
                        type: 'temporal',
                        timeUnit: [
                            { unit: 'month', maxSpan: '15 years' },
                            { unit: 'year', maxSpan: '70 years' },
                            { unit: 'decade' }
                        ],
                        axis: 'bottom',
                        domain: { interval: ['1958', '2020'] }
                    },
                    y: { field: 'CO2', type: 'quantitative', aggregate: 'mean', domain: [310, 420], axis: 'left', title: PPM },
                    // the decade of each row, as a readable label (not seconds), colors the line
                    dataTransform: [
                        { type: 'timeUnit', field: 'Date', unit: 'decade', newField: 'decade_start', labelField: 'decade' }
                    ],
                    color: { field: 'decade', type: 'nominal', domain: DECADES, range: DECADE_COLORS, legend: true, title: 'Decade' },
                    tracks: [
                        { mark: 'line', size: { value: 2 } },
                        {
                            mark: 'point',
                            size: { value: 2 },
                            tooltip: [
                                { field: 'Date', type: 'temporal', alt: 'From', format: '%Y-%m' },
                                { field: 'CO2', type: 'quantitative', alt: 'Mean CO₂ (ppm)', format: '.1f' }
                            ]
                        }
                    ],
                    width: 1200,
                    height: 160
                }
            ]
        }
    ]
};

export const EX_SPEC_TEMPORAL_KEELING_CO2 = spec as unknown as GoslingSpec;
