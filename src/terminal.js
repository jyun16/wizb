import termkit from 'terminal-kit'
import inquirer from 'inquirer'
import { cl, isMain, isString, merge } from './index.js'
import validation from './validation.js'
import Validator from './validator.js'

export function table(data, opts = {}) {
	opts = merge({
    hasBorder: true ,
    contentHasMarkup: true ,
    borderChars: 'lightRounded' ,
    borderAttr: { color: 'blue' } ,
    textAttr: { bgColor: 'default' } ,
    width: 60 ,
    fit: true
	}, opts)
	const term = termkit.terminal
  term.table(data, opts)
}

export async function readline(prompt, $default, valid) {
	let validate = valid
	if (isString(valid)) {
		validate = v => {
			if (v == '') { return true }
			return validation[valid](v) || Validator.base_message.ja[valid]
		}
	}
	const opts = {
		type: 'input',
		name: 'val',
		message: prompt + ':',
	}
	if (validate) { opts.validate = validate }
	if ($default != null) { opts.default = $default }
	return (await inquirer.prompt([opts])).val
}

export async function readlineRequired(prompt, $default, valid) {
	let validate = valid
	if (!valid) {
		validate = v => v != ''
	}
	else if (isString(valid)) {
		validate = v => validation[valid](v) || Validator.base_message.ja[valid]
	}
	const opts = {
		type: 'input',
		name: 'val',
		message: prompt + ':',
	}
	if (validate) { opts.validate = validate }
	if ($default != null) { opts.default = $default }
	return (await inquirer.prompt([opts])).val
}

export async function readlineYN(prompt) {
	const val = (await inquirer.prompt([{
		type: 'input',
		name: 'val',
		message: prompt + ' [y/N]:',
	}])).val
	return val == 'y' || val == 'yes'
}

if (isMain(import.meta.url)) {
	(async () => {
		const tableTest = () => {
			table([
				[ 'HOGE', 'FUGA', 'FOO'],
				[ 'hoge1', 'fuga1', 'foo1' ],
				[ '^Rhoge2', '^Gfuga2', '^Bfoo2' ],
				[ '^Mhoge3', '^Cfuga3', '^Yfoo3' ],
			], {
//        firstCellTextAttr: { bgColor: 'blue' } ,
//        firstRowTextAttr: { bgColor: 'yellow' } ,
//        firstColumnTextAttr: { bgColor: 'red' } ,
				width: 80
			})
		}
		tableTest()
//    cl(await readline('Input'))
//    cl(await readline('Input', null, 'number'))
//    cl(await readline('Input', 'HOGE', 'number'))
//    cl(await readlineRequired('Input'))
//    cl(await readlineRequired('Input', null, 'number'))
//    cl(await readlineYN('OK?'))
		process.exit()
	})()
}
