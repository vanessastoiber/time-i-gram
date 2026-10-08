import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = fs.readFileSync(path.join(root, 'yarn.lock'), 'utf8');

/** Package names that have an entry in yarn.lock (entry lines look like `name@^1.0.0, name@~1.1:`). */
const lockedNames = new Set(
    lock
        .split('\n')
        .filter(line => line && !line.startsWith(' ') && !line.startsWith('#'))
        .flatMap(line => line.replace(/:$/, '').split(', '))
        .map(entry => entry.replace(/^"|"$/g, ''))
        .map(entry => entry.slice(0, entry.lastIndexOf('@')))
);

describe('package.json', () => {
    it('declares only dependencies that are installed through yarn.lock', () => {
        const declared = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
        expect(declared.filter(name => !lockedNames.has(name))).toEqual([]);
    });
});
