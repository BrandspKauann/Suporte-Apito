export function setTitle(title : undefined | string) {
	document.title = (typeof title === 'undefined' || title === '')
		? 'Apito de Mestre'
		: `${title} | Apito de Mestre`
}
