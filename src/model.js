import { cl, isMain, isString, clone, split, merge, concat } from './index.js'
import Query from './db/query.js'
import * as SQL from './db/sql.js'

class Self {
	constructor(conn, table) {
		this.conn = conn
		this.table = table
		this.alias = ''
		this.logicalDelete = false
		this.join = null
	}
	async begin() { await this.conn.begin() }
	async commit() { await this.conn.commit() }
	async rollback() { await this.conn.rollback() }
	async end() { await this.conn.end() }
	async query(sql, value) { return this.conn.query(sql, value) }
	async execute(sql, value) { return this.conn.execute(sql, value) }
	async executeAsArray(sql, value) { return this.conn.executeAsArray(sql, value) }
	async exists(w={}) {
		w = this.where(w)
		return await this.count(w) > 0
	}
	ignoreFields() {
		return (this.logicalDelete ? [ 'deleted' ] : []).concat([ 'created', 'modified' ])
	}
	where(w) {
		if (this.logicalDelete && !w['-force']) {
			w = clone(w)
			w.deleted = [ 'isNull' ]
		}
		if (this.join) {
			w = clone(w)
			w['-join'] = this.join
		}
		return w
	}
	selfName() {
		return this.alias ? `${this.table} AS ${this.alias}` : this.table
	}
	_count(w={}, fields='*') {
		const q = new Query()
		w = this.where(w)
		q.count(this.selfName(), clone(w), fields)
		return q
	}
	async count(w={}, fields='*') {
		const q = this._count(w, fields)
		const rows = await this.execute(q.query, q.values)
		return rows[0] ? rows[0].count : 0
	}
	countDump(w, fields) {
		const q = this._count(w, fields)
		return SQL.bind(q.query, q.values)
	}
	_select(w={}, fields='*', filter=[]) {
		const q = new Query()
		w = this.where(w)
		if (this.appendField && fields == '*') {
			fields = `${this.table}.*,${this.appendField}`
		}
		q.select(this.selfName(), w, fields)
		return q
	}
	async select(w={}, fields='*', filter=[], asArray=false) {
		const q = this._select(w, fields, filter)
		const ret = asArray ? await this.executeAsArray(q.query, q.values) : await this.execute(q.query, q.values)
		if (filter.length) {
			const filterdRet = []
			for (const d of ret) {
				for (const f of filter) { delete d[f] }
				filterdRet.push(d)
			}
			return filterdRet
		}
		return ret
	}
	async selectAsArray(w={}, fields='*', filter=[]) {
		return this.select(w, fields, filter, true)
	}
	selectDump(w, fields, filter) {
		const q = this._select(w, fields, filter)
		return SQL.bind(q.query, q.values)
	}
	async selectPrune(w={}, fields='*', filter=[], asArray=false) {
		if (isString(filter)) { filter = split(filter) }
		return this.select(w, fields, concat(filter, this.ignoreFields()), asArray)
	}
	async selectPruneAsArray(w={}, fields='*', filter=[]) {
		return this.selectPrune(w, fields, filter, true)
	}
	async id(w) {
		const row = await this.one(w, [ 'id' ])
		return row ? row['id'] : null
	}
	async one(w={}, fields='*', filter=[]) {
		if (isString(filter)) { filter = split(filter) }
		w['-limit'] = [ 0, 1 ]
		w = this.where(w)
		const row = await this.select(w, fields)
		const ret = row[0]
		if (ret) {
			for (const f of filter) {delete ret[f] }
		}
		return ret;
	}
	async onePrune(w, fields='*', filter=[]) {
		if (isString(filter)) { filter = split(filter) }
		return this.one(w, fields, concat(filter, this.ignoreFields()))
	}
	async get(id, filter=[]) {
		let w = { [`${this.selfName()}.id`]: id }
		w = this.where(w)
		const ret = await this.one(w)
		if (ret) { for (const f of filter) { delete ret[f] } }
		return ret;
	}
	async getPrune(id, filter=[]) {
		if (isString(filter)) { filter = split(filter) }
		return this.get(id, concat(filter, this.ignoreFields()))
	}
	async take(id, fields) {
		return this.one({ id }, fields)
	}
	async value(field, w={}) {
		const row = await this.one(w, field)
		return row ? row[field] : null
	}
	async values(field, w={}) {
		const ret = []
		const rows = await this.select(w, field)
		for (const row of rows) {
			ret.push(row[field])
		}
		return ret
	}
	async insert(d) {
		const q = new Query()
		q.insert(this.selfName(), d)
		const res = await this.execute(q.query, q.values)
		return res.insertId
	}
	async insertDump(d) {
		const q = new Query()
		q.insert(this.selfName(), d)
		return SQL.bind(q.query, q.values)
	}
	async update(d, w) {
		const q = new Query()
		q.update(this.selfName(), d, w)
		const res = await this.execute(q.query, q.values)
		return res.changedRows
	}
	async updateDump(d, w) {
		const q = new Query()
		q.update(this.selfName(), d, w)
		return SQL.bind(q.query, q.values)
	}
	// return insert id. insert id is 0 zen update.
	async upsert(d, primaryKey) {
		const q = new Query()
		q.upsert(this.selfName(), d, primaryKey)
		const res = await this.execute(q.query, q.values)
		return res.insertId
	}
	async upsertDump(d, primaryKey) {
		const q = new Query()
		q.upsert(this.selfName(), d, primaryKey)
		return SQL.bind(q.query, q.values)
	}
	async delete(w) {
		const q = new Query()
		if (this.logicalDelete && !w['-force']) {
			q.update(this.selfName(), { deleted: [ 'now' ] }, w)
			const res = await this.execute(q.query, q.values)
			return res.changedRows
		}
		else {
			q.delete(this.selfName(), w)
			const res = await this.execute(q.query, q.values)
			return res.affectedRows
		}
	}
	async deleteDump(w) {
		const q = new Query()
		if (this.logicalDelete && !w['-force']) {
			q.update(this.selfName(), { deleted: [ 'now' ] }, w)
		}
		else {
			q.delete(this.selfName(), w)
		}
		return SQL.bind(q.query, q.values)
	}
	async undelete(w) {
		const q = new Query()
		if (this.logicalDelete && !w['-force']) {
			q.update(this.selfName(), { deleted: [ 'null' ] }, w)
			const res = await this.execute(q.query, q.values)
			return res.changedRows
		}
	}
	async findPage(listWhere, w) {
		const q = new Query()
		listWhere = clone(listWhere)
		if (this.logicalDelete && !listWhere['-force']) {
			listWhere['deleted'] = [ 'isNull' ]
		}
		q.findPage(this.selfName(), listWhere, w)
		const r = await this.execute(q.query, q.values)
		return r[0]?.page_number
	}
	async save(d) {
		return this.upsert(d, 'id')
	}
	async load(id) {
		return this.get(id)
	}
	pagerData(limit, count, page, w) {
		w = clone(w)
		const maxPage = Math.ceil(count / limit) || 1
		let curPage = page || 1
		if (maxPage < curPage) { curPage = maxPage }
		w = merge(w, {
			'-offset': (curPage - 1) * limit,
			'-limit': limit,
		})
		return { w, curPage }
	}
	async isDeleted(id) {
		return !(await this.exists({ id }))
	}
}

export default Self

if (isMain(import.meta.url)) {
	(async() => {
	})()
}
