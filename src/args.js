import { cl, isMain } from './index.js'
import { basename } from 'path'

let usage = () => {}

const genParseMap = f => {
	const ret = {}
	let n = null
	f = f.split('')
	for (let i = 0; i < f.length; i++) {
		const c = f[i]
		const c2 = f[i+1]
		if (c2 == ':') { ret[c] = 'one'; i++ }
		else if (c2 == ';') { ret[c] = 'or'; i++ }
		else if (c2 == '@') { ret[c] = 'list'; i++ }
		else { ret[c] = true }
	}
	return ret
}

const self = (f, _usage) => {
	const ret = {}
	const m = genParseMap(f)
	const a = process.argv.slice(2)
	let n = 0
	for (let i = 0; i < a.length; i++) {
		const t = a[i]
		const x = /^-(.+)/.exec(t)
		if (x) {
			let p = x[1]
			if (m[p] == 'one') {
				ret[p] = a[++i]
			}
			else if (m[p] == 'or') {
				if (a[++i] == null) {
					ret[p] = true
				}
				else {
					if (/^-/.test(a[i])) {
						i--
						ret[p] = true
					}
					else {
						ret[p] = a[i]
					}
				}
			}
			else if (m[p] == 'list') {
				const l = []
				while (!/^-/.test(a[i+1]) && a[i+1] != null) {
					l.push(a[++i])
				}
				ret[p] = l
			}
			else {
				ret[p] = true
			}
		}
		else {
			if (!ret._) { ret._ = [] }
			ret._[n++] = t
		}
	}
	usage = _usage
	return ret
}

export function get$0() {
	return basename(process.argv[1])
}

export function getA(a, len) {
	if (a._.length < len) { usage() }
	return a._
}

export { self as args }

if (isMain(import.meta.url)) {
	const a = self('u:p;l@ghv')
	cl(a)
}
