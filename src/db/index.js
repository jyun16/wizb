import util from 'util'
import mysql from 'mysql2'
import { cl, dd, isMain, merge } from '../index.js'

class DB {
	constructor(conf) {
		conf = merge({
			host: 'localhost',
			port: 3306,
			user: 'root',
			password: '',
			database: '',
		}, conf)
		this.conf = conf
	}
	async init() {
    const conn = mysql.createConnection(this.conf)
    conn.query = util.promisify(conn.query)
    conn.execute = util.promisify(conn.execute)
		await conn.query('SELECT 1')
		this.conn = conn
	}
	begin(...args) {
		return this.conn.beginTransaction(...args)
	}
	commit(...args) {
		return this.conn.commit(...args)
	}
	rollback(...args) {
		return this.conn.rollback(...args)
	}
	end(...args) {
		return this.conn.end(...args)
	}
	close(...args) {
		this.conn.close(...args)
	}
	query(sql, value=[]) {
		return this.conn.query(sql, value)
	}
	execute(sql, value=[]) {
		return this.conn.execute(sql, value)
	}
	executeAsArray(sql, values=[]) {
		return this.conn.execute({ sql, values, rowsAsArray: true })
	}
}

const self = async (conf) => {
	const ret = new DB(conf)
	await ret.init()
	return ret	
}

export default self

if (isMain(import.meta.url)) {
	(async() => {
		try {
			const db = await self({
				user: 'jn',
				database: 'cha',
			})
//      await db.query(`INSERT INTO user (userid, password) VALUES ('hoge', 'hogehoge')`)
//      await db.query(`INSERT INTO user (userid, password) VALUES ('hoge', 'hogehoge')`)
//      const rows = await db.executeAsArray(
//        'SELECT * FROM room_log WHERE `room_id`=? AND (`from_id`=? OR `to_id`=?) LIMIT 10',
//        [ 1, 1, 1 ]
//      )
//      const rows = await db.executeAsArray('SELECT * FROM room_log', [])
//      const rows = await db.conn.execute({ sql: 'SELECT * FROM room_log', value: [], rowsAsArray: true })
			for (const row of rows) {
				cl(row)
			}
			db.close()
		}
		catch (e) {
			console.log('>>>>>', e)
		}
		process.exit()
	})()
}

// pool は query で field 返してきたり色々ウザいので使うのヤメ！
// 接続確認のため Select 1 を一発投げてる！！
