import fs from 'fs'
import { resolve } from 'path'
import fse from 'fs-extra'
import { cl, isMain, caller, escape4regexp, wildMatch, tabCount, dumpJSObj } from './index.js'
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

export function ls(dir, o = {}) {
	o = Object.assign({ dirName: false, exclude: [], include: [] }, o)
  dir = dir.replace(/\/$/, '').replace('~', process.env.HOME)
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(dirent => {
		if (dirent.isFile()) {
			const name = dirent.name
			for (let m of o.include) { if (!wildMatch(m, name)) { return [] } }
			for (let m of o.exclude) { if (wildMatch(m, name)) { return [] } }
			return [ `${o.dirName ? dir + '/' : ''}${dirent.name}` ]
		}
		else {
			return []
		}
	})
}

const _lsR = (base, dir, o = {}) => {
  return fs.readdirSync(`${base}/${dir}`, { withFileTypes: true }).flatMap(dirent => {
		const file = dirent.name
		const path = array2dir(o.dirName ? base + '/' : '', dir, dirent.name)
		if (dirent.isFile()) {
			for (let m of o.exclude) {
				if (wildMatch(m, /\//.test(m) ? path : file)) { return [] }
			}
			for (let m of o.include) {
				if (!wildMatch(m, /\//.test(m) ? path : file)) { return [] }
			}
			return [ path ]
		}
		else if (dirent.isDirectory()) {
			let ret = []
			if (!o.fileOnly) {
				let push = true
				for (let m of o.exclude) {
					if (wildMatch(m, /\//.test(m) ? path : file)) { push = false; break }
				}
				if (push) {
					for (let m of o.include) {
						if (!wildMatch(m, /\//.test(m) ? path : file)) { push = false; break }
					}
				}
				if (push) { ret.push(path + '/') }
			}
			ret = ret.concat(_lsR(base, array2dir(dir, file), o))
			return ret
		}
		return []
	})
}

export function lsR(dir, o = {}) {
	o = Object.assign({ dirName: false, fileOnly: true, exclude: [], include: [] }, o)
  dir = dir.replace(/\/$/, '').replace('~', process.env.HOME)
	if (!isDir(dir)) { return [] }
	return _lsR(dir, '', o)
}

export function fileExists(path) {
	return fs.existsSync(path)
}

export function fileStat(path) {
	if (fileExists(path)) {
		return fs.statSync(path)
	}
	return null
}
export function permission(path) {
	const stat = fileStat(path)
	return stat && (stat.mode & parseInt(777, 8)).toString(8)
}

export function isDir(path) {
	return fileStat(path)?.isDirectory()
}

export function isFile(path) {
	return fileStat(path)?.isFile()
}

export function isSymlink(path) {
	return fileExists(path) && fs.lstatSync(path)?.isSymbolicLink()
}

export function symlink(src, dest) {
	return fs.symlinkSync(src, dest)
}

export function chmod(path, mode) { return fs.chmodSync(path, mode) }

export function readFile(path, encoding = 'utf-8') {
	return fs.readFileSync(path, encoding)
}

export function writeFile(path, data, encoding = 'utf-8') {
	return fs.writeFileSync(path, data, encoding)
}

export function mkdir(path) {
	fs.mkdirSync(path, { recursive: true })
}

/*
	opts
	replace: [ 'ほげほげ/ふがふが', 'HOGEHOGE/FUGAFUGA' ]

		'REPLACE_TARGET_STRING/REPLACE_STRING'

		# replace contents only

	replaceAll: true
	
		replace contents, file name and directory name

*/
export function cp(src, dest, opts = {}) {
	if (src == '~') { src = process.env.HOME }
	if (dest == '~') { dest = process.env.HOME }
	if (opts.replace) {
		if (isDir(src)) {
			const reSrc = new RegExp(`^${src}/`)
			for (const df of lsR(src, { dirName: true, fileOnly: false })) {
				let dfDest = df.replace(reSrc, dest)
				if (/\/$/.test(df)) {
					if (opts.replacePath) {
						for (let r of opts.replace) {
							r = r.split(/\//)
							dfDest = dfDest.replace(new RegExp(r[0], 'g'), r[1])
						}
					}
					mkdir(dfDest)
				}
				else {
					cp(df, dfDest, opts)
				}
			}
		}
		else {
			let data = readFile(src)
			const mode = permission(src)
			for (let r of opts.replace) {
				r = r.split(/\//)
				data = data.replace(new RegExp(r[0], 'g'), r[1])
				if (opts.replacePath) {
					dest = dest.replace(new RegExp(r[0], 'g'), r[1])
				}
			}
			const dir = dirname(dest)
			mkdir(dir)
			writeFile(dest, data)
			chmod(dest, mode)
		}
	}
	else {
		fse.copySync(src, dest, { overwrite: true })
	}
}

export function mv(src, dest) {
	fse.moveSync(src, dest, { overwrite: true })
}

export function rm(path) {
	return fileExists(path) && fs.unlinkSync(path)
}

export function touch(path, date = undefined) {
	if (!fileExists(path)) {
		fs.closeSync(fs.openSync(path, 'w'))
	}
	const dt = moment(date).toDate()
	fs.utimesSync(path, dt, dt)
}

// unit
// year or y, momth or M, day or d
// hour or h, minute or m, second or s
export function cleanup(dir, expire, unit = 'hour') {
	if (!isDir(dir)) { return }
	const now = moment()
	for (const file of ls(dir)) {
		const path = `${dir}/${file}`
		const stat = fileStat(path)
		const mtime = moment(stat.mtime)
		const diff = now.diff(mtime, unit)
		if (diff >= expire) {
			rm(path)
		}
	}
}

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
	return getJSData(readFile(path) , target)
}

export function writeObj2JS(path, target, residue, obj) {
	writeFile(path, residue.replace(`[[[${target}]]]`, target + dumpJSObj(obj, 0, {  })))
}

if (isMain(import.meta.url)) {
	(async () => {
		const Test = (await import('./test.js')).default
		const t = new Test()
		cp('hoge', 'xxx', {
			replace: [
				'fuga/zzz',
				'FUGA/ZZZ',
			],
			replacePath: true,
		})
		cl(lsR('xxx', { fileOnly: false, exclude: [ 'node_modules', 'node_modules/*', 'logs/*' ] }))
//    cl(lsR('~/hoge', { fileOnly: false, exclude: [ 'node_modules', 'node_modules/*', 'logs/*' ] }))
//    cl(ls('./'))
//    cl(ls('./', { include: [ '*.js' ] }))
//    cl(lsR('./', { exclude: [ '.*', 'node_modules/*' ] }))
//    cl(ls('./', { dirName: true }))
//    t.true(fileExists('index.js'))
//    t.true(isFile('index.js'))
//    t.true(isDir('db'))
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
