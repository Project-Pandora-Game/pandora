/**
 * @param sounds - A list of sound strings that shall be used to check the message
 * @param message - The message that shall be checked wether it contains one of the sounds
 * @param allowPartialMatch - Optional setting that also counts a part of one of the sounds inside the message as a successful check
 * @returns A boolean value on whether a sound was found in the message or not
 */
export function CheckMessageForSounds(sounds: string[], message: string, allowPartialMatch: boolean = true): boolean {
	for (let sound of sounds) {
		sound = sound.toLocaleLowerCase();
		let ok = true;
		let i = -1;
		let fullMatch = allowPartialMatch;
		for (const c of message) {
			if (/\p{L}/igu.test(c)) {
				const nx = sound[(i + 1) % sound.length];
				if (c === nx) {
					i = (i + 1) % sound.length;
					if (i === sound.length - 1) {
						fullMatch = true;
					}
				} else if (c !== sound[i]) {
					ok = false;
					break;
				}
			}
		}
		if (ok && fullMatch)
			return true;
	}
	return false;
}
