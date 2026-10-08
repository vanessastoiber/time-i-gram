import { getHtmlTemplate, TIME_I_GRAM_EMBED_URL } from './html-template';

describe('exported HTML', () => {
    const html = getHtmlTemplate('{"tracks": []}');

    it('embeds the spec with the time-i-gram bundle, not upstream gosling.js', () => {
        expect(TIME_I_GRAM_EMBED_URL).toContain('/time-i-gram@');
        expect(html).toContain(`import { embed } from '${TIME_I_GRAM_EMBED_URL}';`);
        expect(html).toContain(`embed(document.getElementById('gosling-container'), {"tracks": []});`);
        expect(html).not.toMatch(/gosling\.js@|\/gosling\.js"/);
    });

    it('does not load local scripts that are not exported with the page', () => {
        expect(html).not.toMatch(/<script src="(?!https?:)/);
    });
});
