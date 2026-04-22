import { isMain } from './index.js'

const _dd = v => typeof v	== 'object' ? JSON.stringify(v, null, 2) : v
function dump(args, depth = 2) {
	let out = args.map(v => _dd(v)).join(' ')
	if (out != '') out += ` (${caller(depth)})`
	console.log(out)
	return out
}

export function dd(...args) { return dump(args) }
export const d = (...args) => console.dir(args.length === 1 ? args[0] : args, { depth: null })

export function dh(html) {
  let indent = 0
  const fmt = html
    .replace(/>\s*</g, '>\n<')
    .split('\n')
    .map(line => {
      if (line.match(/^<\//)) indent--
      const s = '  '.repeat(Math.max(0, indent)) + line
      if (line.match(/^<[^/].*[^/]>$/)) indent++
      return s
    })
    .join('\n')
  const colored = fmt
    .replace(/<(\/?)([\w-]+)/g, '\x1b[36m<$1$2\x1b[0m')
    .replace(/([\w@:-]+)=/g, '\x1b[33m$1\x1b[0m=')
    .replace(/"([^"]*)"/g, '\x1b[32m"$1"\x1b[0m')
    .replace(/>/g, '\x1b[36m>\x1b[0m')
  console.log(colored)
}

export function caller(depth = 0) {
	const stack = new Error().stack.split('at ')
	stack.shift()
	stack.shift()
	const target = stack[depth]
	let ret = /\(.+\)/.test(target) ? /\((.+)\)/.exec(target)[1] : target
	return ret.replace('\n', '').trim().replace(/:\d+$/, '')
}

export function cl(...args) {
	args.push(`(${caller(1)})`)
	console.log.apply(console, args)
}

const colorMap = {
	R: 'red',
	G: 'green',
	B: 'blue',
	Y: 'yellow',
	M: 'magenta',
	C: 'cyan',
	W: 'white',
}

export function p(...args) {
	const a = []
	for (let t of args) {
		if (typeof t == 'string') {
			t = t.replace(/(?<!\^)\^([^\^])([^\^]+)*/g, (...m) => {
				let c = colorMap[m[1]]
				return m[2] != undefined ? m[2][c]['bold'] : ''
			})
		}
		a.push(t)
	}
	console.log(...a)
}

export function _p(a) {
	return a.map(x => {
		if (isObject(x) || isArray(x)) {
			return json(x)
		}
		return x
	}).join(' ')
}
export function pg(...a) { p(`^G${_p(a)}`) }
export function pr(...a) { p(`^R${_p(a)}`) }

export function die(...a) {
	pr(...a)
	process.exit()
}

export function diep(...a) {
	p(...a)
	process.exit()
}

if (isMain(import.meta.url)) {
}
