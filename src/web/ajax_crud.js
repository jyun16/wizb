module.exports = {
	
	async crud(fa, base, mgen) {

		fa.get(`${base}get/:id`, async (req, res) => {
			const m = await mgen(fa)
			const data = await m.get(req.params.id)
			return { data: data || {} }
		})

		fa.get(`${base}select`, async (req, res) => {
			const m = await mgen(fa)
			const q = req.query
			const where = q.w ? JSON.parse(q.w) : {}
			const fields = q.f || '*'
			const list = await m.select(where, fields)
			const total = await m.count(where)
			return { total: total, list: list }
		})

		fa.post(`${base}upsert`, async (req, res) => {
			const m = await mgen(fa)
			const data = req.body
			const dupFields = []
			for (const k in data) { if (k != 'id') { dupFields.push(k) } }
			const insertId = await m.upsert(data, dupFields)
			return { insertId: insertId }
		})

		fa.get(`${base}delete/:id`, async (req, res) => {
			const m = await mgen(fa)
			if (await m.delete({ id: req.params.id })) {
				return { ok: true }
			}
			else {
				return { ok: false }
			}
		})

		fa.post(`${base}mdelete`, async (req, res) => {
			const m = await mgen(fa)
			const q = req.body
			for (const id of q.ids) {
				await m.delete({ id: id })
			}
			return { ok: true }
		})

	}

}
