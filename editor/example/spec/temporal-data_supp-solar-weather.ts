import type { GoslingSpec } from '@gosling-lang/gosling-schema';

// Supplementary material, Fig. S5 (Solar Power Generation and Local Weather; paper Fig. 1B).
// Copied from the supplementary PDF (a fragment, wrapped in a root object). Fixed since
// (docs/grammar-audit.md §7): the Overview reads the PV file's date column instead of `time`, and
// `type` / `legend` are removed from fixed colors (`{ value }`), where they were ignored and made the
// spec schema-invalid. The data is daily for 2022 (the paper describes hourly data for 2021-2024).

const spec = {
    xDomain: {
        interval: [1640995200, 1672444800]
    },

    spacing: 0,

    views: [
        {
            // --- Overview with brush for time-range selection ---
            title: 'Overview',

            data: {
                url: 'https://raw.githubusercontent.com/vanessastoiber/thesis-datasets/main/3_solar-power/photovoltaics_01012022-31122022.csv',
                type: 'csv-time',
                dateFields: ['Datum und Uhrzeit'],
                dayFirstDate: true
            },

            mark: 'line',
            alignment: 'overlay',

            x: {
                field: 'Datum und Uhrzeit',
                type: 'temporal',
                axis: 'bottom'
            },

            tracks: [
                {},
                {
                    mark: 'brush',
                    x: {
                        linkingId: '2'
                    },
                    color: {
                        value: 'steelBlue'
                    }
                }
            ],

            width: 600,
            height: 40
        },

        {
            // --- Energy fed into the grid vs. self-consumption ---
            height: 100,
            width: 600,
            alignment: 'overlay',
            title: 'Fed into the power grid vs. consumption (Wh)',

            data: {
                url: 'https://raw.githubusercontent.com/vanessastoiber/thesis-datasets/main/3_solar-power/photovoltaics_01012022-31122022.csv',
                type: 'csv-time',
                dateFields: ['Datum und Uhrzeit'],
                dayFirstDate: true
            },

            x: {
                field: 'Datum und Uhrzeit',
                type: 'temporal',
                axis: 'none',
                linkingId: '2'
            },

            tracks: [
                {
                    mark: 'area',
                    color: {
                        value: '#bae4b3'
                    },
                    y: {
                        field: 'Energie ins Netz eingespeist',
                        type: 'quantitative',
                        domain: [0, 300000],
                        legend: true
                    },
                    tooltip: [
                        {
                            field: 'Energie ins Netz eingespeist',
                            type: 'quantitative',
                            alt: 'Consumption (KWh)',
                            format: ',.2r'
                        },
                        {
                            field: 'Eigenverbrauch',
                            type: 'quantitative',
                            alt: 'Consumption (KWh)',
                            format: ',.2r'
                        }
                    ],
                    width: 800,
                    height: 80
                },
                {
                    mark: 'area',
                    color: {
                        value: '#fcae91'
                    },
                    y: {
                        field: 'Eigenverbrauch',
                        type: 'quantitative',
                        domain: [0, 300000]
                    },
                    tooltip: [
                        {
                            field: 'Energie ins Netz eingespeist',
                            type: 'quantitative',
                            alt: 'Solar power fed into the power grid (KWh)',
                            format: ',.2r'
                        },
                        {
                            field: 'Eigenverbrauch',
                            type: 'quantitative',
                            alt: 'Consumption (KWh)',
                            format: ',.2r'
                        }
                    ]
                }
            ]
        },

        {
            // --- Total generation vs. energy obtained from the grid ---
            height: 100,
            width: 600,
            alignment: 'overlay',
            title: 'Generated vs. obtained from the power grid (Wh)',

            data: {
                url: 'https://raw.githubusercontent.com/vanessastoiber/thesis-datasets/main/3_solar-power/photovoltaics_01012022-31122022.csv',
                type: 'csv-time',
                dateFields: ['Datum und Uhrzeit'],
                dayFirstDate: true
            },

            x: {
                field: 'Datum und Uhrzeit',
                type: 'temporal',
                axis: 'none',
                linkingId: '2'
            },

            tracks: [
                {
                    mark: 'area',
                    color: {
                        value: '#74c476'
                    },
                    y: {
                        field: 'Gesamt Erzeugung',
                        type: 'quantitative',
                        domain: [0, 300000]
                    },
                    tooltip: [
                        {
                            field: 'Gesamt Erzeugung',
                            type: 'quantitative',
                            alt: 'Generated solar power (KWh)',
                            format: ',.2r'
                        },
                        {
                            field: 'Energie vom Netz bezogen',
                            type: 'quantitative',
                            alt: 'Solar power obtained from the power grid (KWh)',
                            format: ',.2r'
                        }
                    ]
                },
                {
                    mark: 'area',
                    color: {
                        value: '#fb6a4a'
                    },
                    y: {
                        field: 'Energie vom Netz bezogen',
                        type: 'quantitative',
                        domain: [0, 300000]
                    },
                    tooltip: [
                        {
                            field: 'Gesamt Erzeugung',
                            type: 'quantitative',
                            alt: 'Generated solar power (KWh)',
                            format: ',.2r'
                        },
                        {
                            field: 'Energie vom Netz bezogen',
                            type: 'quantitative',
                            alt: 'Solar power obtained from the power grid (KWh)',
                            format: ',.2r'
                        }
                    ]
                }
            ]
        },

        {
            // --- Local weather context: minimum and maximum temperature ---
            height: 100,
            width: 600,
            alignment: 'overlay',
            title: 'Local temperature',

            data: {
                url: 'https://raw.githubusercontent.com/vanessastoiber/thesis-datasets/main/3_solar-power/weather_data_local_20220101T0000_20221231T0000.csv',
                type: 'csv-time',
                dateFields: ['time']
            },

            x: {
                field: 'time',
                type: 'temporal',
                axis: 'none',
                linkingId: '2'
            },

            tracks: [
                {
                    mark: 'line',
                    color: {
                        value: '#0f767a'
                    },
                    y: {
                        field: 'tlmin',
                        type: 'quantitative',
                        domain: [-10, 40]
                    },
                    tooltip: [
                        {
                            field: 'tlmax',
                            type: 'quantitative',
                            alt: 'Maximum temperature'
                        },
                        {
                            field: 'tlmin',
                            type: 'quantitative',
                            alt: 'Minimum temperature'
                        }
                    ]
                },
                {
                    mark: 'line',
                    color: {
                        value: '#fd2c3b'
                    },
                    y: {
                        field: 'tlmax',
                        type: 'quantitative',
                        domain: [-10, 40]
                    },
                    tooltip: [
                        {
                            field: 'tlmax',
                            type: 'quantitative',
                            alt: 'Maximum temperature'
                        },
                        {
                            field: 'tlmin',
                            type: 'quantitative',
                            alt: 'Minimum temperature'
                        }
                    ]
                }
            ]
        },

        {
            // --- Sunshine duration ---
            height: 100,
            width: 600,
            alignment: 'overlay',
            title: 'Sunshine',

            data: {
                url: 'https://raw.githubusercontent.com/vanessastoiber/thesis-datasets/main/3_solar-power/weather_data_local_20220101T0000_20221231T0000.csv',
                type: 'csv-time',
                dateFields: ['time']
            },

            x: {
                field: 'time',
                type: 'temporal',
                axis: 'none',
                linkingId: '2'
            },

            tracks: [
                {
                    mark: 'bar',
                    color: {
                        value: '#fecc5c'
                    },
                    y: {
                        field: 'sonnenscheindauer',
                        type: 'quantitative',
                        domain: [0, 16]
                    },
                    tooltip: [
                        {
                            field: 'sonnenscheindauer',
                            type: 'quantitative',
                            alt: 'Sunshine duration (h)'
                        }
                    ]
                }
            ]
        },

        {
            // --- Precipitation amount and type ---
            height: 100,
            width: 600,
            alignment: 'overlay',
            title: 'Precipitation',

            data: {
                url: 'https://raw.githubusercontent.com/vanessastoiber/thesis-datasets/main/3_solar-power/weather_data_local_20220101T0000_20221231T0000.csv',
                type: 'csv-time',
                dateFields: ['time']
            },

            x: {
                field: 'time',
                type: 'temporal',
                axis: 'bottom',
                linkingId: '2'
            },

            tracks: [
                {
                    mark: 'point',

                    // Color encodes precipitation type
                    color: {
                        field: 'niederschlagsart_24h',
                        type: 'nominal',
                        range: ['#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#084594'],
                        legend: true
                    },

                    // Keep only non-zero precipitation events in a visible range
                    dataTransform: [
                        {
                            type: 'filter',
                            field: 'niederschlag_24h_summe',
                            inRange: [0, 50]
                        },
                        {
                            type: 'filter',
                            field: 'niederschlag_24h_summe',
                            oneOf: ['0'],
                            not: true
                        },
                        {
                            type: 'filter',
                            field: 'niederschlagsart_24h',
                            oneOf: ['0'],
                            not: true
                        }
                    ],

                    y: {
                        field: 'niederschlag_24h_summe',
                        type: 'quantitative',
                        domain: [-1, 40]
                    },

                    // Point size reinforces precipitation intensity
                    size: {
                        field: 'niederschlag_24h_summe',
                        type: 'quantitative'
                    },

                    tooltip: [
                        {
                            field: 'niederschlag_24h_summe',
                            type: 'quantitative',
                            alt: 'Precipitation over 24h'
                        }
                    ]
                }
            ]
        }
    ]
};

export const EX_SPEC_TEMPORAL_SUPP_SOLAR_WEATHER = spec as unknown as GoslingSpec;
