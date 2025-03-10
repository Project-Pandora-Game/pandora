import { DefineCharacterModifier } from '../helpers/modifierDefinition.ts';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const effect_delayed_bound_usage = DefineCharacterModifier({
	typeId: 'effect_delayed_bound_usage',
	visibleName: 'Effect: Delayed bound usage attempts',
	description: `
This modifier adds additional time to the initial delay before the character can choose to finish a bound usage attempt to do an action with blocked hands.

This means that others have more time to interrupt the character as the character can only click the button to complete the attempted action earliest after the set time.
Only affects slowdown caused by bound hands, not slowdown caused by other modifiers.
	`,
	strictnessCategory: 'normal',
	config: {
		delayTime: {
			type: 'number',
			name: 'Additional delay (in seconds)',
			default: 5,
			options: {
				min: 0,
				max: 3600,
			},
		},
	},

	checkCharacterAction(config, _action, _player, result) {
		if (result.actionSlowdownReasons.has('blockedHands')) {
			return { result: 'slow', milliseconds: config.delayTime * 1_000 };
		}

		return 'allow';
	},
});
