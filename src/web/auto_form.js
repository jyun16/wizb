import { cl, isMain, isEmpty, isString, isArray, array2map, clone, equal, uc, toPascal, merge, hash, includes } from '../index.js'
import Validator from '../validator.js'
import { escapeHtml, query2where } from '../web/utils.js'

class Self {
	constructor(conf={}, param={}, opts={}) {
		this.conf = conf
		this.param = param
		this.lang = opts.lang || 'ja'
		this.error = {}
		this.validator = new Validator(this.lang)
		if (this.lang == 'ja') { this.t = new TagJA(this, conf) }
		else { this.t = new TagEN(this, conf) }
		if (opts.customErrorMessage) {
			for (const method in opts.customErrorMessage) {
				this.customErrorMessage(method, opts.customErrorMessage[method])
			}
		}
	}
	set(param) {
		this.param = param
		this.validator.reset()
		this.error = {}
	}
	reset() {
		this.set({})
	}
	tag(name, value=null, conf={}) {
		let c = this.conf[name]
		if (c == null) { c = {} }
		c = merge(c, conf)
		return this.t['tag' + toPascal(c.type)](name, value, c)
	}
	searchTag(name, value = null) {
		return this.tag(name, value, { attribute: { class: 'search' } })
	}
	val(...args) {
		return this.t.val(...args)
	}
	mode(mode) {
		for (const name in this.conf) {
			const conf = this.conf[name]
			if (conf.hide && includes(conf.hide, mode)) {
				delete this.conf[name]
			}
			else if (conf.show && !includes(conf.show, mode)) {
				delete this.conf[name]
			}
		}
	}
	toDB() {
		const ret = {}
		const d = this.param
		for (const name in d) {
			const conf = this.conf[name]
			if (!conf) { continue }
			if (conf.ignoreDB) { continue }
			if (this.t.isMulti(name)) {
				if (isString(d[name])) {
					d[name] = JSON.parse(d[name])
				}
				ret[name] = `,${d[name].join(',')},`
			}
			else {
				if (conf.hash) {
					ret[name] = hash(d[name], conf.hash)
				}
				else {
					ret[name] = d[name]
				}
			}
		}
		return ret
	}
	fromDB(d, label=false) {
		const ret = {}
		for (const name in d) {
			if (name == 'id') { ret.id = d.id; continue }
			if (!this.conf[name]) { continue }
			const conf = this.conf[name]
			const type = conf.type
			if (type == 'textarea') {
				ret[name] = d[name]
			}
			else {
				if (this.t.isMulti(name)) {
					ret[name] = d[name]?.substring(1, d[name].length - 1).split(',').map(x => x.toString())
				}
				else { ret[name] = d[name]?.toString() }
				if (label && (type == 'select' || type == 'radio' || type == 'checkbox')) {
					ret[name] = this.labeledValue(name, ret[name])
				}
			}
		}
		this.param = ret
		return ret
	}
	detailFromDB(d, label=true) {
		const ret = {}
		for (const name in d) {
			if (name == 'id') { ret.id = d.id; continue }
			if (!this.conf[name]) { continue }
			const conf = this.conf[name]
			const type = conf.type
			if (type == 'textarea') {
				ret[name] = d[name] != null ? escapeHtml(d[name], { br: true }).replace(/\r?\n/g, '<br>') : ''
			}
			else {
				if (this.t.isMulti(name)) {
					ret[name] = d[name].substring(1, d[name].length - 1).split(',').map(x => x.toString())
				}
				else { ret[name] = d[name]?.toString() }
				if (label && (type == 'select' || type == 'radio' || type == 'checkbox')) {
					ret[name] = this.labeledValue(name, ret[name])
				}
			}
		}
		this.param = ret
		return ret
	}
	listFromDB(list, label=true) {
		const ret = []
		for (const d of list) {
			ret.push(this.detailFromDB(d, label))
		}
		return ret
	}
	fields() {
		const ret = {}
		for (const f in this.conf) {
			if (this.conf[f].type == 'db') { continue }
			ret[f] = this.label(f)
		}
		return ret
	}
	label(name) {
		const conf = this.conf[name]
		return conf.label ? conf.label : uc(name)
	}
	optionLabel(name, value) {
		const o = this.conf[name].option
		for (let i = 0; i < o.length; i+=2) {
			if (equal(o[i], parseInt(value))) {
				return o[i + 1]
			}
		}
	}
	skip4html(type) {
		return type == 'db'
	}
	skipTag(type) {
		if (this.skip4html(type)) { return true }
		else if (type == 'readonly') { return true }
		return false
	}
	options4selectPure() {
		const ret = {}
		for (const name in this.conf) {
			const c = this.conf[name]
			if (c.type != 'select') { continue }
			const o = c.option
			const vl = []
			for (let i = 0; i < o.length; i+=2) {
				vl.push({ value: `${o[i]}`, label: o[i+1] })
			}
			let v = this.val(name)
			const isMulti = this.t.isMulti(name)
			if (isMulti){ 
				if (this.t.attribute(c)) {
					const _v = []
					for (const __v of v) {
						_v.push(`${__v}`)
					}
					v = _v
				}
				else { v = [ `${v}` ] }
			}
			ret[name] = { vl, v, isMulti }
		}
		return JSON.stringify(ret)
	}
	optionArrayJSON(name) { // for select-prue
		const ret = []
		const o = this.conf[name].option
		for (let i = 0; i < o.length; i+=2) {
			ret.push({ value: `${o[i]}`, label: o[i+1] })
		}
		return JSON.stringify(ret)
	}
	labeledValue(name, value) {
		if (this.t.isMulti(name)) {
			if (!isArray(value)) {
				if (/^\,/.test(value)) { value = value.substring(1, value.length - 1) }
				value = value.split(',')
			}
			return value.map(v => this.optionLabel(name, v))
		}
		else {
			return this.optionLabel(name, value)
		}
		return value
	}
	validation(target) {
		this.validator.check(this.conf, this.param, target)
		this.error = this.validator.hasError() ? this.validator.error : {}
	}
	async dbValidation(conn, target) {
		await this.validator._check(this.conf, this.param, target, async (name, method, args) => {
			if (method == 'unique') {
				const rows = await conn.query(`SELECT COUNT(*) AS count FROM ${args[0]} WHERE ${name}=?`, [ this.param[name] ])
				if (rows[0].count != 0) {
					this.validator.appendExtraError(method, name)
				}
			}
		})
		this.error = this.validator.hasError() ? this.validator.error : {}
	}
	hasError() {
		return !isEmpty(this.error)
	}
	setError(name, errMsg) {
		this.validator.appendError(name, errMsg)
	}
	customErrorMessage(method, msg) {
		this.validator.customMessage(method, msg)
	}
	customValidation(method, func, msg) {
		this.validator.custom(method, func, msg)
	}
	query2where(q, limit=10) { return query2where(q, limit) }
}

class Tag {
	constructor(af, conf) {
		this.af = af
		this.conf = conf
	}
	rawVal(name, value, conf) {
		this.val(name, value, conf, false)
	}
	val(name, value=null, conf={}, escape=true) {
		if (isEmpty(conf)) { conf = this.af.conf[name] }
		if (value == null && this.af.param[name] != null) {
			value = this.af.param[name]
		}
		if (this.isMulti(name)) {
			return this.vals(name, value, conf, escape)
		}
		else if (value == null) {
			value = conf.value != null ? conf.value : ''
		}
		return escape ? escapeHtml(value) : value
	}
	vals(name, value = null, conf = {}, escape = true) {
		if (value == null) {
			value = conf.value != null ? conf.value : ''
		}
		return escape ? escapeHtml(value) : value
	}
	attribute(conf, i = null) {
		if (!conf.attribute) { return '' }
		let attr = clone(conf.attribute)
		if (i != null && isArray(attr)) {
			attr = attr[i]
		}
		let ret = ''
		const singles = []
		for (const s of [ 'autofocus', 'multiple' ]) {
			if (attr[s]) {
				singles.push(s)
				delete attr[s]
			}
		}
		for (const k in attr) {
			const v = attr[k]
			ret += ` ${escapeHtml(k)}="${escapeHtml(v)}"`
		}
		for (const s of singles) {
			ret += ' ' + s
		}
		return ret
	}
	isMulti(name) {
		const conf = this.conf[name]
		const type = conf.type
		if (type == 'checkbox') { return true }
		if (type != 'select') { return false }
		if (conf.attribute && conf.attribute.multiple) { return true }
		return false
	}
	needValueToLabel(name) {
		const type = this.conf[name].type
		return type == 'select' || type == 'radio' || type == 'checkbox'
	}
	tagText(name, value=null, conf={}) {
		value = this.val(name, value, conf)
		return `<input type="text" name="${name}" value="${value}"${this.attribute(conf)}>`
	}
	tagPassword(name, value=None, conf={}) {
		value = this.val(name, value, conf)
		return `<input type="password" name="${name}" value="${value}"${this.attribute(conf)}>`
	}
	tagHidden(name, value=None, conf={}) {
		value = this.val(name, value, conf)
		return `<input type="hidden" name="${name}" value="${value}"${this.attribute(conf)}>`
	}
	tagTextarea(name, value=None, conf={}) {
		value = this.val(name, value, conf)
		return `<textarea name="${name}"${this.attribute(conf)}>${value}</textarea>`
	}
	tagSelect(name, value=None, conf={}) {
		value = this.val(name, value, conf)
		let fname = name
		let opts = ''
		if (this.isMulti(name)) { fname = name + '[]' }
		for (let i = 0; i < conf.option.length; i+=2) {
			const k = conf.option[i]
			const v = conf.option[i+1]
			let selected = ''
			if (isArray(value) && includes(value, k)) {
				selected = ' selected'
			}
			else if (k == value) {
				selected = ' selected'
			}
			opts += `<option value="${escapeHtml(k)}"${selected}>${escapeHtml(v)}</option>`
		}
		return `<select name="${fname}"${this.attribute(conf)}>${opts}</select>`
	}
	tagRadio(name, value=null, conf={}) {
		return this.tagRC(name, value, conf)
	}
	tagCheckbox(name, value=null, conf={}) {
		return this.tagRC(name, value, conf)
	}
	tagRC(name, value=null, conf={}) {
		const type = conf.type
		value = this.val(name, value, conf)
		let optCnt = 0
		let split = false
		let fname = name
		if ('split' in conf) { split = conf.split }
		if (type == 'checkbox') { fname = name + '[]' }
		const ret = []
		for (let i = 0; i < conf.option.length; i+=2) {
			const k = conf.option[i]
			const v = conf.option[i+1]
			let checked = ''
			if (isArray(value) && includes(value.toString(), k.toString())) {
				checked = ' checked'
			}
			else if (equal(k.toString(), value.toString())) {
				checked = ' checked'
			}
			const label = escapeHtml(v)
			const tag = `<input type="${type}" name="${fname}" value="${k}"${checked}${this.attribute(conf, optCnt)}>`
			if (split) {
				ret.push({
					label: label,
					tag: tag,
				})
			}
			else {
				const labelClass = 'label_class' in conf ? conf.label_class : ''
				ret.push(`<label>${tag}<span class="${labelClass}">${label}</span></label>`)
			}
			optCnt++
		}
		return ret
	}
}

class TagJA extends Tag {
}

class TagEN extends Tag {
}

export default Self

if (isMain(import.meta.url)) {
	(async () => {
		const Test = (await import('../test.js')).default
		const t = new Test()
		const af = new Self({
			text: {
				type: 'text',
				label: 'TEXT',
				attribute: {
					class: 'any',
					autofocus: true
				}
			},
			user_id: {
				type: 'db',
			},
			password: {
				type: 'password',
				hash: 'sha512',
				attribute: {
					size: 20,
					maxlength: 20,
				},
				validation: [
					[ 'min', 4 ],
				],
				hide: [ 'update', 'list' ],
			},
			password_confirm: {
				type: 'password',
				ignoreDB: true,
				validation: [
					[ 'equal', 'password' ],
				],
				hide: [ 'update', 'list' ],
			},
			textarea: {
				type: 'textarea',
				attribute: {
					cols: 80,
					rows: 6,
				},
			},
			select: {
				type: 'select',
				value: 0,
				option: [
					0, 'SELECT 0',
					1, 'SELECT 1',
					2, 'SELECT 2',
					3, 'SELECT 3',
				],
			},
			select_m: {
				label: 'MULTI SELECT BOX 1',
				type: 'select',
				value: [ 0, 1 ,3 ],
				option: [
					0, 'MULTI SELECT 0',
					1, 'MULTI SELECT 1',
					2, 'MULTI SELECT 2',
					3, 'MULTI SELECT 3',
				],
				attribute: {
					size: 5,
					multiple: 'multiple',
				}
			},
			radio: {
				label: 'RADIO BUTTON 1',
				type: 'radio',
				value: 0,
				option: [
					0, 'RADIO 0',
					1, 'RADIO 1',
					2, 'RADIO 2',
					3, 'RADIO 3',
				],
				attribute: [
					{},
					{	
						id: 'RADIO 3 ID',
					},
					{},
					{},
				]
			},
			checkbox: {
				label: 'CHECKBOX 1',
				type: 'checkbox',
				split: true,
				option: [
					0, 'CHECKBOX 0',
					1, 'CHECKBOX 1',
					2, 'CHECKBOX 2',
					3, 'CHECKBOX 3',
				],
				attribute: [
					{},
					{
						id: 'CHECKBOX 3 ID',
					},
					{},
					{},
				]
			},
		},
		{
			'text': '<b>VALUE</b>',
			'textarea': '<b>VALUE1</b>\n<b>VALUE2</b>',
		}, {
			customErrorMessage: {
				required: 'ひっす！',
			}
		})

		t.eq('<input type="text" name="text" value="&lt;b&gt;VALUE&lt;/b&gt;" class="any" autofocus>', af.tag('text'))
		t.eq('<input type="password" name="password" value="" size="20" maxlength="20">', af.tag('password'))
		t.eq(
			'<textarea name="textarea" cols="80" rows="6">&lt;b&gt;VALUE1&lt;/b&gt;\n&lt;b&gt;VALUE2&lt;/b&gt;</textarea>',
			af.tag('textarea')
		)
		t.eq('<select name="select"><option value="0" selected>SELECT 0</option><option value="1">SELECT 1</option><option value="2">SELECT 2</option><option value="3">SELECT 3</option></select>', af.tag('select'))
		t.eq('<select name="select_m[]" size="5" multiple><option value="0" selected>MULTI SELECT 0</option><option value="1" selected>MULTI SELECT 1</option><option value="2">MULTI SELECT 2</option><option value="3" selected>MULTI SELECT 3</option></select>', af.tag('select_m'))
		t.eq(['<label><input type="radio" name="radio" value="0" checked><span class="">RADIO 0</span></label>', '<label><input type="radio" name="radio" value="1" id="RADIO 3 ID"><span class="">RADIO 1</span></label>', '<label><input type="radio" name="radio" value="2"><span class="">RADIO 2</span></label>', '<label><input type="radio" name="radio" value="3"><span class="">RADIO 3</span></label>'], af.tag('radio'))
		t.eq([
			{
				'label': 'CHECKBOX 0',
				'tag': '<input type="checkbox" name="checkbox[]" value="0">'
			},
			{
				'label': 'CHECKBOX 1',
				'tag': '<input type="checkbox" name="checkbox[]" value="1" id="CHECKBOX 3 ID">'
			},
			{
				'label': 'CHECKBOX 2',
				'tag': '<input type="checkbox" name="checkbox[]" value="2">'
			},
			{
				'label': 'CHECKBOX 3',
				'tag': '<input type="checkbox" name="checkbox[]" value="3">'
			}
		], af.tag('checkbox'))
		t.eq(af.optionLabel('checkbox', 2), 'CHECKBOX 2')

		t.eq({
			text: 'TEXT',
			password: 'PASSWORD',
			password_confirm: 'PASSWORD_CONFIRM',
			textarea: 'TEXTAREA',
			select: 'SELECT',
			select_m: 'MULTI SELECT BOX 1',
			radio: 'RADIO BUTTON 1',
			checkbox: 'CHECKBOX 1'
		}, af.fields())

		af.param['user_id'] = 1
		af.param['checkbox'] = [ 1, 2, 3 ]
		af.param['password'] = 'pass'
		af.param['password_confirm'] = 'pass'

//    cl(af.toDB())

		af.param = { password: 'hoge' }

		af.validation([ 'password' ])
		const data = {
			select: 1,
			select_m: ',1,3,',
			radio: 2,
			checkbox: ',0,2,',
		}
		t.eq({}, af.error)

//    cl(af.listFromDB([data]))
//    cl(af.detailFromDB(data))

		af.reset()
		af.customErrorMessage('min', 'みじかい！')
		af.validation()
		t.eq({ password: 'みじかい！' }, af.error)
	})()
}
