import { cl } from '../index.js'
import Model from '../model.js'

class Self extends Model {
	withUser() {
		this.join = [
			`INNER JOIN user u ON u.id = ${this.table}.user_id`,
		]
		this.appendField = 'u.userid, u.name AS user_name'
	}
}

export default Self
