import untildify from 'untildify'
import { appendFileSync } from 'fs'
import { format } from 'util'
import { p, isMain, uc, merge, now } from './index.js'

const LEVELS = [ 'debug', 'info', 'warn', 'error', 'fatal' ]

class Self {
	constructor(conf) {
		conf = merge({
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
		msg = (c.label ? `[${lv}] ` : '') + format(...msg)
		if (c.time) { msg += ' (' + now() + ')' }
		if (c.stdout) { console.log(msg) }
		if (c.stderr) { console.error(msg) }
		if (c.file) {
			appendFileSync(c.file, msg + "\n")
		}
	}
}

export default Self

if (isMain(import.meta.url)) {
	(async () => {
		const Test = (await import('./test.js')).default
		const t = new Test()
		const log = new Self({
			stdout: true,
//      stderr: true,
//      file: '~/test.log',
		})
		log.debug('DEBUG')
		log.info('INFO')
		log.warn('WARN')
		log.error('ERROR', 'MSG')
		log.fatal('FATAL')
	})()
}
