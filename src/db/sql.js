import { cl, isMain } from '../index.js'

export function	escape(v) {
	v = v.toString()
	return v.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, char => {
		switch (char) {
			case "\0":
				return "\\0";
			case "\x08":
				return "\\b";
			case "\x09":
				return "\\t";
			case "\x1a":
				return "\\z";
			case "\n":
				return "\\n";
			case "\r":
				return "\\r";
			case "\"":
			case "'":
			case "\\":
			case "%":
				return "\\"+char;
			default:
				return char;
		}
	});
}

export function escapes(v) {
	return v.map(d => escape(d))
}

export function escape4like(v) {
	v = v.toString()
	return v.replace(/([%_])/g, '\\$1')
}

export function bind(q, v) {
	let ret = ''
	q = q.split('?')
	const ql = q.length
	for (let i = 0; i < ql; i++) {
		ret += q[i]
		if (i < ql - 1) {
			if (typeof v[i] == 'string') {
				ret += `'${escape(v[i])}'`
			}
			else {
				ret += escape(v[i])
			}
		}
	}
	return ret
}

if (isMain(import.meta.url)) {
	(async () => {
		const Test = (await import('../test.js')).default
		const t = new Test()
		t.eq('\\"\\n', escape('"\n'))
		t.eq([ '\\"', '\\n' ], escapes([ '"', '\n' ]))
	})()
}
