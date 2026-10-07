import type { GoslingSpec } from '@gosling-lang/gosling-schema';

// Supplementary material, Fig. S4 (Seattle Weather).
// Copied verbatim from the supplementary PDF. The printed spec is a fragment
// starting at `views: [...]`; it is wrapped in a root object here and the
// trailing `];` became `]`. Not yet fixed: see docs/grammar-audit.md §7.

const spec = {
    views: [
        {
            // --- Precipitation over time ---
            alignment: 'overlay',
            xDomain: { interval: [1293840000, 1483228800] },

            data: {
                url: 'https://raw.githubusercontent.com/vanessastoiber/thesis-datasets/main/1_seattle-weather/seattle-weather.csv',
                type: 'csv-time',
                dateFields: ['date'],
                yearFirstDate: true
            },

            width: 600,
            height: 80,

            x: {
                field: 'date',
                type: 'temporal',
                axis: 'bottom',
                linkingId: 'linked-views'
            },

            tracks: [
                {
                    title: 'precipitation',
                    mark: 'bar',
                    size: { value: 5 },
                    color: { value: '#002a33' },
                    y: {
                        field: 'precipitation',
                        type: 'quantitative',
                        domain: [0, 55]
                    }
                }
            ]
        },

        {
            // --- Maximum and minimum temperature ---
            alignment: 'overlay',
            title: 'temperature',
            xDomain: { interval: [1293840000, 1483228800] },

            data: {
                url: 'https://raw.githubusercontent.com/vanessastoiber/thesis-datasets/main/1_seattle-weather/seattle-weather.csv',
                type: 'csv-time',
                dateFields: ['date'],
                yearFirstDate: true
            },

            // Default mark inherited by both tracks
            mark: 'line',

            x: {
                field: 'date',
                type: 'temporal',
                axis: 'bottom',
                linkingId: 'linked-views'
            },

            width: 600,
            height: 80,

            tracks: [
                {
                    color: { value: '#fd2c3b' },
                    y: {
                        field: 'temp_max',
                        type: 'quantitative',
                        domain: [0, 40]
                    }
                },
                {
                    color: { value: '#0f767a' },
                    y: {
                        field: 'temp_min',
                        type: 'quantitative',
                        domain: [0, 40]
                    }
                }
            ]
        },

        {
            // --- Categorical weather conditions with zoom-dependent representation ---
            alignment: 'overlay',
            title: 'weather condition',
            xDomain: { interval: [1293840000, 1483228800] },

            data: {
                url: 'https://raw.githubusercontent.com/vanessastoiber/thesis-datasets/main/1_seattle-weather/seattle-weather.csv',
                type: 'csv-time',
                dateFields: ['date'],
                yearFirstDate: true
            },

            x: {
                field: 'date',
                type: 'temporal',
                axis: 'bottom',
                linkingId: 'linked-views'
            },

            width: 600,
            height: 80,

            tracks: [
                {
                    // Use colored blocks at coarser scales
                    mark: 'rect',
                    color: {
                        field: 'weather',
                        type: 'nominal',
                        domain: ['drizzle', 'rain', 'snow', 'sun', 'fog'],
                        range: ['#377750', '#002a33', '#74171f', '#cb4c47', '#35618f'],
                        legend: true
                    },
                    visibility: [
                        {
                            operation: 'greater-than',
                            measure: 'zoomLevel',
                            threshold: 2000000,
                            target: 'track'
                        }
                    ],
                    size: { value: 25 }
                },
                {
                    // Use text labels at finer scales
                    mark: 'text',
                    color: {
                        field: 'weather',
                        type: 'nominal',
                        domain: ['drizzle', 'rain', 'snow', 'sun', 'fog'],
                        range: ['#377750', '#002a33', '#74171f', '#cb4c47', '#35618f']
                    },
                    visibility: [
                        {
                            operation: 'less-than',
                            measure: 'zoomLevel',
                            threshold: 2000000,
                            target: 'track'
                        }
                    ],
                    text: {
                        field: 'weather',
                        type: 'nominal'
                    }
                }
            ]
        }
    ]
};

export const EX_SPEC_TEMPORAL_SUPP_SEATTLE_WEATHER = spec as unknown as GoslingSpec;
