// Minimal test helpers: each failed check prints its location and marks the run failed.

let failures = 0, checks = 0, current = '';

export function test(name, fn) {
	current = name;
	try {
		fn();
	}
	catch (e) {
		failures++;
		warn(`FAIL ${name}: threw ${e.message}\n${e.stacktrace?.[0]?.context ?? ''}\n`);
	}
};

// Objects compare by content: key order is an implementation detail.
function canonical(v) {
	if (type(v) == 'array')
		return map(v, canonical);
	if (type(v) != 'object')
		return v;
	let out = {};
	for (let k in sort(keys(v)))
		out[k] = canonical(v[k]);
	return out;
}

export function eq(actual, expected, what) {
	checks++;
	const a = sprintf('%J', canonical(actual)), e = sprintf('%J', canonical(expected));
	if (a != e) {
		failures++;
		warn(`FAIL ${current}${what ? ' / ' + what : ''}\n  expected: ${e}\n  actual:   ${a}\n`);
	}
};

export function ok(cond, what) {
	eq(!!cond, true, what);
};

export function done() {
	print(`${checks} checks, ${failures} failed\n`);
	exit(failures ? 1 : 0);
};
