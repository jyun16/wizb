import _ from 'lodash'
import { isMain, isString, isObject } from './index.js'

export function merge(v1, v2) { return _.merge({}, v1, v2) } 

export function keyValues(o) { return Object.entries(o || {}) }
export function keys(o) { return Object.keys(o) }
export function entries2Object(o) { return Object.fromEntries(o) }
export const trimObject = o => {
	Object.keys(o).forEach(k => {
		 if (o[k] == null || o[k] == '') delete o[k]
	})
	return o
}

export function addCountMap(obj, key) {
	const r = {}
	if (!(key in obj)) {
		for (const k in obj) r[k] = obj[k] + 1
		r[key] = 0
		return r
	}
	const v = obj[key]
	if (v > 0) return obj
	r[key] = v + 1
	for (const k in obj) if (k !== key) r[k] = obj[k] <= r[key] ? 0 : obj[k]
	return objectSortByVal(r, true)
}

export function reduceMap(a, offset, limit) {
	return Object.fromEntries(Object.entries(a).slice(offset, offset + limit))
}

export function deepFreeze(o = {}) {
	for (const [ k, v ] of Object.entries(o)) {
		if (v && typeof v == 'object') {
			deepFreeze(v)
		}
	}
	return Object.freeze(o)
}

export function removeEmptyVal(o) {
	o = { ...o }
	for (const k in o) { if (isEmpty(o[k])) { delete o[k] } }
	return o
}

export function remap(m) {
	const ret = {}	
	for (const [ k, v ] of Object.entries(m)) { ret[v] = k }
	return ret
}

export function objectSortByVal(obj, desc=false) {
	const entries = Object.entries(obj)
	return Object.fromEntries(desc ? entries.sort(([, x ], [, y ]) => y - x) : entries.sort(([, x ], [, y ]) => x - y))
}

export function sortObjectList(list, key) {
	return list.sort((a, b) => {
		a = parseInt(a[key])
		b = parseInt(b[key])
		if (a < b) { return -1	}
		else if (a < b) { return 1 }
		else { return 0 }
	})
}

function splitPath(key) {
	if (isString(key)) {
		return key.replace(/\[(\w+)\]/g, '.$1').split('.');
	}
	return key;
}

export function setMapVal(obj, key, value) {
	const path = splitPath(key);
	let cur = obj;
	for (let i = 0; i < path.length; i++) {
		const k = path[i];
		if (i === path.length - 1) {
			cur[k] = value;
		}
		else {
			if (!(k in cur) || typeof cur[k] !== 'object') {
				const next = path[i + 1];
				cur[k] = /^\d+$/.test(next) ? [] : {};
			}
			cur = cur[k];
		}
	}
	return obj;
}

export function getMapVal(obj, key) {
	const path = splitPath(key);
	let cur = obj;
	for (const k of path) {
		if (cur == null || typeof cur !== 'object' || !(k in cur)) return null;
		cur = cur[k];
	}
	return cur;
}

export function deleteMapVal(obj, key) {
	const path = splitPath(key);
	let cur = obj;
	for (let i = 0; i < path.length - 1; i++) {
		const k = path[i];
		if (cur == null || typeof cur !== 'object' || !(k in cur)) return;
		cur = cur[k];
	}
	delete cur[path[path.length - 1]];
}

export function hasMapKey(obj, key) {
	const path = splitPath(key);
	let cur = obj;
	for (const k of path) {
		if (cur == null || typeof cur !== 'object' || !(k in cur)) return false;
		cur = cur[k];
	}
	return true;
}

export function deleteMapByVal(obj, value) {
	for (const k in obj) {
		if (obj[k] === value) {
			delete obj[k];
			return k;
		}
	}
	return null;
}

function _getMapKeys(ret, map, pk) {
	for (let k in map) {
		const v = map[k];
		const key = `${pk}.${k}`;
		if (isObject(v)) {
			_getMapKeys(ret, v, key);
		} else {
			ret.push(key);
		}
	}
}

export function getMapKeys(map) {
	const ret = [];
	for (let k in map) {
		const v = map[k];
		if (isObject(v)) {
			_getMapKeys(ret, v, k);
		} else {
			ret.push(k);
		}
	}
	return ret;
}

export function sliceMapVal(obj, key, start, end) {
	const arr = getMapVal(obj, key);
	if (!Array.isArray(arr)) throw new Error(`Value at "${key}" is not an array`);
	return arr.slice(start, end);
}

export function spliceMapVal(obj, key, start, deleteCount, ...items) {
	const arr = getMapVal(obj, key);
	if (!Array.isArray(arr)) throw new Error(`Value at "${key}" is not an array`);
	return arr.splice(start, deleteCount, ...items);
}

export function swapKeyVal(map) {
	const ret = {}
	for (const k in map) {
		ret[map[k]] = k
	}
	return ret
}

export function mixin(target, mixins) {
	if (!isArray(mixins)) { mixins = [ mixins ] }
	mixins.forEach(mixin => {
		Object.keys(mixin).forEach(key => {
			if (typeof target.prototype[key] === 'function') {
				target.prototype[`super_${key}`] = target.prototype[key]
			}
		})
		Object.assign(target.prototype, mixin)
	})
}

export function dumpJSObj(obj, tab=0, opts={}) {
	opts = merge({ quote: "'" }, opts)
	return `${'\t'.repeat(tab)}{${_dumpJSObj(obj, ++tab, opts).replace(/^{/, '')}`
}

export function _dumpJSObj(obj, tab, opts) {
	const chkKey = k => /^[a-zA-Z_$][a-zA-Z_$0-9]*$/.test(k)
	const dumpKey = k => (chkKey(k) ? k : `${opts.quote}${k}${opts.quote}`)
	const dumpVal = v => {
		if (typeof v === 'string') return `${opts.quote}${v}${opts.quote}`
		if (Array.isArray(v)) {
			return `[\n${v.map(v => `${'\t'.repeat(tab + 1)}${dumpVal(v)}`).join(',\n')}\n${'\t'.repeat(tab)}]`
		}
		if (typeof v === 'object' && v !== null) return _dumpJSObj(v, tab + 1, opts)
		return String(v)
	}
	const entries = Object.entries(obj).map(
		([k, v]) => `${'\t'.repeat(tab)}${dumpKey(k)}: ${dumpVal(v)}`
	)
	return `{\n${entries.join(',\n')}\n${'\t'.repeat(tab - 1 >= 0 ? tab - 1 : 0)}}`
}

if (isMain(import.meta.url)) {
	(async () => {
		const Test = (await import('./test.js')).default
		const t = new Test()

		t.eq({ foo: 'FOO', hoge: { fuga: 'FUGA' } }, setMapVal({ foo: 'FOO' }, 'hoge.fuga', 'FUGA'))

		let map = {}
		t.eq(setMapVal(map, 'val.xxx', 'XXX'), { val: { xxx: 'XXX' }})
		t.eq(setMapVal(map, 'val.yyy', 'YYY'), { val: { xxx: 'XXX', yyy: 'YYY' }})
		t.eq(setMapVal(map, 'val.zzz', 'ZZZ'), { val: { xxx: 'XXX', yyy: 'YYY', zzz: 'ZZZ' }})
		deleteMapVal(map, 'val.zzz')
		t.eq(map, { val: { xxx: 'XXX', yyy: 'YYY' }})

		map = { hoge: 'HOGE', fuga: [ 'FUGA 1', { foo: 'FOO' }, 'FUGA 3' ] }
		t.eq(setMapVal(map, 'fuga[1].foo', 'XXX'), { hoge: 'HOGE', fuga: [ 'FUGA 1', { foo: 'XXX' }, 'FUGA 3' ] })

		t.eq(getMapVal({ foo: 'FOO', hoge: { fuga: 'FUGA' } }, 'foo'), 'FOO')
		t.eq(getMapVal({ foo: 'FOO', hoge: { fuga: 'FUGA' } }, 'foo.bar'), null)
		t.eq(getMapVal({ foo: 'FOO', hoge: { fuga: 'FUGA' } }, 'hoge'), { fuga: 'FUGA' })
		t.eq(getMapVal({ foo: 'FOO', hoge: { fuga: 'FUGA' } }, 'hoge.fuga'), 'FUGA')
		t.eq(getMapVal({ foo: 'FOO', hoge: { fuga: 'FUGA' } }, 'hoge.fuga.foo'), null)
		t.eq(getMapVal({ foo: [ 'FOO 1', 'FOO 2', 'FOO 3' ] }, 'foo[1]'), 'FOO 2')
		t.eq(getMapVal({ foo: [ 'FOO 1', { bar: 'BAR' }, 'FOO 3' ] }, 'foo[1].bar'), 'BAR')
		t.eq(getMapVal({ foo: { bar: [ 'BAR 1', 'BAR 2', 'BAR 3' ] }}, 'foo.bar[1]'), 'BAR 2')

		t.eq(getMapKeys({
			'1': 'X',
			'2': {
				'2-1': 'X',
				'2-2': 'X',
				'2-3': {
					'2-3-1': 'X',
				}
			}
		}), [ '1', '2.2-1', '2.2-2', '2.2-3.2-3-1' ])

		t.true(hasMapKey({ foo: 'FOO', hoge: { fuga: { foo: { bar: true } } } }, 'hoge.fuga.foo.bar'))
		t.false(hasMapKey({ foo: 'FOO', hoge: { fuga: { foo: { bar: true } } } }, 'hoge.fuga.x'))
		t.true(hasMapKey({ foo: [ 'FOO 1', { bar: 'BAR' }, 'FOO 3' ] }, 'foo[1].bar'))

		map = { hoge: 'HOGE', fuga: [ 'FUGA 1', { foo: 'FOO' }, 'FUGA 3' ] }
		deleteMapVal(map, 'fuga[1].foo')
		t.eq(map, { hoge: 'HOGE', fuga: [ 'FUGA 1', {}, 'FUGA 3' ] })

		map = { hoge: 'HOGE', fuga: [ 'FUGA 1', { foo: [ 'FOO 1', { bar: 'BAR' }, 'FOO 2' ] }, 'FUGA 3' ] }
		t.eq(sliceMapVal(map, 'fuga[1].foo', 1, 2), [ { bar: 'BAR' } ])

		spliceMapVal(map, 'fuga[1].foo', 1, 1)
		t.eq(map, { hoge: 'HOGE', fuga: [ 'FUGA 1', { foo: [ 'FOO 1', 'FOO 2' ] }, 'FUGA 3' ] } )

		const mmm = { hoge: 'HOGE', fuga: 'FUGA', foo: null, bar: '' }
		deleteMapByVal(mmm, 'FUGA')
		deleteMapByVal(mmm, null)
		deleteMapByVal(mmm, '')
		t.eq(mmm, { hoge: 'HOGE' })

		t.eq(reduceMap({ hoge: 10, fuga: 11, foo: 12, bar: 13, baz: 14 }, 1, 3), { fuga: 11, foo: 12, bar: 13 })

		let m = {}
		m = addCountMap(m, 'hoge')
		t.eq({ hoge: 0 }, m)
		m = addCountMap(m, 'fuga')
		t.eq({ hoge: 1, fuga: 0 }, m)
		m = addCountMap(m, 'fuga')
		t.eq({ fuga: 1, hoge: 0 }, m)
		m = addCountMap(m, 'fuga')
		t.eq({ fuga: 1, hoge: 0 }, m)
		m = addCountMap(m, 'hoge')
		t.eq({ hoge: 1, fuga: 0 }, m)
		m = addCountMap(m, 'foo')
		t.eq({ hoge: 2, fuga: 1, foo: 0 }, m)
		m = addCountMap(m, 'foo')
		t.eq({ hoge: 2, foo: 1, fuga: 0 }, m)
		m = addCountMap(m, 'fuga')
		t.eq({ hoge: 2, fuga: 1, foo: 0 }, m)
		m = addCountMap(m, 'hoge')
		t.eq({ hoge: 2, fuga: 1, foo: 0 }, m)
		m = addCountMap(m, 'bar')
		t.eq({ hoge: 3, fuga: 2, foo: 1, bar: 0 }, m)
	})()
}
