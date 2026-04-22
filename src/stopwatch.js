import { isMain } from './index.js'

const Self = class {
	constructor() {
		this._begin = null
		this._end = null
		this._lap = []
	}
	begin() {
		this._begin = Date.now()
	}
	lap(label = '') {
		this._lap.push([ label, Date.now() ])
	}
	end() {
		this._end = Date.now()
	}
	result() {
		if (!this._end) { this.end() }
		const laps = []
		let before = this._begin
		for (let i = 1; i <= this._lap.length; i++) {
			const [ label, lap ] = this._lap[i-1]
			laps.push({ label, 'time(ms)': lap - before })
			before = lap
		}
		return [ laps, this._end - this._begin ]
	}
	print() {
		const [ laps, total ] = this.result()
		console.table(laps)
		console.log(`TOTAL: ${total} ms`)
	}
}

export default Self

if (isMain(import.meta.url)) {
	(async () => {
		const { setTimeout } = await import('timers/promises')
		const sw = new Self()
		sw.begin()
		await setTimeout(100)
		sw.lap()
		await setTimeout(100)
		sw.lap('hoge')
		await setTimeout(100)
		sw.lap('fuga')
		sw.print()
	})()
}
