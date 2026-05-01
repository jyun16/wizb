import fs from 'fs-extra'
import os from 'os'
import dayjs from 'dayjs'
import { resolve, join as pathJoin } from 'path'
import { escape4regexp, wildMatch, tabCount, objDumpJS } from 'wiz'
import { isMain, caller } from './index.js'
import pathm from 'path'

const absolute = path => resolve(path)

export function dirname(path) {
	path = path.replace(/[^\/]+$/, '')
	if (path != '/') { path = path.replace(/\/$/, '') }
	return path
}

export function filename(path) {
	return pathm.basename(path)
}

export function __filename(depth = 1) {
	return caller(depth).replace(/^file:\/\//, '').replace(/:\d+$/, '')
}

export function __dirname(depth = 1) {
	return dirname(__filename(2))
}

export function array2dir(...a) {
	a = a.filter(v => v != '')
	a[0] = a[0].replace(/^\.\./, '')
	return a.join('/').replace(/\/$/, '')
}

function _ls(dir, o = {}, sync = false) {
	o = Object.assign({
		dirName: false, abs: false,
		fileOnly: false, dirOnly: false, symOnly: false,
		hidden: true, detail: false, exclude: [], include: []
	}, o)
	dir = dir.replace(/\/$/, '').replace('~', process.env.HOME)
	if (o.abs) { dir = absolute(dir) }
	const filter = dirents => dirents.flatMap(dirent => {
		if (o.fileOnly && !dirent.isFile()) { return [] }
		if (o.dirOnly && !dirent.isDirectory()) { return [] }
		if (o.symOnly && !dirent.isSymbolicLink()) { return [] }
		if (!o.hidden && dirent.name.startsWith('.')) { return [] }
		for (let m of o.include) if (!wildMatch(m, dirent.name)) return []
		for (let m of o.exclude) if (wildMatch(m, dirent.name)) return []
		const path = o.dirName || o.abs ? `${dir}/${dirent.name}` : dirent.name
		return [o.detail ? { path, name: dirent.name, isDir: dirent.isDirectory() } : path]
	})
	if (sync) return filter(fs.readdirSync(dir, { withFileTypes: true }))
	return fs.readdir(dir, { withFileTypes: true }).then(filter)
}

export function ls(dir, o = {}) { return _ls(dir, o) }
export function lsSync(dir, o = {}) { return _ls(dir, o, true) }

function _lsR(dir, o = {}, sync = false, base = '', cur = '') {
	if (!base) {
		o = Object.assign({
			dirName: false, abs: false,
			fileOnly: false, dirOnly: false, symOnly: false,
			hidden: true, detail: false, exclude: [], include: []
		}, o)
		dir = dir.replace(/\/$/, '').replace('~', process.env.HOME)
		if (o.abs) dir = absolute(dir)
		base = dir
	}
	const target = cur ? `${base}/${cur}` : base
	const filter = dirents => {
		const res = []
		const reqs = []
		for (const d of dirents) {
			if (!o.hidden && d.name.startsWith('.')) continue
			const rel = cur ? `${cur}/${d.name}` : d.name
			const path = o.dirName || o.abs ? `${base}/${rel}` : rel
			let match = true
			if (o.fileOnly && !d.isFile()) match = false
			if (o.dirOnly && !d.isDirectory()) match = false
			if (o.symOnly && !d.isSymbolicLink()) match = false
			for (const m of o.include) if (!wildMatch(m, /\//.test(m) ? rel : d.name)) match = false
			for (const m of o.exclude) if (wildMatch(m, /\//.test(m) ? rel : d.name)) match = false
			if (match) res.push(o.detail ? { path, name: d.name, isDir: d.isDirectory() } : path)
			if (d.isDirectory()) {
				if (sync) res.push(..._lsR(dir, o, true, base, rel))
				else reqs.push(_lsR(dir, o, false, base, rel))
			}
		}
		if (sync) return res
		return Promise.all(reqs).then(arr => res.concat(...arr))
	}
	if (sync) return filter(fs.readdirSync(target, { withFileTypes: true }))
	return fs.readdir(target, { withFileTypes: true }).then(filter)
}

export function lsR(dir, o = {}) { return _lsR(dir, o) }
export function lsRSync(dir, o = {}) { return _lsR(dir, o, true) }

export async function fileExists(path) { return fs.exists(path) }
export function fileExistsSync(path) { return fs.existsSync(path) }

export async function fileStat(path) { return (await fs.pathExists(path)) ? fs.stat(path) : null }
export function fileStatSync(path) { return fs.existsSync(path) ? fs.statSync(path) : null }

export async function permission(path) {
	const stat = await fileStat(path)
	return stat && (stat.mode & 0o777).toString(8)
}
export function permissionSync(path) {
	const stat = fileStatSync(path)
	return stat && (stat.mode & 0o777).toString(8)
}

export async function isDir(path) { return (await fileStat(path))?.isDirectory() || false }
export function isDirSync(path) { return fileStatSync(path)?.isDirectory() || false }

export async function isFile(path) { return (await fileStat(path))?.isFile() || false }
export function isFileSync(path) { return fileStatSync(path)?.isFile() || false }

export async function isSymlink(path) { return (await fileExists(path)) && (await fs.lstat(path)).isSymbolicLink() }
export function isSymlinkSync(path) { return fileExistsSync(path) && fs.lstatSync(path).isSymbolicLink() }

export async function symlink(src, dest) { return await fs.symlink(src, dest) }
export function symlinkSync(src, dest) { return fs.symlinkSync(src, dest) }

export async function chmod(path, mode) { return await fs.chmod(path, mode) }
export function chmodSync(path, mode) { return fs.chmodSync(path, mode) }

export async function mkdir(path) { await fs.mkdir(path, { recursive: true }) }
export function mkdirSync(path) { fs.mkdirSync(path, { recursive: true }) }

export async function readFile(path, encoding = 'utf-8') { return await fs.readFile(path, encoding) }
export function readFileSync(path, encoding = 'utf-8') { return fs.readFileSync(path, encoding) }

export async function writeFile(path, data, encoding = 'utf-8') { return await fs.writeFile(path, data, encoding) }
export function writeFileSync(path, data, encoding = 'utf-8') { return fs.writeFileSync(path, data, encoding) }

/*
	opts
	replace: [ 'ほげほげ/ふがふが', 'HOGEHOGE/FUGAFUGA' ]

		'REPLACE_TARGET_STRING/REPLACE_STRING'

		# replace contents only

	replaceAll: true
	
		replace contents, file name and directory name

*/
function _cp(src, dest, opts = {}, sync = false) {
	if (src == '~') src = process.env.HOME
	if (dest == '~') dest = process.env.HOME
	if (!opts.replace) return fs[sync ? 'copySync' : 'copy'](src, dest, { overwrite: true })
	const processDir = list => {
		const reSrc = new RegExp(`^${src}/`)
		const reqs = []
		for (const df of list) {
			let dfDest = df.replace(reSrc, dest)
			if (/\/$/.test(df)) {
				if (opts.replacePath) {
					for (const r of opts.replace) {
						const [from, to] = r.split(/\//)
						dfDest = dfDest.replace(new RegExp(from, 'g'), to)
					}
				}
				reqs.push(sync ? mkdirSync(dfDest) : mkdir(dfDest))
			}
			else {
				reqs.push(_cp(df, dfDest, opts, sync))
			}
		}
		if (!sync) return Promise.all(reqs)
	}
	const processFile = (data, mode) => {
		for (const r of opts.replace) {
			const [from, to] = r.split(/\//)
			data = data.replace(new RegExp(from, 'g'), to)
			if (opts.replacePath) dest = dest.replace(new RegExp(from, 'g'), to)
		}
		if (sync) {
			mkdirSync(dirname(dest))
			writeFileSync(dest, data)
			return chmodSync(dest, mode)
		}
		return mkdir(dirname(dest)).then(() => writeFile(dest, data)).then(() => chmod(dest, mode))
	}
	if (sync) {
		if (isDirSync(src)) return processDir(lsRSync(src, { dirName: true, fileOnly: false }))
		return processFile(readFileSync(src), permissionSync(src))
	}
	return isDir(src).then(dir => dir ? lsR(src, { dirName: true, fileOnly: false }).then(processDir) : Promise.all([readFile(src), permission(src)]).then(([data, mode]) => processFile(data, mode)))
}

export function cp(src, dest, opts = {}) { return _cp(src, dest, opts) }
export function cpSync(src, dest, opts = {}) { return _cp(src, dest, opts, true) }

export function mv(src, dest) { return fs.move(src, dest, { overwrite: true }) }
export function mvSync(src, dest) { return fs.moveSync(src, dest, { overwrite: true }) }

export function rm(path) { return fileExists(path).then(ex => ex ? fs.remove(path) : null) }
export function rmSync(path) { return fileExistsSync(path) && fs.removeSync(path) }

async function _touch(path, date = undefined, sync = false) {
	const dt = dayjs(date).toDate()
	if (sync) {
		if (!fs.existsSync(path)) fs.writeFileSync(path, '')
		return fs.utimesSync(path, dt, dt)
	}
	if (!(await fs.pathExists(path))) await fs.writeFile(path, '')
	return fs.utimes(path, dt, dt)
}

export function touch(path, date = undefined) { return _touch(path, date) }
export function touchSync(path, date = undefined) { return _touch(path, date, true) }

function _tmpdir(prefix = 'wizb-', sync = false) {
	const target = pathJoin(os.tmpdir(), prefix)
	if (sync) return fs.mkdtempSync(target)
	return fs.mkdtemp(target)
}

export function tmpdir(prefix = 'wizb-') { return _tmpdir(prefix) }
export function tmpdirSync(prefix = 'wizb-') { return _tmpdir(prefix, true) }

function _tmpfile(data, dir, sync = false) {
	if (sync) {
		if (!dir) dir = tmpdirSync()
		const p = pathJoin(dir, Math.random().toString(36).slice(2))
		if (data) writeFileSync(p, data)
		return p
	}
	return (dir ? Promise.resolve(dir) : tmpdir()).then(d => {
		const p = pathJoin(d, Math.random().toString(36).slice(2))
		if (data) return writeFile(p, data).then(() => p)
		return p
	})
}

export function tmpfile(data, dir) { return _tmpfile(data, dir) }
export function tmpfileSync(data, dir) { return _tmpfile(data, dir, true) }

// unit
// year or y, momth or M, day or d
// hour or h, minute or m, second or s
async function _cleanup(dir, expire, unit = 'hour', sync = false) {
	const now = dayjs()
	if (sync) {
		if (!isDirSync(dir)) return
		for (const f of lsSync(dir)) {
			const p = `${dir}/${f}`
			const s = fileStatSync(p)
			if (s && now.diff(dayjs(s.mtime), unit) >= expire) rmSync(p)
		}
		return
	}
	if (!(await isDir(dir))) return
	await Promise.all((await ls(dir)).map(async f => {
		const p = `${dir}/${f}`
		const s = await fileStat(p)
		if (s && now.diff(dayjs(s.mtime), unit) >= expire) await rm(p)
	}))
}

export function cleanup(dir, expire, unit = 'hour') { return _cleanup(dir, expire, unit) }
export function cleanupSync(dir, expire, unit = 'hour') { return _cleanup(dir, expire, unit, true) }

export function getJSData(data, target) {
	const re = new RegExp(`^\t*${escape4regexp(target)}`, 'g')
	let tab = -1
	let residue = ''
	let json = ''
	for (const l of data.split('\n')) {
		if (re.test(l)) {
			tab = tabCount(l)
			json += l.replace(re, '') + "\n"
		}
		else if (tab >= 0) {
			json += l + "\n"
			if (tab == tabCount(l) && !/^\/\//.test(l)) {
				tab = -1
				residue += `[[[${target}]]]`
			}
		}
		else {
			residue += l + "\n"
		}
	}
	const NAME = 'tmpValWiz4GetJSData'
	eval(`globalThis.${NAME}=` + json)
	return [ residue, eval(NAME) ]
}

export function readJSConf(path, target) {
	return getJSData(readFileSync(path) , target)
}

export function writeObj2JS(path, target, residue, obj) {
	writeFileSync(path, residue.replace(`[[[${target}]]]`, target + dumpJSObj(obj, 0, {	})))
}

if (isMain(import.meta.url)) {
	(async () => {
		const Test = (await import('./test.js')).default
		const { dd } = (await import('wiz'))
		const t = new Test()
		// dd(lsSync('./', { abs: true, include: [ '*.json' ] }))
		// dd(await ls('./', { abs: true, include: [ '*.json' ] }))
		// dd(lsRSync('./', { abs: true, exclude: [ 'node_modules/*', '.git/*' ] }))
		// dd(await lsR('./', { abs: true, exclude: [ 'node_modules/*', '.git/*' ] }))
		// dd(await tmpfile('HOGEHOGE', '/tmp'))
	})()
}

/*

DIR=~/hoge
mkdir $DIR
touch $DIR/HOGE
mkdir $DIR/empty
mkdir $DIR/fuga
touch $DIR/fuga/FUGA
mkdir -p $DIR/node_modules/xxx
mkdir -p $DIR/node_modules/yyy
touch $DIR/node_modules/xxx/XXX
mkdir $DIR/logs
touch $DIR/logs/access.log
touch $DIR/logs/error.log

*/
