import { COMMANDS } from '../../../../src/ui/components/chat/commands.ts';

describe('Commands', () => {
	it('Should define commands with unique keys to avoid conflicts', () => {
		const seenKeys = new Map<string, string>();

		for (const command of COMMANDS) {
			for (const key of command.key) {
				if (seenKeys.has(key)) {
					throw new Error(`Key '${key}' from command '${command.key[0]}' conflicts with key defined by command '${seenKeys.get(key)}'`);
				}
				seenKeys.set(key, command.key[0]);
			}
		}
	});
});
