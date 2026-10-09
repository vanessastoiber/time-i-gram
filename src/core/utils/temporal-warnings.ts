/**
 * Warnings given while data is loaded or drawn, where the same problem would repeat for every row, tile and draw:
 * each message is given once per compiled spec. `resolveTemporalSugar()` resets them when a spec is compiled, so
 * the next spec (e.g. an edit in the editor) warns again.
 */
const given = new Set<string>();

export function warnOnce(message: string) {
    if (given.has(message)) return;
    given.add(message);
    console.warn(`[time-i-gram] ${message}`);
}

export function resetTemporalWarnings() {
    given.clear();
}
