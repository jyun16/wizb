import colors from 'colors'
import util from 'util'
import { fileURLToPath } from 'url'
import childProcess from 'child_process'
import { execa } from 'execa'

const _dd = v => typeof v	== 'object' ? JSON.stringify(v, null, 2) : v
function dump(args, depth = 2) {
	let out = args.map(v => _dd(v)).join(' ')
	if (out != '') out += ` (${caller(depth)})`
	console.log(out)
	return out
}

export function dd(...args) { return dump(args) }
export function d(...args) { return dump(args) }

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

export function pp(...args) { p(...args) }
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
			return JSON.stringify(x)
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

export function isMain(url) {
	if (typeof process != 'undefined') {
		return process.argv[1] === fileURLToPath(url)
	}
}

export async function exec(cmd, args) {
	const res = await execa(cmd, args)	
	return { stdout: res.stdout.toString(), stderr: res.stderr.toString() }
}

export async function shell(cmd)	{
	return util.promisify(childProcess.exec)(cmd)
}

if (isMain(import.meta.url)) {
	pp('^GHOGE', '^BFUGA')
}
