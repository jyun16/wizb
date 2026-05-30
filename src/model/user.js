import argon2 from 'argon2'
import { dd, isEmpty, clone, objSet } from 'wiz'
import { isMain } from '../index.js'
import Model from '../model.js'

class Self extends Model {
	constructor(db, table) {
		super(db, table)
		this.emailField = true
		this.logicalDelete = true
	}
	ignoreFields() {
		return [ 'password' ].concat(super.ignoreFields())
	}
	async insert(d) {
		d = clone(d)
		if (d.password) { d.password = await this.hashPassword(d.password) }
		d.stash = JSON.stringify(d.stash || {})
		return super.insert(d)
	}
	async update(d, w) {
		if (d.password) { d.password = await this.hashPassword(d.password) }
		return super.update(d, w)
	}
	hashPassword(pw) {
		return argon2.hash(pw, {
			memoryCost: 65536,
			timeCost: 3,
			parallelism: 1,
		})
	}
	verifyPassword(hash, password) {
		return argon2.verify(hash, password)
	}
	async loginData(w) {
		const d = await this.one(w)
		if (!d) return null
		for (const field of this.ignoreFields()) delete d[field]
		return d
	}
	async login(userid, password) {
		const pw = await super.value('password', { userid })
		if (!pw) return null
		if (pw && (await this.verifyPassword(pw, password))) {
			const ret = await this.onePrune({ userid })
			if (ret.stash) ret.stash = JSON.parse(ret.stash)
			return ret
		}
		return null
	}
}

export default Self

if (isMain(import.meta.url)) {

}
