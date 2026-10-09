import type { GoslingSpec } from '@gosling-lang/gosling-schema';

// Supplementary material, Fig. S4 (Seattle Weather).
// Copied from the supplementary PDF (a fragment starting at `views: [...]`, wrapped in a root object).
// Since fixed: the domain is the data's (2012 to 2015), thresholds are durations, and every view has
// titles, axis titles and legends.

const spec = {
    title: 'Is it always raining in Seattle?',
    subtitle: 'Daily precipitation, temperature and weather in Seattle, 2012 to 2015',
    views: [
        {
            // --- Precipitation over time ---
            alignment: 'overlay',
            xDomain: { interval: ['2012', '2015'] },

            data: {
                url: 'https://raw.githubusercontent.com/vanessastoiber/thesis-datasets/main/1_seattle-weather/seattle-weather.csv',
                type: 'csv-time',
                dateFields: ['date'],
                yearFirstDate: true
            },

            width: 600,
            height: 110,

            x: {
                field: 'date',
                type: 'temporal',
                axis: 'bottom',
                linkingId: 'linked-views'
            },

            tracks: [
                {
                    title: 'Daily precipitation',
                    mark: 'bar',
                    size: { value: 5 },
                    color: { value: '#002a33' },
                    y: {
                        field: 'precipitation',
                        type: 'quantitative',
                        domain: [0, 55],
                        title: 'Precipitation (mm)'
                    }
                }
            ]
        },

        {
            // --- Maximum and minimum temperature ---
            alignment: 'overlay',
            title: 'Daily temperature',
            xDomain: { interval: ['2012', '2015'] },

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
            height: 110,

            tracks: [
                {
                    color: { value: '#fd2c3b' },
                    y: {
                        field: 'temp_max',
                        type: 'quantitative',
                        domain: [-10, 40],
                        title: 'Temperature (°C)'
                    },
                    style: { legendTitle: 'Temperature', legendLabel: 'Maximum' }
                },
                {
                    color: { value: '#0f767a' },
                    y: {
                        field: 'temp_min',
                        type: 'quantitative',
                        domain: [-10, 40]
                    },
                    style: { legendLabel: 'Minimum' }
                }
            ]
        },

        {
            // --- Categorical weather conditions with zoom-dependent representation ---
            alignment: 'overlay',
            title: 'Weather of the day',
            xDomain: { interval: ['2012', '2015'] },

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
            height: 110,

            tracks: [
                {
                    // Use colored blocks at coarser scales
                    mark: 'rect',
                    color: {
                        field: 'weather',
                        type: 'nominal',
                        domain: ['drizzle', 'rain', 'snow', 'sun', 'fog'],
                        range: ['#377750', '#002a33', '#74171f', '#cb4c47', '#35618f'],
                        legend: true,
                        title: 'Weather'
                    },
                    visibility: [
                        {
                            operation: 'greater-than',
                            measure: 'zoomLevel',
                            threshold: '3 weeks',
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
                            threshold: '3 weeks',
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
