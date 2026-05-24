import untildify from 'untildify'
import { appendFileSync } from 'fs'
import { format } from 'util'
import { dd, uc, objMerge, now } from 'wiz'
import { p, isMain } from './index.js'

const LEVELS = [ 'debug', 'info', 'warn', 'error', 'fatal' ]

class Self {
	constructor(conf) {
		conf = objMerge({
			level: 'error',
			label: true,
			time: true,
		}, conf)
		let gen = false
		if (conf.file) { conf.file = untildify(conf.file) }
		for (const lv of LEVELS) {
			if (conf.level == lv) { gen = true }
			this[lv] = () => {}
			if (gen) {
				this[lv] = (...msg) => { this.output(uc(lv), ...msg) }
			}
		}
		this.conf = conf
	}
	output(lv, ...msg) {
		const c = this.conf
		const last = msg.at(-1)
		if (last instanceof Error) {
			if (c.trace) msg[msg.length - 1] = '\n' + last.stack.substring(last.stack.indexOf('\n') + 1)
			else msg.pop()
		}
		msg = (c.label ? `[${lv}] ` : '') + format(...msg)
		if (c.time) { msg += ' (' + now() + ')' }
		if (c.stdout) { console.log(msg) }
		if (c.stderr) { console.error(msg) }
		if (c.file) { appendFileSync(c.file, msg + '\n') }
	}
}

export default Self

if (isMain(import.meta.url)) {
	(async () => {
		const log = new Self({
			stdout: true,
			trace: true,
//			stderr: true,
//			file: '~/test.log',
		})
		log.debug('DEBUG')
		log.info('INFO')
		log.warn('WARN')
		log.error('ERROR', 'MSG', new Error('ANY ERROR'))
		log.fatal('FATAL')
	})()
}
