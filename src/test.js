import { cl, isMain, caller, p } from './index.js'

const Self = class {

	constructor(name = 'Test') {
		this.name = name
		this.count = 0
		this.ok = 0
		this.ng = 0
		if (Self.noPrint) return
		p('^B[%s]', name)
	}
	strip(s) {
		return s.replace(/^\s*$/gm, '').replace(/\s+/g, '').trim()
	}
	result() {
		if (this.count > 0) {
			if (this.ng > 0) {
				p('^RFAILED ^W%s/%s %s%%', this.ok, this.count, (this.ok/this.count * 100).toFixed(2))
			}
			else {
				p('^GSUCCEEDED ^W%s/%s', this.ok, this.count)
			}
		}
	}
  _chk(v1, v2, op, label, depth) {
    if (typeof v1 == 'object' && v1 !== null) {
      v1 = JSON.stringify(v1)
      v2 = JSON.stringify(v2)
    }
    this.print(v1, v2, label, op(v1, v2), depth)
  }
	eq(v1, v2, label = '', depth=3) { this._chk(v1, v2, (a, b) => a == b, label, depth) }
  ne(v1, v2, label = '', depth=3) { this._chk(v1, v2, (a, b) => a != b, label, depth) }
	include(v1, v2, label = '', depth=3) { this.print(v1, v2, label, this._chkInclude(v1, v2), depth) }
  exclude(v1, v2, label = '', depth=3) { this.print(v1, v2, label, !this._chkInclude(v1, v2), depth) }
  _chkInclude(v1, v2) {
    if (typeof v1 == 'string' || Array.isArray(v1)) {
      return v2 != null && v2.includes(v1)
    }
    if (typeof v1 == 'object' && v1 !== null) {
      return v2 != null && v1 in v2
    }
    return false
  }
	_html(s) {
    return s.replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ').trim()
  }
	html(v1, v2, label = '', depth=3) {
    this.print(v1, v2, label, this._html(v1) == this._html(v2), depth)
  }
	ceq(v1, v2, label = '', depth) {
		v1 = this.strip(v1)
		v2 = this.strip(v2)
		this.print(v1, v2, label, v1 == v2, depth)
	}
	re(v1, v2, label = '', depth) {
		this.print(v1, v2, label, v2.test(v1), depth)
	}
	true(v, label = '') { this.eq(v, true, label, 3) }
	false(v, label = '') { this.eq(v, false, label, 3) }
	pass(label = '') { this.true(true, label) }
	print(v1, v2, label, ok = false, depth = 2) {
		if (Self.noPrint) return
		const line = caller(depth).split(':').pop()
		this.count++
		if (label == '') {
			label = `test ${this.count}`
		}
		if (ok) {
			this.ok++
			p('^G[%s] ^W%s ... ^GOK ^C(%s)', this.count, label, line)
		}
		else {
			this.ng++
			p('^R[%s] ^W%s ... ^RNG ^C(%s)', this.count, label, line)
			p('^Y%s\n^W----\n^M%s', v1, v2)
		}
	}
}

Self.noPrint = false

export default Self

if (isMain(import.meta.url)) {
	const t = new Self()
	t.eq('a', 'a')
	t.eq('b', 'b')
	t.ne('a', 'b')
	t.eq([ 1, 2, 3 ], [ 1, 2, 3 ])
	t.eq({ hoge: 'HOGE', fuga: 'FUGA' }, { hoge: 'HOGE', fuga: 'FUGA' })
	t.eq('ccc', 'CCC')
	t.result()
}
