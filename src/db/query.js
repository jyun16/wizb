import { isString, isArray, isMap, isObject, array2obj, split } from 'wiz'
import { dd, isMain } from '../index.js'
import Where from './where.js'
import * as SQL from './sql.js'

class Self {
	res() {
		return [ this.query, this.values ]
	}
	clear() {
		this.query = ''
		this.values = []
	}
	count(table, where = {}, fields = '*') {
		return this._selectCount(table, where, fields, 'count')
	}
	select(table, where = {}, fields = '*') {
		return this._selectCount(table, where, fields, 'select')
	}
	selectForUpdate(table, where = {}, fields = '*') {
		const ret = this._selectCount(table, where, fields, 'select')
		ret[0] += ' FOR UPDATE'
		return ret
	}
	_fields(fields, alias, mode) {
		if (fields == '*') { return alias && mode != 'count' ? `${alias}.*` : '*' }
		if (typeof fields == 'string') { fields = split(fields) }
		return SQL.escapes(fields).map(f => {
			if (f.indexOf('->') > 0) { return f.replace(/\\'/g, `'`) }
			const m = /(.+)\.([^\s]+)(.+)?/.exec(f)
			if (m) {
				if (m[3]) { return `${m[1]}.\`${m[2]}\`${m[3]}` }
				if (m[2] != '*') { return `${m[1]}.\`${m[2]}\`` }
				return f
			}
			if (/^:/.test(f)) { return f.replace(/^:/, '') }
			return alias ? `${alias}.\`${f}\`` : `\`${f}\``
		}).join(',')
	}
	_where(where = {}, mode = 'select') {
		if (!(where instanceof Where)) {
			if (mode != 'select') {
				delete where['-offset']
				delete where['-limit']
				delete where['-order']
				if (mode != 'count') {
					delete where['-group']
					delete where['-having']
				}
			}
			where = new Where(where)
		}
		return where
	}
	_selectCount(table, where, fields, mode) {
		this.clear()
		const alias = where['-alias']
		if (alias) {
			table += ` AS ${alias}`
		}
		fields = this._fields(fields, alias, mode)
		if (where['-join']) {
			const join = where['-join']
			if (isObject(join) && !isArray(join)) {
				const esc = s => {
					const m = /(.+)\.(.+)/.exec(s)
					return m ? `${m[1]}.\`${m[2]}\`` : `\`${s}\``
				}
				for (const k in join) {
					const v = join[k]
					const type = k.startsWith('<') ? 'LEFT JOIN' : 'INNER JOIN'
					const tbl = esc(k.replace(/^</, ''))
					const on1 = esc(v[1])
					const on2 = esc(v[2].indexOf('.') > 0 ? v[2] : (alias ? `${alias}.${v[2]}` : v[2]))
					table += ` ${type} ${tbl} ${v[0]} ON ${on1} = ${on2}`
				}
			}
			else {
				table += ' ' + (isArray(join) ? join.join(' ') : join)
			}
			delete where['-join']
		}
		where = this._where(where, mode)
		this.query = mode == 'select' ? `SELECT ${fields} FROM ${table} ${where}` : `SELECT COUNT(${fields}) AS count FROM ${table} ${where}`
		this.values = where.values
		return [ this.query, this.values ]
	}
	insert(table, data) {
		let fields = [], tmpValues = [], values = []
		for (const k in data) {
			const v = data[k]
			fields.push(SQL.escape(k))
			tmpValues.push(v)
		}
		const f = this._fields(fields)
		const v = []
		tmpValues.forEach((_v, i) => {
			if (isArray(_v)) {
				if (_v == 'now') { v.push('NOW()') }
			}
			else {
				values.push(_v)
				v.push('?')
			}
		})
		this.query = `INSERT INTO ${table} (${f}) VALUES (${v.join(',')})`
		this.values = values
		return [ this.query, this.values ]
	}
	update(table, data, where) {
		where = this._where(where, 'update')
		let fields = [], tmpValues = [], values = []
		for (const k in data) {
			const v = data[k]
			fields.push(SQL.escape(k))
			tmpValues.push(v)
		}
		const v = []
		fields.forEach((field, i) => {
			const _v = tmpValues[i]
			if (isArray(_v)) {
				if (_v[0] == 'now') {
					v.push(`\`${field}\`=NOW()`)
				}
				else if (_v[0] == 'null') {
					v.push(`\`${field}\`=NULL`)
				}
				else if (_v[0] == 'raw') {
					v.push(`\`${field}\`=${_v[1]}`)
				}
			}
			else {
				values.push(_v)
				v.push(`\`${field}\`=?`)
			}
		})
		values = values.concat(where.values)
		this.query = `UPDATE ${table} SET ${v} ${where}`
		this.values = values
		return [ this.query, this.values ]
	}
	upsert(table, data, primaryKey = 'id') {
		let [ q, v ] = this.insert(table, data)
		q += ' ON DUPLICATE KEY UPDATE'
		if (isString(primaryKey)) { primaryKey = split(primaryKey) }
		primaryKey = array2obj(primaryKey)
		const dupVals = []
		for (const k of Object.keys(data)) {
			if (k in primaryKey) { continue }
			if (!isArray(data[k])) {
				dupVals.push(`\`${k}\`=VALUES(\`${k}\`)`)
			}
		}
		this.query = q + ` ${dupVals.join(',')}`
		return [ this.query, this.values ]
	}
	delete(table, where) {
		where = this._where(where, 'delete')
		this.query = `DELETE FROM ${table} ${where}`
		this.values = where.values
		return [ this.query, this.values ]
	}
	toString() {
		return this.query
	}
	findPage(table, listWhere, where) {
		let limit = 10
		if (isObject(listWhere)) {
			if (listWhere['-limit']) { limit = listWhere['-limit']; delete listWhere['-limit'] }
			listWhere = new Where(listWhere)
		}
		delete listWhere.data['-limit']
		if (isObject(where)) { where = new Where(where) }
		const sql = `SELECT CEIL(rnk/${limit}) AS page_number FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rnk FROM ${table} ${listWhere}) AS sub ${where}`
		this.query = sql
		this.values = listWhere.values.concat(where.values)
		return [ this.query, this.values ]
	}
	countDump(table, where, fields) {
		this.count(table, where, fields)
		return SQL.bind(this.query, this.values).trim()
	}
	selectDump(table, where, fields) {
		this.select(table, where, fields)
		return SQL.bind(this.query, this.values).trim()
	}
	insertDump(table, data) {
		this.insert(table, data)
		return SQL.bind(this.query, this.values).trim()
	}
}

export default Self

if (isMain(import.meta.url)) {
	(async () => {
		const Test = (await import('wiz/test')).default
		const t = new Test()
		const sql = new Self()
		let qv

		qv = sql.selectDump('crud', {
			'-alias': 'c',
			'text': 'HOGE',
		}, 'radio, select')
		t.eq("SELECT c.`radio`,c.`select` FROM crud AS c WHERE c.`text`='HOGE'", qv)

		qv = sql.selectDump('crud', {
			'-alias': 'c',
			'-join': {
				'user': [ 'u', 'u.id', 'user_id' ],
				'<log': [ 'l', 'l.user_id', 'user_id' ],
			},
		}, 'radio, select. u.name')
		t.eq("SELECT c.`radio`,select. u.`name` FROM crud AS c INNER JOIN `user` u ON u.`id` = c.`user_id` LEFT JOIN `log` l ON l.`user_id` = c.`user_id`", qv)

		qv = sql.select('test AS t', {
			't.name': [ 'like', 'HOGE' ],
			'-join': [
				'INNER JOIN hoge h ON h.id = t.hoge_id',
				'INNER JOIN fuga f ON f.id = t.fuga_id',
			],
		}, [ 't.*', 't.hoge', 't.fuga', 'h.name AS hoge_name' ])
		t.eq('SELECT t.*,t.`hoge`,t.`fuga`,h.`name` AS hoge_name FROM test AS t INNER JOIN hoge h ON h.id = t.hoge_id INNER JOIN fuga f ON f.id = t.fuga_id WHERE t.`name` LIKE ?', qv[0])
		t.eq([ '%HOGE%' ], qv[1])

		qv = sql.select('test AS t', {
			't.name': [ 'like', 'HOGE' ],
			'-join': [
				'INNER JOIN hoge h ON h.id = t.hoge_id',
				'INNER JOIN fuga f ON f.id = t.fuga_id',
			],
		}, [ 't.*', 't.hoge', 't.fuga', 'h.name AS hoge_name' ])
		t.eq('SELECT t.*,t.`hoge`,t.`fuga`,h.`name` AS hoge_name FROM test AS t INNER JOIN hoge h ON h.id = t.hoge_id INNER JOIN fuga f ON f.id = t.fuga_id WHERE t.`name` LIKE ?', qv[0])
		t.eq([ '%HOGE%' ], qv[1])

		qv = sql.count('test', {
			hoge: 'HOGE',
			'-offset': 0,
			'-limit': 10,
		}, [ 'hoge' ]);
		t.eq('SELECT COUNT(`hoge`) AS count FROM test WHERE `hoge`=?', qv[0])
		t.eq([ 'HOGE' ], qv[1])

		qv = sql.count('test', {
			hoge: 'HOGE',
		}, [ 'hoge' ]);
		t.eq('SELECT COUNT(`hoge`) AS count FROM test WHERE `hoge`=?', qv[0])
		t.eq([ 'HOGE' ], qv[1])

		qv = sql.select('test', {
			hoge: 'HOGE',
			'-offset': 0,
			'-limit': 10,
		}, [ 'hoge' ]);
		t.eq('SELECT `hoge` FROM test WHERE `hoge`=? LIMIT 0, 10', qv[0])
		t.eq([ 'HOGE' ], qv[1])

		qv = sql.insert('test', {
			hoge: 'HOGE',
			now: [ 'now' ],
			fuga: 'FUGA',
		});
		t.eq('INSERT INTO test (`hoge`,`now`,`fuga`) VALUES (?,NOW(),?)', qv[0])
		t.eq([ 'HOGE', 'FUGA' ], qv[1])

		qv = sql.update('test', {
			hoge: 'HOGE',
			fuga: 'FUGA',
			now: [ 'now' ],
		}, {
			id: 30
		});
		t.eq('UPDATE test SET `hoge`=?,`fuga`=?,`now`=NOW() WHERE `id`=?', qv[0])
		t.eq([ 'HOGE', 'FUGA', 30 ], qv[1])

		qv = sql.upsert('test', {
			hoge: 'HOGE',
			fuga: 'FUGA',
			now: [ 'now' ],
		}, [ 'fuga' ]);
		t.eq('INSERT INTO test (`hoge`,`fuga`,`now`) VALUES (?,?,NOW()) ON DUPLICATE KEY UPDATE `hoge`=VALUES(`hoge`)', qv[0])
		t.eq([ 'HOGE', 'FUGA' ], qv[1])

		qv = sql.delete('test', {
			id: 30
		});
		t.eq('DELETE FROM test WHERE `id`=?', qv[0])
		t.eq([ 30 ], qv[1])

		qv = sql.select('test', {
			"data->'$.to_user_id'": 10
		}, (`data->'$.from_user_id' AS user`))
		t.eq("SELECT data->'$.from_user_id' AS user FROM test WHERE data->'$.to_user_id'=?", qv[0])
		t.eq([ 10 ], qv[1])

		qv = sql.select('test', {
			'-alias': 't',
			't.hoge': 'HOGE',
		})
		t.eq("SELECT t.* FROM test AS t WHERE t.`hoge`=?", qv[0])

		// : <- Do not escape if this prefix is attached
		qv = sql.select('test', {
			hoge: 'HOGE',
		}, [ ':MAX(priority) AS max_priority' ]);
		t.eq('SELECT MAX(priority) AS max_priority FROM test WHERE `hoge`=?', qv[0])
		t.eq([ 'HOGE' ], qv[1])

		qv = sql.findPage('crud', { text: [ 'like', '1' ], '-limit': 5 }, { id: 40 })
		t.eq('SELECT CEIL(rnk/5) AS page_number FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rnk FROM crud WHERE `text` LIKE ?) AS sub WHERE `id`=?', qv[0])
		t.eq([ '%1%', 40 ], qv[1])

		qv = sql.update('test', {
			deleted: [ 'null' ]
		}, { id: 5 })
		t.eq('UPDATE test SET `deleted`=NULL WHERE `id`=?', qv[0])
		t.eq([ 5 ], qv[1])

		qv = sql.update('test', {
			priority: [ 'raw', 'priority+1' ],
		}, {
			'-and': [
				'id', [ '>=', 2 ],
				'id', [ '<', 12 ]
			]
		});
		t.eq('UPDATE test SET `priority`=priority+1 WHERE `id`>=? AND `id`<?', qv[0])
		t.eq([ 2, 12 ], qv[1])

		qv = sql.delete('test', {
			"data->'$.from_user_id'": 10
		})
		t.eq("DELETE FROM test WHERE data->'$.from_user_id'=?", qv[0])
		t.eq([ 10 ], qv[1])

	})()
}
