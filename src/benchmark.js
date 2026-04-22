import { cl, isMain, sortObjectList } from './index.js'
import MultiProcess from './multi_process.js'

const Self = class {
	constructor(funcs, times = 100) {
		this.funcs = funcs
		this.times = times
		this.begin = null
		this.end = null
	}
	async do() {
		const that = this
		const mt = new class extends MultiProcess {
			async child(param) {
				const result = []
				for (const f of param) {
					const r = {
						name: f,
						time: Date.now()
					}
					for (let i = 0; i < that.times; i++) {
						await that.funcs[f]()
					}
					r.time = Date.now() - r.time
					result.push(r)
				}
				return result
			}
			async finish(result) {
				this.end = Date.now()
				const _result = []
				for (const r of result) { for (const rr of r) { _result.push(rr) } }
				result = sortObjectList(_result, 'time')
				const res = []
				let first = result[0]
				let or = null
				for (const r of result) {
					if (or) {
						r['diff(s)'] = r.time - or.time
						r['rate(%)'] = Math.round(r.time / first.time * 10000) / 100 || 0
					}
					else {
						r['diff(s)'] = 0
					}
					res.push(r)
					or = r
				}
				console.table(res)
				console.log(`TOTAL: ${this.end - this.begin} ms`)
			}
		}(2)
		mt.begin = Date.now()
		await mt.run(Object.keys(this.funcs))
	}
}

export default Self

if (isMain(import.meta.url)) {
	(async () => {
		const { setTimeout } = await import('timers/promises')
		const bench = new Self({
			hoge: async () => {
				await setTimeout(1)
			},
			fuga: async () => {
				await setTimeout(2)
			},
			foo: async () => {
				await setTimeout(4)
			},
		}, 100)
		await bench.do()
	})()
}
