#!/usr/bin/env node

import { cl } from './index.js'
import { isMainThread } from 'worker_threads'

const Self = class {
	constructor(import_meta_url, threadNum = 10) {
		this.threadNum = threadNum
		this.import_meta_url = import_meta_url
	}
	async parent(data) { return data }
	async child(param) {
		throw new Exception('Override child method')
	}
	async finish(result) { }
	async run(param = []) {
		if (isMainThread) {
			const { fileURLToPath } = await import('url')
			const { Worker } = await import('worker_threads')
			const { splitArray } = await import('./index.js')
			const __filename = fileURLToPath(this.import_meta_url)
			const workers = new Set()
			const threadNum = param.length < this.threadNum ? param.length : this.threadNum
			param = splitArray(param, threadNum)
			const result = []
			for (let i = 0; i < threadNum; i++) {
				const worker = new Worker(__filename, { workerData: param[i] })
				worker.on('message', async data => {
					result.push(await this.parent(data))
				})
				worker.on('exit', async () => {
					workers.delete(worker)
					if (!workers.size) {
						await this.finish(result)
					}
				})
				workers.add(worker)
			}
			return result
		}
		else {
			const { parentPort, workerData } = await import('worker_threads')
			parentPort.postMessage(await this.child(workerData || null))
		}
	}
}

export default Self
export { Self as MultiThread, isMainThread }

// Worker 使うと isMain がまともに動けない
import { isMain } from './index.js'
if (isMain(import.meta.url)) {
  const _ = (await import('lodash')).default
  const { cl } = await import('./index.js')
  class MT extends Self {
    async parent(data) {
      cl('[PARENT] RECV:', data)
      const ret = []
      for (const v of data) {
        ret.push(`p-${v}`)
      }
      return ret
    }
    async child(param) {
      let { setTimeout } = await import('timers/promises')
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
  const mp = new MT(import.meta.url, 3)
  mp.run(_.range(10))
}
