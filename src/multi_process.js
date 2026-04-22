#!/usr/bin/env node

import { isMain } from './index.js'
import cluster from 'cluster'

const Self = class {
	constructor(forkNum = 10) {
		this.forkNum = forkNum
	}
	async parent(data) { return data }
	async child(param) {
		throw new Exception('Override child method')
	}
	async finish(result) {}
	async run(param) {
		if (cluster.isPrimary) {
			const { splitArray } = await import('./array.js')
			const workers = new Set()
			const forkNum = param.length < this.forkNum ? param.length : this.forkNum
			param = splitArray(param, forkNum)
			const result = []
			for (let i = 0; i < forkNum; i++) {
				const worker = cluster.fork()
				workers.add(worker.process.pid)
				worker.on('message', async data => {
					if (data === true) { worker.send(param[i]) }
					else { result.push(await this.parent(data)) }
				})
			}
			cluster.on('exit', (worker, code, signal) => {
				workers.delete(worker.process.pid)
				if (!workers.size) {
					this.finish(result)
				}
			})
		}
		else {
			process.send(true)
			process.on('message', async param => {
				process.send(await this.child(param) || null)
				process.exit()
			})
		}
	}
}

const isPrimary = cluster.isPrimary

export default Self
export { Self as MultiProcess, isPrimary as isMainProcess }

if (isMain(import.meta.url)) {
	const _ = (await import('lodash')).default
	const { cl } = await import('./index.js')
	class MP extends Self {
		async parent(data) {
			cl('[PARENT] RECV:', data)
			const ret = []
			for (const v of data) {
				ret.push(`p-${v}`)
			}
			return ret
		}
		async child(param) {
			const { setTimeout } = await import('timers/promises')
			cl('[CHILD] PARAM:', param)
			await setTimeout(_.random(500, 2000))
			const ret = []
			for (const p of param) {
				ret.push(`c-${p}`)
			}
			return ret
		}
		async finish(result) {
			cl(`[PARENT] FINISH`, result)
		}
	}
	const mp = new MP(3)
	mp.run(_.range(10))
}

