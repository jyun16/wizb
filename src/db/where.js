import { dd, isMain, isArray, isObject, split } from '../index.js'
import * as SQL from './sql.js'

const _f = (field) => {
  if (field.indexOf('->') > 0) {
    field = field.replace(/\\'/g, `'`)
    return field
  }
  const m = /(.+)\.(.+)/.exec(field)
  return m ? `${m[1]}.\`${m[2]}\`` : `\`${field}\``
}

class Self {
	constructor(data = {}) {
		this.data = data
		this.gen(data)
	}
	res() {
		return [ this.query, this.values ]
	}
	gen(data = {}) {
		if (data) { this.data = data }
		const opts = {}
		data = {}
		this.values = []
		if (isArray(this.data)) {
			data = this.data
		}
		else {
			for (const k in this.data) {
				const v = this.data[k]
				if (/^-/.test(k) && ![ '-and', '-or' ].includes(k)) {
					opts[k] = v
				}
				else {
					data[k] = v
				}
			}
		}
		const where = this._gen(data)
		const optsQuery = this.genOpts(opts)
		let query = where ? 'WHERE ' : ''
		query += where
		query += optsQuery
		this.query = query
		return [ this.query, this.values ]
	}
	_gen(data, andOr = 'AND', depth = 0) {
		const ret = []
		if (isArray(data)) {
			if (isObject(data[0])) {
				for (const d of data) {
					ret.push(this._gen(d, 'AND', depth + 1))
				}
			}
			else {
				for (let i = 0; i < data.length; i += 2) {
					const k = data[i], v = data[i + 1]
					this.__gen(ret, data, k, v, andOr, depth)
				}
			}
		}
		else {
			for (const k in data) {
				if (k == '-or') {
					this.__gen(ret, data, k, data[k], andOr, depth + 1)
				}
				else {
					this.__gen(ret, data, k, data[k], andOr, depth)
				}
			}
		}
		const clause = ret.join(` ${andOr} `)
		return depth > 1 ? `(${clause})` : clause
	}
	__gen(ret, data, k, v, andOr, depth) {
		const m = /^-(.+)/.exec(k)
		if (m) {
			const ope = m[1].toUpperCase()
			ret.push(this._gen(v, ope, depth + 1))
		}
		else {
			k = SQL.escape(k)
			if (isArray(v)) {
				this._gen_ope(ret, k, v)
			}
			else {
				ret.push(`${_f(k)}=?`)
				this.values.push(v)
			}
		}
	}
	_gen_ope(ret, k, v) {
		const ope = v.shift()
		if (/^[!=<>]+$/.test(ope)) {
			ret.push(`${_f(k)}${ope}?`)
			this.values.push(v[0])
		}
		else if (ope == 'in' || ope == 'notIn') {
			if (isArray(v[0])) {
				v = v[0]
			}
			const vv = [...Array(v.length).keys()].map(d => '?').join(',')
			ret.push(`${_f(k)} ${ope == 'in' ? 'IN' : 'NOT IN'} (${vv})`)
			for (const _v of v) {
				this.values.push(_v)
			}
		}
		else if (ope == 'raw') {
			ret.push(`${_f(k)}${v[0]}`)
		}
		else if (ope == 'isNull') {
			ret.push(`${_f(k)} IS NULL`)
		}
		else if (ope == 'isNotNull') {
			ret.push(`${_f(k)} IS NOT NULL`)
		}
		else if (ope == 'between') {
			ret.push(`${_f(k)} BETWEEN ? AND ?`)
			this.values = this.values.concat(v)
		}
		else if (/match/i.test(ope)) {
			let mode = ''
			if (ope == 'booleanMatch') {
				mode = ' IN BOOLEAN MODE'
			}
			else if (ope == 'naturalMatch') {
				mode = ' IN NATURAL LANGUAGE MODE'
			}
			else if (ope == 'expansionMatch') {
				mode = ' WITH QUERY EXPANSION'
			}
			ret.push(`MATCH(${_f(SQL.escape(k))}) AGAINST(?${mode})`)
			this.values = this.values.concat(v)
		}
		else {
			const m = /(not)?([iI])?([pP]re|[sS]uf)?[lL]ike/.exec(ope)
			if (m) {
				m.shift()
				let not , i
				not = m[0] == 'not' ? ' NOT' : ''
				i = [ 'i', 'I' ].includes(m[1]) ? ' COLLATE utf8_unicode_ci' : ''
				ret.push(`${_f(k)}${i}${not} LIKE ?`)
				if ([ 'pre', 'Pre' ].includes(m[2])) {
					v[0] = SQL.escape4like(v[0]) + '%'
				}
				else if ([ 'suf', 'Suf' ].includes(m[2])) {
					v[0] = '%' + SQL.escape4like(v[0])
				}
				else {
					v[0] = '%' + SQL.escape4like(v[0]) + '%'
				}
				this.values = this.values.concat(v)
			}
		}
	}
	genOpts(opts) {
		let ret = ''
		let v
		if (opts['-group']) {
			v = opts['-group']
			ret += ` GROUP BY ${[...Array(v.length).keys()].map(d => '?').join(',')}`
			this.values = this.values.concat(v)
		}
		if (opts['-having']) {
			v = opts['-having']
			const vv = SQL.escapes(v)
			ret += ` HAVING ${vv[0]}${vv[1]}${vv[2]}`
		}
		if (opts['-order']) {
			v = opts['-order']
			if (typeof(v) == 'string') { v = split(v) }
			if (v.length > 0) {
				v = v.map(vv => {
					let desc = false
					if (vv.match(/(.+)\s+DESC/)) {
						desc = true
						vv = RegExp.$1
					}
					return desc ? `${_f(vv)} DESC` : `${_f(vv)}`
				})
				ret += ` ORDER BY ${SQL.escapes(v).join(',')}`
			}
		}
		if (opts['-offset'] != undefined) {
			const limit = opts['-limit'] || 10
			ret += ` LIMIT ${SQL.escape(opts['-offset'])}, ${SQL.escape(limit)}`
		}
		else if (opts['-limit'] != undefined) {
			ret += ` LIMIT ${SQL.escape(opts['-limit'])}`
		}
		if (opts['-forupdate'] != undefined) {
			ret += ' FOR UPDATE'
		}
		return ret
	}
	dump(data) {
		this.gen(data)
		return SQL.bind(this.query, this.values)
	}
	toString() {
		return this.query
	}
}

export default Self

if (isMain(import.meta.url)) {
	(async () => {
		const Test = (await import('../test.js')).default
		const t = new Test()
		const w = new Self({
			'-and': {
				'foo': 'FOO',
				'-or': {
					'hoge': [ '!=', 'HOGE' ],
					'fuga': 'FUGA',
					'bar': [ '<', 100 ],
				}
			}
		})
		let qv = w.res()
		t.eq('WHERE `foo`=? AND (`hoge`!=? OR `fuga`=? OR `bar`<?)', qv[0])
		t.eq([ 'FOO', 'HOGE', 'FUGA', 100 ], qv[1])
		t.eq("WHERE `foo`='FOO' AND (`hoge`!='HOGE' OR `fuga`='FUGA' OR `bar`<100)", SQL.bind(qv[0], qv[1]))

		qv = w.gen({
			'hoge': [ 'in', 'HOGE1', 'HOGE2' ],
			'fuga': [ 'notIn', [ 'FUGA1', 'FUGA2' ] ],
		})
		t.eq('WHERE `hoge` IN (?,?) AND `fuga` NOT IN (?,?)', qv[0])
		t.eq([ 'HOGE1', 'HOGE2', 'FUGA1', 'FUGA2' ], qv[1])

		qv = w.gen({
			'hoge': [ 'raw', '=HOGE' ],
			'fuga': [ 'isNull'],
			'foo': [ 'isNotNull'],
		})
		t.eq('WHERE `hoge`=HOGE AND `fuga` IS NULL AND `foo` IS NOT NULL', qv[0])
		t.eq([], qv[1])

		qv = w.gen({
			'hoge': [ 'match', 'HOGE' ],
			'fuga': [ 'booleanMatch', '+HOGE -FUGA' ],
		})
		t.eq('WHERE MATCH(`hoge`) AGAINST(?) AND MATCH(`fuga`) AGAINST(? IN BOOLEAN MODE)', qv[0])
		t.eq([ 'HOGE', '+HOGE -FUGA' ], qv[1])

		qv = w.gen({
			'hoge': [ 'between', 0, 100 ],
		})
		t.eq('WHERE `hoge` BETWEEN ? AND ?', qv[0])
		t.eq([ 0, 100 ], qv[1])

		qv = w.gen({
			'a': [ 'like', 'A' ],
			'b': [ 'notLike', 'B' ],
			'c': [ 'iLike', 'C' ],
			'd': [ 'preLike', 'D' ],
		})
		t.eq('WHERE `a` LIKE ? AND `b` NOT LIKE ? AND `c` COLLATE utf8_unicode_ci LIKE ? AND `d` LIKE ?', qv[0])
		t.eq([ '%A%', '%B%', '%C%', 'D%' ], qv[1])

		qv = w.gen({
			'-offset': 0,
			'-limit': 10,
			'-group': [ 'hoge', 'fuga' ],
			'-order': 'foo,bar DESC',
			'-having': [ 'SUM(foo)', '>=', 3000 ]
		})
		t.eq(' GROUP BY ?,? HAVING SUM(foo)>=3000 ORDER BY `foo`,`bar` DESC LIMIT 0, 10', qv[0])
		t.eq([ 'hoge', 'fuga' ], qv[1])

		qv = w.gen({
			't.hoge': 'HOGE'
		})
		t.eq('WHERE t.`hoge`=?', qv[0])
		t.eq([ 'HOGE' ], qv[1])

		qv = w.gen({
			"data->'$.hoge'": 'HOGE'
		})
		t.eq(`WHERE data->'$.hoge'=?`, qv[0])
		t.eq([ 'HOGE' ], qv[1])

		qv = w.gen({
			'-or': [
				'status', 0,
				'-and', [
					'status', 1,
					'-or', [
						'user_id', 1,
						'user_id', [ 'in', 10, 11 ],
					],
				],
				'status', 2,
			],
			hoge: 'HOGE',
		})
		t.eq('WHERE (`status`=? OR (`status`=? AND (`user_id`=? OR `user_id` IN (?,?))) OR `status`=?) AND `hoge`=?', qv[0])
		t.eq([ 0, 1, 1, 10, 11, 2, 'HOGE' ], qv[1])

		qv = w.gen({
			'-or': [
				{
					status: 0,
				},
				{
					status: 1,
					'-or': [
						{
							user_id: 1,
						},
						{
							user_id: [ 'in', 10, 11 ],
						},
					],
				},
				{
					status: 2,
				}
			]
		})
		t.eq('WHERE ((`status`=?) OR (`status`=? AND ((`user_id`=?) OR (`user_id` IN (?,?)))) OR (`status`=?))', qv[0])
		t.eq([ 0, 1, 1, 10, 11, 2 ], qv[1])

		qv = w.gen([
			'id', [ '>=', 2 ],
			'id', [ '<', 12 ],
		])
		t.eq('WHERE `id`>=? AND `id`<?', qv[0])
		t.eq([ 2, 12 ], qv[1])

		qv = w.gen([
			'cnt', [ 'raw', '!=retry' ],
		])
		t.eq('WHERE `cnt`!=retry', qv[0])
		t.eq([], qv[1])

		qv = w.gen({
			'-forupdate': true
		})
		t.eq(' FOR UPDATE', qv[0])
		t.eq([], qv[1])
	})()
}
