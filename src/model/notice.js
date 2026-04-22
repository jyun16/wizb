import { cl } from '../index.js'
import Model from '../model.js'

class Self extends Model {
	async notify(userId, title, type='', data={}) {
		data = JSON.stringify(data)
		const ret = await this.insert({
			user_id: userId,
			type,
			title,
			data,
		})
		return ret
	}
}

export default Self
