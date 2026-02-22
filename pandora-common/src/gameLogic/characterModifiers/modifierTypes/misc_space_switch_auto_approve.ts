import { DefineCharacterModifier } from '../helpers/modifierDefinition.ts';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const misc_space_switch_auto_approve = DefineCharacterModifier({
	typeId: 'misc_space_switch_auto_approve',
	visibleName: 'Other: Auto-approve space switch requests',
	description: `
When another character that is leading this character requests moving to another space, this character modifier will cause this request
to be automatically approved by readying this character.

The "Auto approve from characters" setting can be used to limit this effect to only auto-approve space switch request from the specified characters.
If this list is empty, all requests are approved.

By default, the character with this modifier can still postpone the approval (by switching the readiness back to "waiting") or even reject the request altogether.
Enabling the "Enforce the approval" toggle will prevent the character from doing so.
	`,
	strictnessCategory: 'strict',
	config: {
		characters: {
			name: 'Auto approve from characters (empty = any character)',
			type: 'characterList',
			default: [],
		},
		enforce: {
			name: 'Enforce the approval',
			type: 'toggle',
			default: false,
		},
	},

	// Implemented externally on shard (in `Character::checkSpaceSwitchStatus`)
});
