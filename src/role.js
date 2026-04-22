import { cl, isMain, isEmpty, isArray, isObject, isString, split, getMapVal, setMapVal, hasMapKey, deleteMapVal } from './index.js'

/*

const role = new Role([ 'user.edit.@all', 'user.index' ])

const role = new Role({
	user: {
		index: true,
		edit: {
			'@all": true,
		}
	}
})

上の2つは結果的に同じ設定
この設定により

role.has('user.index')
role.has('user.edit.upsert')
role.has('user.edit.delete')

等が true を返す

@all はすべてを許可する意味(本来 $ にしたいが shell で展開されてしまうため @ にしている)

追加を行う場合は以下

role.add('group.edit.@all')

削除は以下

role.remove('group.edit.@all')

すべてを許可しつつ任意のアクションだけ拒否したい場合

role.add('user.edit.~delete')

のように「~」を接頭詞としてアクションを追加する(! にしたいがこれも shell で問題が起こる)

*/
const Self = class {
	constructor(conf = {}) {
		if (isObject(conf)) {
			this.conf = conf
		}
		else if (isArray(conf)) {
			this.conf = {}
			for (const key of conf) {
				setMapVal(this.conf, key, true)
			}
		}
		else if (isString(conf)) {
			this.conf = JSON.parse(conf)
		}
	}
	add(key) {
		const akey = split(key, '.')
		const leaf = akey.pop()
		if (leaf == '@all') {
			const map = getMapVal(this.conf, akey.join('.'))
			for (const k in map) { delete map[k] }
			if (!map) {
				setMapVal(this.conf, akey.join('.') + '.@all', true)
			}
			else {
				map['@all'] = true
			}
			return
		}
		else if (!/^\~/.test(leaf) && hasMapKey(this.conf, akey.join('.') + '.@all')) {
			deleteMapVal(this.conf, akey.join('.') + '.@all')
		}
		setMapVal(this.conf, key, true)
	}
	remove(key) {
		deleteMapVal(this.conf, key)
		const akey = split(key, '.')
		akey.pop()
		const pkey = akey.join('.')
		if (isEmpty(getMapVal(this.conf, pkey))) {
			deleteMapVal(this.conf, pkey)
		}
	}
	_has(key) {
		let ret = false
		key = split(key, '.')
		let pk = ''
		for (const k of key) {
			pk += k
			if (hasMapKey(this.conf, `${pk}.@all`)) {
				ret = true
				break
			}
			pk += '.'
		}
		const leaf = key.pop()
		const map = getMapVal(this.conf, key)
		if (map) {
			if (map[`\~${leaf}`]) { return false }
			else if (map[leaf]) { return true }
		}
		return ret
	}
	has(key) {
		for (const k of split(key)) {
			if (this._has(k)) {
				return true
			}
		}
		return false
	}
}

export default Self

if (isMain(import.meta.url)) {
	(async() => {
		const Test = (await import('./test.js')).default
		const t = new Test()
		const cl = (...a) => d(a)
		const hasTest = () => {
			let role = new Self({ crud: { index: true } })
			t.true(role.has('crud.index'))
			t.false(role.has('hoge.fuga'))
			t.false(role.has('crud.delete'))
			role.add('crud.delete')
			t.true(role.has('crud.delete'))
			role.remove('crud.delete')
			t.false(role.has('crud.delete'))
			role = new Self([
				'crud.@all',
				'crud.!upsert',	
			])
			t.true(role.has('crud.hoge'))
			t.false(role.has('crud.upsert'))
			t.false(role.has('hoge.fuga'))

			role = new Self([
				'user.edit.delete',	
			])
			t.true(role.has('user.edit'))
			t.true(role.has('user.edit.delete'))
			t.false(role.has('user.insert'))

			role.remove('user.edit')
			t.false(role.has('user.edit'))

			role = new Self([
				'user.@all',	
			])
			t.true(role.has('user.edit'))
			t.true(role.has('user.edit.delete'))
		}
		const addTest = () => {
			let role = new Self()
			role.add('user.@all')
			t.eq(role.conf, { user: { '@all': true } })
			role.add('user.index')
			t.eq(role.conf, { user: { index: true } })
			role.add('user.edit.upsert')
			t.eq(role.conf, { user: { index: true, edit: { upsert: true } } })
			role.add('user.edit.@all')
			t.eq(role.conf, { user: { index: true, edit: { '@all': true } } })
			role.remove('user.index')
			t.eq(role.conf, { user: { edit: { '@all': true } } })
			role.remove('user.edit')
			t.eq(role.conf, {})

			role = new Self()
			role.add('user.edit.upsert')
			t.eq(role.conf, { user: { edit: { upsert: true } } })
			role.add('user.edit.@all')
			t.eq(role.conf, { user: { edit: { '@all': true } } })

			role.add('user.edit.~delete')
			t.true(role.has('user.edit.upsert'))

			t.false(role.has('user.edit.delete'))
			t.eq(role.conf, { user: { edit: { '@all': true, '~delete': true } } })

			role.add('user.edit.upsert')
			role.remove('user.edit.upsert')
			role.remove('user.edit.~delete')

			t.false(role.has('user.edit'))

			role.add('hoge')
			t.true(role.has('hoge'))
			t.true(role.has('hoge,bar'))
			t.false(role.has('foo,bar'))
		}
//    hasTest()
		addTest()
		process.exit()
	})()
}
