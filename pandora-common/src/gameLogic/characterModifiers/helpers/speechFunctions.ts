/**
 * @param sounds - A list of sound strings that shall be used to check the message
 * @param message - The message that shall be checked wether it contains one of the sounds
 * @param allowPartialMatch - Optional setting that also counts a part of one of the sounds inside the message as a successful check
 * @returns A boolean value on whether a sound was found in the message or not
 */
export function CheckMessageForSounds(sounds: string[], message: string, allowPartialMatch: boolean = true): boolean {
	for (let sound of sounds) {
		sound = sound.toLowerCase();
		let ok = true;
		let i = -1;
		let fullMatch = allowPartialMatch;
		for (const c of message) {
			if (/\p{L}/igu.test(c)) {
				const nxi = (i + 1) % sound.length;
				const nx = sound[nxi];
				if (c === nx) {
					i = nxi;
					if (i === sound.length - 1) {
						fullMatch = true;
					}
				} else if (i < 0 || c !== sound[i]) {
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

/**
 * Alters a message so that it sounds like a faltering voice, including random filler sounds.
 * @param message - The message that will be randomly changed
 * @param addFillerSounds - Optional setting that also adds filler sounds throughout the message at random
 * @returns The message after stuttering and random sounds have been added
 */
export function FalteringSpeech(message: string, addFillerSounds: boolean = true): string {
	const soundList: string[] = ['uuh... ', 'uhh... ', '...ah... ', 'uhm... ', 'mnn... ', '..nn... '];
	let firstWord: boolean = true;
	let alreadyStutteredWord: boolean = false;
	let seed: number = message.length;
	for (let messageIndex = 0; messageIndex < message.length; messageIndex++) {

		const character = message.charAt(messageIndex).toLowerCase();
		// from here on out, an out of context part of the message starts that will stay unchanged
		if (!alreadyStutteredWord && /\p{L}/igu.test(character)) {
			const stutterFactor: number = Math.floor(Math.sin(seed++) * 100000) % 10;
			if ((!alreadyStutteredWord && stutterFactor >= 6) || firstWord) {
				message = message.substring(0, messageIndex + 1) + '-' + message.substring(messageIndex, message.length);
				seed++;
				// One third chance to add a sound before a stuttered word
				if (addFillerSounds && Math.random() < 0.33 && !firstWord) {
					message = message.substring(0, messageIndex) + soundList[Math.floor(Math.random() * soundList.length)] + message.substring(messageIndex, message.length);
				}
				messageIndex += 2;
				if (firstWord) firstWord = false;
			}
			alreadyStutteredWord = true;
		}
		if (character === ' ') alreadyStutteredWord = false;
	}
	return message;
}
