import { d } from 'wiz'

import Model from '../model.js'

export default class {
	uintMax() {
		return 4294967295
	}
	async insert(data) {
		data.priority = (await this.one({}, ':MAX(priority) AS priority'))['priority'] ?? 0
		data.priority++
		return this.as(Model, 'insert', data)
	}
	async select(where = {}, fields = '*', filter = []) {
		where['-order'] = 'priority'
		return this.as(Model, 'select', where, fields, filter)
	}
	async maxPriority() {
		return (await this.one({ priority: [ '!=', this.uintMax() ] }, ':MAX(priority) AS priority'))['priority']
	}
	async orderUp(id) {
		const curPriority = await this.value('priority', { id })
		if (curPriority == 1) { return }
		const prevPriority = curPriority - 1
		await this.update({ priority: curPriority }, { priority: prevPriority })
		await this.update({ priority: prevPriority }, { id })
	}
	async orderDown(id) {
		const curPriority = await this.value('priority', { id })
		const maxPriority = await this.maxPriority()
		if (curPriority == maxPriority) { return }
		const nextPriority = curPriority + 1
		await this.update({ priority: curPriority }, { priority: nextPriority })
		await this.update({ priority: nextPriority }, { id })
	}
	async flip(from, to, after = true) {
		if (from == to) return
		const f = await this.value('priority', { id: from })
		const t = await this.value('priority', { id: to })
		if (!f || !t || f == t) return
		const op = f > t ? 'priority + 1' : 'priority - 1'
		const c1 = f > t ? (after ? '>' : '>=') : (after ? '<=' : '<')
		await this.update({ priority: ['raw', op] }, { '-and': ['priority', [c1, t], 'priority', [f > t ? '<' : '>', f]] })
		await this.update({ priority: f > t ? (after ? t + 1 : t) : (after ? t : t - 1) }, { id: from })
	}
	async remove(id) {
		const curPriority = await this.value('priority', { id })
		await this.update({ priority: [ 'raw', 'priority - 1' ] }, { 'id': [ '>', curPriority ] })
		await this.update({ priority: this.uintMax() }, { id })
		await this.delete({ id })
	}
	async restore(id) {
		const maxPriority = await this.maxPriority()
		await this.update({ priority: maxPriority + 1 }, { id })
		await this.undelete({ id })
	}
}
