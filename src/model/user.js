import { cl, isEmpty, array2map, clone, setMapVal, hash, json, merge } from '../index.js'
import Model from '../model.js'

class Self extends Model {
	constructor(conn, table) {
		super(conn, table)
		this.emailField = true
		this.logicalDelete = true
	}
	ignoreFields() {
		return [ 'password' ].concat(super.ignoreFields())
	}
	async insert(d) {
		d = clone(d)
		const chk = await this.uniqCheck(d)
		if (chk) { return chk }
		if (d.password) { d.password = this.genPassword(d.password) }
		d.stash = json(d.stash || {})
		return super.insert(d)
	}
	async update(d, w) {
		if (d.password) { d.password = this.genPassword(d.password) }
		return super.update(d, w)
	}
	async uniqCheck(d) {
		const ret = {}
		if (await this.exists({ userid: d.userid })) {
			setMapVal(ret, 'errors.userid', 'ユーザーIDが既に存在します')
		}
		if (this.emailField && await this.exists({ email: d.email })) {
			setMapVal(ret, 'errors.email', 'メールアドレスが既に存在します')
		}
		return isEmpty(ret) ? null : ret
	}
	genPassword(pw) {
		return hash(pw)
	}
	chkPassword(hashPW, pw) {
		return hash(pw) == hashPW
	}
	async loginData(w) {
		const d = await this.one(w)
		if (d) {
			for (const field of this.ignoreFields()) {
				delete d[field]
			}
		}
		return d
	}
	async login(userid, pw, _hash = false) {
		const password = await super.value('password', { userid })
		if (password && (this.chkPassword(password, pw) || (_hash && password == pw))) {
			return this.onePrune({ userid })
		}
		else {
			return null
		}
	}
}

export default Self
