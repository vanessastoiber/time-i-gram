import type { GoslingSpec } from '@gosling-lang/gosling-schema';

export const EX_SPEC_TEMPORAL_SEATTLE_WEATHER: GoslingSpec = {
    title: "How does Seattle's weather change over the year?",
    subtitle: 'Daily values, 2012 to 2015. The three views are linked: zoom or pan any of them.',
    description: '',
    views: [{
        alignment: "overlay",
        height: 100,
        tracks: [
            {
                title: "Daily precipitation",
                data: {
                    url: "https://raw.githubusercontent.com/vega/vega/main/docs/data/seattle-weather.csv",
                    type: "csv-time",
                    dateFields: ["date"],
                },
                mark: "bar",
                size: { value: 5 },
                color: { value: "#002a33" },
                x: { field: "date", type: "temporal", axis: "bottom", linkingId: "linked-views", domain: { interval: [1325376000, 1451606400] } },
                y: {
                    field: "precipitation",
                    type: "quantitative",
                    domain: [0, 55],
                    title: "Precipitation (mm)"
                },
                width: 800,
                height: 110
            }
        ]
    },
    {
        alignment: "overlay",
        tracks: [
            {
                title: "Daily temperature",
                data: {
                    url: "https://raw.githubusercontent.com/vega/vega/main/docs/data/seattle-weather.csv",
                    type: "csv-time",
                    dateFields: ["date"],
                },
                mark: "line",
                color: { value: "#fd2c3b" },
                x: { field: "date", type: "temporal", axis: "bottom", linkingId: "linked-views", domain: { interval: [1325376000, 1451606400] } },
                y: {
                    field: "temp_max",
                    type: "quantitative",
                    domain: [-10, 40],
                    title: "Temperature (°C)"
                },
                style: { legendTitle: "Temperature", legendLabel: "Maximum" },
                width: 800,
                height: 110
            },
            {
                data: {
                    url: "https://raw.githubusercontent.com/vega/vega/main/docs/data/seattle-weather.csv",
                    type: "csv-time",
                    dateFields: ["date"],
                },
                mark: "line",
                color: { value: "#0f767a" },
                x: { field: "date", type: "temporal", axis: "bottom", linkingId: "linked-views", domain: { interval: [1325376000, 1451606400] } },
                y: {
                    field: "temp_min",
                    type: "quantitative",
                    domain: [-10, 40]
                },
                style: { legendLabel: "Minimum" },
                width: 800,
                height: 110
            }
        ]
    },{
        alignment: "overlay",
        tracks: [
            {
                title: "Weather of the day",
                data: {
                    url: "https://raw.githubusercontent.com/vega/vega/main/docs/data/seattle-weather.csv",
                    type: "csv-time",
                    dateFields: ["date"],
                },
                mark: "rect",
                // a band below the header
                size: { value: 40 },
                color: {
                    field: "weather",
                    type: "nominal",
                    domain: ["drizzle", "rain", "snow", "sun", "fog"],
                    range: ["#377750", "#002a33", "#74171f", "#cb4c47", "#35618f"],
                    legend: true,
                    title: "Weather"
                },
                x: { field: "date", type: "temporal", axis: "bottom", linkingId: "linked-views", domain: { interval: [1325376000, 1451606400] } },
                visibility: [{
                    operation: "greater-than",
                    measure: "zoomLevel",
                    threshold: "3 weeks",
                    target: "track"
                }],
                width: 800,
                height: 80
            },
            {
                title: "Weather of the day",
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
                x: { field: "date", type: "temporal", axis: "bottom", linkingId: "linked-views", domain: { interval: [1325376000, 1451606400] } },
                visibility: [{
                    operation: "less-than",
                    measure: "zoomLevel",
                    threshold: "3 weeks",
                    target: "track"
                }],
                text: {field: "weather", "type": "nominal"},
                width: 800,
                height: 80
            }
        ]
    }]
};
