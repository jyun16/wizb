import Model from '../model.js'

class Self extends Model {
	withUser() {
		this.join({
			user: [ 'u', 'u.id', 'user_id' ]
		})
	}
}

export default Self
