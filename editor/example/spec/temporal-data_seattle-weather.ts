import type { GoslingSpec } from '@gosling-lang/gosling-schema';

export const EX_SPEC_TEMPORAL_SEATTLE_WEATHER: GoslingSpec = {
    title: 'Temporal Data',
    subtitle: 'Seattle weather',
    description: '',
    views: [{
        alignment: "overlay",
        height: 100,
        tracks: [
            {
                title: "precipitation",
                data: {
                    url: "https://raw.githubusercontent.com/vega/vega/main/docs/data/seattle-weather.csv",
                    type: "csv-time",
                    dateFields: ["date"],
                },
                mark: "bar",
                size: { value: 5 },
                color: { value: "#002a33" },
                x: { field: "date", type: "temporal", axis: "bottom", linkingId: "linked-views" },
                y: {
                    field: "precipitation",
                    type: "quantitative",
                    domain: [0, 55]
                },
                width: 800,
                height: 80
            }
        ]
    },
    {
        alignment: "overlay",
        tracks: [
            {
                title: "temperature",
                data: {
                    url: "https://raw.githubusercontent.com/vega/vega/main/docs/data/seattle-weather.csv",
                    type: "csv-time",
                    dateFields: ["date"],
                },
                mark: "line",
                color: { value: "#fd2c3b" },
                x: { field: "date", type: "temporal", axis: "bottom", linkingId: "linked-views" },
                y: {
                    field: "temp_max",
                    type: "quantitative",
                    domain: [0, 40]
                },
                width: 800,
                height: 80
            },
            {
                data: {
                    url: "https://raw.githubusercontent.com/vega/vega/main/docs/data/seattle-weather.csv",
                    type: "csv-time",
                    dateFields: ["date"],
                },
                mark: "line",
                color: { value: "#0f767a" },
                x: { field: "date", type: "temporal", axis: "bottom", linkingId: "linked-views" },
                y: {
                    field: "temp_min",
                    type: "quantitative",
                    domain: [0, 40]
                },
                width: 800,
                height: 80
            }
        ]
    },{
        alignment: "overlay",
        tracks: [
            {
                title: "weather",
                data: {
                    url: "https://raw.githubusercontent.com/vega/vega/main/docs/data/seattle-weather.csv",
                    type: "csv-time",
                    dateFields: ["date"],
                },
                mark: "rect",
                color: {
                    field: "weather",
                    type: "nominal",
                    domain: ["drizzle", "rain", "snow", "sun", "fog"],
                    range: ["#377750", "#002a33", "#74171f", "#cb4c47", "#35618f"],
                    legend: true
                },
                x: { field: "date", type: "temporal", axis: "bottom", linkingId: "linked-views" },
                visibility: [{
                    operation: "greater-than",
                    measure: "zoomLevel",
                    threshold: 2000000,
                    target: "track"
                }],
                width: 800,
                height: 80
            },
            {
                title: "weather",
                data: {
                    url: "https://raw.githubusercontent.com/vega/vega/main/docs/data/seattle-weather.csv",
                    type: "csv-time",
                    dateFields: ["date"],
                },
                mark: "text",
                color: {
                    field: "weather",
                    type: "nominal",
                    domain: ["drizzle", "rain", "snow", "sun", "fog"],
                    range: ["#377750", "#002a33", "#74171f", "#cb4c47", "#35618f"],
                },
                x: { field: "date", type: "temporal", axis: "bottom", linkingId: "linked-views" },
                visibility: [{
                    operation: "less-than",
                    measure: "zoomLevel",
                    threshold: 2000000,
                    target: "track"
                }],
                text: {field: "weather", "type": "nominal"},
                width: 800,
                height: 80
            }
        ]
    }]
};
