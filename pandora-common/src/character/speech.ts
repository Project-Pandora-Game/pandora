/**
 * Muffles text
 *
 * TODO: Make more sensible algorithm
 */
export function MuffleSpokenText(text: string, strength: number): string {
	return text.replace(/\p{L}/gu, (char) => (Math.random() * 10 < strength) ?
		((Math.random() < (10 - strength) / 20) ? 'h' : 'm') :
		char);
}
