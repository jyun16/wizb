// この mixin を使用している場合 delete を使うと並びがおかしくなる
// 必ず remove を使うこと
export default {
	uintMax() {
		return 4294967295
	},
  async insert(data) {
		data.priority = (await this.one({}, ':MAX(priority) AS priority'))['priority'] ?? 0
		data.priority++
		return this.super_insert(data)
  },
  async select(where = {}, fields = '*', filter = []) {
		where['-order'] = 'priority'
		return this.super_select(where, fields, filter)
	},
	async maxPriority() {
		return (await this.one({ priority: [ '!=', this.uintMax() ] }, ':MAX(priority) AS priority'))['priority']
	},
	async orderUp(id) {
		const curPriority = await this.value('priority', { id })
		if (curPriority == 1) { return }
		const prevPriority = curPriority - 1
		await this.update({ priority: curPriority }, { priority: prevPriority })
		await this.update({ priority: prevPriority }, { id })
	},
	async orderDown(id) {
		const curPriority = await this.value('priority', { id })
		const maxPriority = await this.maxPriority()
		if (curPriority == maxPriority) { return }
		const nextPriority = curPriority + 1
		await this.update({ priority: curPriority }, { priority: nextPriority })
		await this.update({ priority: nextPriority }, { id })
	},
	async flip(from, to, after = true) {
		if (from == to) { return }
		const fromPriority = await this.value('priority', { id: from })
		const toPriority = await this.value('priority', { id: to })
		if (!fromPriority || !toPriority) { return }
		if (after) {
			if (from > to) {
				await this.update({ priority: [ 'raw', 'priority + 1' ] }, { '-and': [ 'priority', [ '>', toPriority ], 'priority', [ '<', fromPriority ] ] })
				await this.update({ priority: toPriority + 1 }, { id: from })
			}
			else {
				await this.update({ priority: [ 'raw', 'priority - 1' ] }, { '-and': [ 'priority', [ '<=', toPriority ], 'priority', [ '>', fromPriority ] ] })
				await this.update({ priority: toPriority }, { id: from })
			}
		}
		else {
			if (from > to) {
				await this.update({ priority: [ 'raw', 'priority + 1' ] }, { '-and': [ 'priority', [ '>=', toPriority ], 'priority', [ '<', fromPriority ] ] })
				await this.update({ priority: toPriority }, { id: from })
			}
			else {
				await this.update({ priority: [ 'raw', 'priority - 1' ] }, { '-and': [ 'priority', [ '<', toPriority ], 'priority', [ '>', fromPriority ] ] })
				await this.update({ priority: toPriority - 1 }, { id: from })
			}
		}
	},
	async remove(id) {
		const curPriority = await this.value('priority', { id })
		await this.update({ priority: [ 'raw', 'priority - 1' ] }, { 'id': [ '>', curPriority ] })
		await this.update({ priority: this.uintMax() }, { id })
		await this.delete({ id })
	},
	async restore(id) {
		const maxPriority = await this.maxPriority()
		await this.update({ priority: maxPriority + 1 }, { id })
		await this.undelete({ id })
	},
	async pureSelectOptions(where) {
		const ret = []
		for (const row of await this.select(where, 'id, name')) {
			ret.push({
				value: row.id.toString(),
				label: row.name,
			})
		}
		return ret
	},
}
