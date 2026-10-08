/**
 * The time-i-gram embed bundle (built from `embed/index.ts`, published on npm). It includes React,
 * HiGlass, PIXI and their CSS, so an exported page needs nothing else.
 * Bump the version after publishing a release that contains the changes you want exported pages to use.
 */
export const TIME_I_GRAM_EMBED_URL = 'https://cdn.jsdelivr.net/npm/@vanessa_stoiber1999/time-i-gram@0.0.1/dist/index.js';

export const getHtmlTemplate = (spec: string, embedUrl = TIME_I_GRAM_EMBED_URL) => `
<!DOCTYPE html>
<html>
<head>
    <title>time-i-gram Visualization</title>
</head>
<body>
    <div id="gosling-container"></div>
    <script type="module">
        import { embed } from '${embedUrl}';
        embed(document.getElementById('gosling-container'), ${spec});
    </script>
</body>
</html>
`;
