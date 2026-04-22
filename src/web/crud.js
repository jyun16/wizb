const libs = require('../index')

module.exports = class {

	async mgen() {
		return this.fa['m_' + this.name](await this.fa.db())
	}

	listFilter(list) { return list }

	constructor(fa, af, name, base, limit = 10) {

		this.fa = fa
		this.af = af
		this.base = base
		this.name = name
		this.limit = limit
		this.sessionName = 'form-' + name

		fa.get(`${base}`, async (req, res) => {
			res.redirect(base + 'list')
		})

		fa.get(`${base}list`, async (req, res) => {
			const m = await this.mgen()
			const p = req.query
			let curPage = p.p || 1
			const where = {}
			const total = await m.count(where)
			const maxPage = Math.ceil(total / limit)
			if (curPage > maxPage) { curPage = maxPage }
			where['-limit'] = [ (curPage - 1) * limit , limit ]
			if (p.o) {
				const order = []
				const o = p.o.split(',')
				for (const _o of o) {
					if (_o.match(/(.+)-d$/)) { order.push(RegExp.$1 + ' DESC') }
					else { order.push(_o) }
				}
				where['-order'] = order
			}
			const list = await m.select(where, '*')
			af.hide('list')
			return libs.view(`${base}/list`, {
				base: base,
				af: af,
				list: this.listFilter(af.toListValues(list)),
				curPage: curPage,
				total: total,
				limit: limit,
			}, req, res)
		})

		fa.get(`${base}show/:id`, async (req, res) => {
			const id = req.params.id
			const p = req.query
			const m = await this.mgen()
			if (id) {
				af.hide('show')
				af.fromDBValue(await m.get4modify(id))
			}
			return libs.view(`${base}/show`, { af: af, base: base }, req, res)
		})

		fa.get(`${base}register/:id`, async (req, res) => {
			const id = req.params.id
			const p = req.query
			const m = await this.mgen()
			if (id) {
				af.hide('update')
				af.fromDBValue(await m.get4modify(id))
			}
			return libs.view(`${base}/register`, { af: af, base: base }, req, res)
		})

		fa.post(`${base}register/:id`, async (req, res) => {
			const p = req.body
			const m = await this.mgen()
			if (p.id) {
				af.hide('update')
			}
			af.validation()
			if (af.hasError()) {
				return libs.view(`${base}/register`, { af: af, base: base }, req, res)
			}
			else {
				req.$session[this.sessionName] = af.toDBValue()
				res.redirect(`${base}doRegister`)
			}
		})

		fa.get(`${base}doRegister`, async (req, res) => {
			const p = req.$session[this.sessionName]
			const m = await this.mgen()
			if (p['id'] == '') { delete p['id'] }
			const insertId = await m.upsert(p, 'id')
			delete req.$session[this.sessionName]
			return { insertId: insertId }
		})

		fa.get(`${base}delete/:id`, async (req, res) => {
			const m = await this.mgen()
			if (await m.delete({ id: req.params.id })) {
				return { ok: true }
			}
			else {
				return { ok: false }
			}
		})

	}

}
