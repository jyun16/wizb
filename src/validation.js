import { cl, isMain, trim, equal, compare, isEmpty } from './index.js'

const self = {
	required: v => !isEmpty(trim(v)),
	requiredChoice: v => {
		let flag = false
		if (v instanceof Array) { flag = v.length > 0 }
		else { flag = (v && !!v) }
		return flag
	},
	equal: (v1, v2) => equal(v1, v2),
	compare: (v1, ope, v2) => compare(v1, ope, v2),
	number: v => /^\d+$/.test(v),
	integer: v => /^\d+$/.test(v),
	min: (v, n) => (v || '').length >= n,
	max: (v, n) => (v || '').length <= n,
	email: v => /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(v),
	zipcode: v => /^\d{3}-?\d{4}$/.test(v),
	phone: v => /^\d{2,5}-\d{1,4}-\d{4,4}$/.test(v),
	zenkaku: v => !/^^(\w| |'|,|&|[ｦ-ﾟ])+$/.test(v),
	hiragana: v => /^[\u3041-\u3096]+$/.test(v),
	katakana: v => /^[\u30a1-\u30f6]+$/.test(v),
	hanKatakana: v => /^[ｦ-ﾟ]+$/.test(v),
	alphanum: v => /^[0-9a-zA-Z]+$/.test(v),
	alphabet: v => /^[a-zA-Z]+$/.test(v),
	// !"#$%&'()*+,-./:;<=>?@[¥]^_`{|}~
	password: (pw) => {
		if (!/[0-9]/.test(pw)) { return false }
		if (!/[a-z]/.test(pw)) { return false }
		if (!/[A-Z]/.test(pw)) { return false }
		if (!/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(pw)) { return false }
		return true
	},
	creditcard: v => {
		return /^(4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|^(?:2131|1800|35\d{3})\d{11}$)$/.test(v.replace(/-/g, ''))
	},
	confirm: v2 => { return v => v == v2 },
	url: v => /^[a-z]*:\/\/[-_.!~*\'()a-zA-Z0-9;\/?:\@&=+\$,%#]+$/.test(v),
	httpUrl: v => /^https?:\/\/[-_.!~*\'()a-zA-Z0-9;\/?:\@&=+\$,%#]+$/.test(v),
	datetime: dt => {
		dt = dt.split(' ')
		return self.date(dt[0]) && self.time(dt[1])
	},
	date: d => {
		if (isEmpty(d)) { return true }
		d = d.split(/[-/]/)
		if (d.length != 3) { return false }
		if (!/\d{4}/.test(d[0])) { return false }
		if (d[1] < 1 || 12 < d[1]) { return false }
		const lastDay = self._getLastDay(d[0], d[1])
		if (d[2] < 1 || lastDay < d[2]) { return false }
		return true
	},
	time: t => {
		if (isEmpty(t)) { return true }
		t = t.split(':')
		if (t.length != 3) { return false }
		if (t[0] < 0 || 23 < t[0]) { return false }
		if (t[1] < 0 || 60 < t[1]) { return false }
		if (t[2] < 0 || 60 < t[2]) { return false }
		return true
	},
	hourmin: t => {
		if (isEmpty(t)) { return true }
		t = t.split(':')
		if (t.length != 2) { return false }
		if (t[0] < 0 || 23 < t[0]) { return false }
		if (t[1] < 0 || 60 < t[1]) { return false }
		return true
	},
	_getLastDay: (year, month) => {
		const last = [ 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 ]
		let ret = last[month - 1]
		if (month == 2 && self._isLeapYear(year)) { ret++ }
		return ret
	},
	_isLeapYear: year => (year % 4 == 0 && year % 100 != 0) || year % 400 == 0,
}

export default self

if (isMain(import.meta.url)) {
	(async () => {
		const Test = (await import('./test.js')).default
		const t = new Test()
		t.true(self.required('hoge'))
		t.true(self.required(1))
		t.true(self.required(0))
		t.false(self.required(''))
		t.false(self.required(null))
		t.true(self.min('hoge', 4))
		t.false(self.min('hog', 4))
		t.true(self.zenkaku('あいうえお　カキクケコ'))
		t.false(self.zenkaku('ｶｷｸｹｺ'))
		t.true(self.hanKatakana('ｶｷｸｹｺ'))
		t.true(self.email('hoge@hoge.com'))
		t.false(self.email('.hoge@hoge.com'))
		t.false(self.email('ho..ge@hoge.com'))
		t.false(self.email('hoge.@hoge.com'))
		t.true(self.url('http://hoge.com/index?hoge=hoge%20fuga+hoge&fuga=FUGA#hoge'))
		t.true(self.time('00:00:00'))
		t.true(self.time('23:59:59'))
		t.false(self.time('24:00:00'))
		t.true(self.date('2022-01-02'))
		t.false(self.date('2003-02-29'))
		t.true(self.date('2004-02-29'))
		t.true(self.datetime('2004-02-29 00:11:22'))
		t.false(self.password('hoge'))
		t.false(self.password('Hoge'))
		t.false(self.password('Hoge9'))
		t.true(self.password('Hoge9!'))
	})()
}
