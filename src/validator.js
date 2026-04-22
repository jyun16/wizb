import util from 'util'
import { cl, isMain, isEmpty, isArray, array2map, clone, setMapVal, sprintf } from './index.js'
import validation from './validation.js'

class Self {
	constructor(lang='ja') {
		this.lang = lang
		this.error = {}
		this.hasError = _ => !isEmpty(this.error)
		this.message = clone(Self.base_message[this.lang])
		this.reset = _ => this.error = {}
		this.appendError = (method, errMsg) => {
			this.error[method] = errMsg
		}
		this.appendExtraError = (method, name) => {
			this.appendError(name, this.message.extra[method])
		}
		this.init()
	}
	init() {
		this.v = {}
		for (const method in validation) {
			this.v[method] = (...a) => {
				this.call(method, ...a)
			}
		}
	}
	call(method, ...a) {
		const name = a.shift()
		if (!validation[method](...a)) {
			const len = validation[method].length
			let msg = (len < a.length) ? a[a.length - 1] : this.message[method]
			a.shift()
			msg = sprintf(msg, ...a)
			this.error[name] = msg
		}
	}
	customMessage(method, msg) {
		if (method.includes('.')) {
			setMapVal(this.message, method, msg)
		}
		else {
			this.message[method] = msg
		}
	}
	custom(method, func, msg) {
		this.message[method] = msg
		validation[method] = func
		this.v[method] = (...a) => {
			this.call(method, ...a)
		}
	}
	async _check(FORM, p, target, dbValid) {
		if (target) { target = isArray(target) ? array2map(target) : { [target]: true } }
		for (const [ n, o ] of Object.entries(FORM)) {
			if (target && !target[n]) { continue }
			let valid = dbValid ? o.dbValidation : o.validation
			if (!valid) { continue }
			for (const va of valid) {
				if (isArray(va)) {
					const vva = clone(va)
					const vn = vva.shift()
					if (dbValid) {
						await dbValid(n, vn, vva)
					}
					else {
						if (vn == 'equal') { vva[0] = p[vva[0]] }
						this.v[vn](n, p[n], ...vva)
					}
				}
				else {
					this.v[va](n, p[n])
				}
			}
		}
	}
	check(FORM, p, target) {
		this._check(FORM, p, target)
	}
}
Self.base_message = {
	ja: {
		required: '必ず入力してください',
		requiredChoice: '必ず選択してください',
		equal: '値が一致しません',
		compare: '範囲内で正しく入力してください',
		number: '数値で入力してください',
		min: '最低 %s 文字入力してください',
		max: '%s 文字以内で入力してください',
		email: '正しいメールアドレスを入力してください',
		zipcode: '正しい郵便番号を入力してください',
		phone: '正しい電話番号を入力してください',
		zenkaku: '全角文字で入力してください',
		hiragana: 'ひらがなで入力してください',
		katakana: '全角カタカナで入力してください',
		hanKatakana: '半角カタカナで入力してください',
		alphanum: '半角英数字で入力してください',
		alphabet: '半角英字で入力してください',
		creditcard: '正しいクレジットカード番号を入力してください',
		url: '正しい URL を入力してください',
		httpUrl: '正しい URL を入力してください',
		password: 'パスワードには大小英字と数字と記号を必ず含んでください',
		datetime: '正しい日時を入力してください',
		date: '正しい日付を入力してください',
		time: '正しい時刻を入力してください',
		hourmin: '正しい時刻を入力してください',
		extra: {
			unique: '既に存在します',
		},
	},
}

export default Self

const FORM = {
	text: {
		type: 'text',
		validation: [
			'required',
		],
	},
	password: {
		type: 'password',
		validation: [
			'required',
			[ 'min', 4 ],
		],
	},
	password_confirm: {
		type: 'password',
		validation: [
			[ 'equal', 'password' ],
		],
	},
}

if (isMain(import.meta.url)) {
	(async () => {
		const Test = (await import('./test.js')).default
		const t = new Test()
		const v = new Self()
		v.v.required('req', '')
		v.call('equal', 'eq1', 'a', 'b')
		v.v.equal('eq2', 'a', 'b', 'custom error message') // validaation の引数オーバーした分はエラーメッセージになる
		v.v.min('min', 'hoge', 4) 
		v.v.max('max', 'hoge', 2)
		const p = { text: 'HOGE', password: 'x' }
		v.check(FORM, p)
		v.appendExtraError('unique', 'uniq')
		t.true(v.hasError())
		t.eq(v.error, {
			req: '必ず入力してください',
			eq1: '値が一致しません',
			eq2: 'custom error message',
			max: '2 文字以内で入力してください',
			password: '最低 4 文字入力してください',
			password_confirm: '値が一致しません',
			uniq: '既に存在します',
		})
		v.reset()
		v.customMessage('required', '空ですが？')
		v.v.required('custom_msg', '')
		t.eq(v.error, {
			custom_msg: '空ですが？'
		})
		v.reset()
		v.custom('custom_checker', (v1, v2) => {
			return v1 == v2
		}, 'カスタムチェックのエラー')
		v.v.custom_checker('custom_checker', 'xxx', 'yyy')
		t.eq(v.error, {
			custom_checker: 'カスタムチェックのエラー'
		})
		v.customMessage('extra.unique', 'かぶった！')
		t.eq(v.message.extra.unique, 'かぶった！')
	})()
}
