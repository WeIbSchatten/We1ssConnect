// Runs a LuCI module that needs only baseclass and _() in Node, for unit tests.
import { readFileSync } from 'node:fs';

export function load(path) {
	if (!String.prototype.format)
		String.prototype.format = function (...args) {
			let i = 0;
			return this.replace(/%[sd]/g, () => String(args[i++]));
		};
	globalThis._ = (s) => s;
	return new Function('baseclass', readFileSync(path, 'utf8'))({ extend: (o) => o });
}
