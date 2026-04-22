import { dd, isMain, deepFreeze } from '../index.js'

const initLabels = conf => {
	const ret = {}
	for (const [ n, o ] of Object.entries(conf)) {
		ret[n] = o.label || ''
	}
	return ret
}

const initOptLabels = conf => {
	const ret = {}
	for (const [ n, o ] of Object.entries(conf)) {
		if ([ 'select', 'radio', 'checkbox' ].includes(o.type)) {
			ret[n] = o.opt
		}
	}
	return ret
}

class Self {
	constructor(conf, constant) {
		this.conf = conf
		this.const = deepFreeze(constant)
		this.labels = initLabels(conf)
		this.optionLabels = initOptLabels(conf)
	}
}

export default Self

if (isMain(import.meta.url)) {
}
