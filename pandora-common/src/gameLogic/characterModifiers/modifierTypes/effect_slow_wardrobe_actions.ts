import { isEqual } from 'lodash-es';
import { DefineCharacterModifier } from '../helpers/modifierDefinition.ts';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const effect_slow_wardrobe_actions = DefineCharacterModifier({
	typeId: 'effect_slow_wardrobe_actions',
	visibleName: 'Effect: Slowed wardrobe actions',
	description: `
This modifier changes the behavior of selected actions inside the wardrobe so that they take some time and can be interrupted.
The affected actions can be chosen in the configuration of this modifier.

This effect uses the same system as if the character was restrained and had to attempt a bound usage action that can be seen by other characters.
	`,
	strictnessCategory: 'normal',
	config: {
		delay: {
			name: 'Delay (in seconds)',
			type: 'number',
			default: 5,
			options: {
				min: 1,
				max: 3600,
			},
		},
		affectItemActions: {
			name: 'Affect item creation, deletion, equipping and storing',
			type: 'toggle',
			default: true,
		},
		affectReorder: {
			name: 'Affect reordering items',
			type: 'toggle',
			default: false,
		},
		affectModulesTyped: {
			name: 'Affect interacting with typed modules',
			type: 'toggle',
			default: true,
		},
		affectModulesLocks: {
			name: 'Affect interacting with locks',
			type: 'toggle',
			default: true,
		},
		affectRoomDeviceEnterLeave: {
			name: 'Affect entering/leaving room devices',
			type: 'toggle',
			default: true,
		},
		affectActionInterrupts: {
			name: 'Affect interrupting actions of others',
			type: 'toggle',
			default: false,
		},
	},

	checkCharacterAction(config, action, _player, _result) {
		if (action.type === 'randomize')
			return 'block';

		let shouldSlow: boolean;

		if (action.type === 'create' || action.type === 'delete') {
			shouldSlow = config.affectItemActions;
		} else if (action.type === 'transfer') {
			if (isEqual(action.target, action.source) && isEqual(action.item.container, action.container)) {
				shouldSlow = config.affectReorder;
			} else {
				shouldSlow = config.affectItemActions;
			}
		} else if (action.type === 'moveItem') {
			shouldSlow = (action.shift ?? 0) !== 0 && config.affectReorder;
		} else if (action.type === 'moduleAction') {
			if (action.action.moduleType === 'typed') {
				shouldSlow = config.affectModulesTyped;
			} else if (action.action.moduleType === 'lockSlot') {
				shouldSlow = config.affectModulesLocks;
			} else {
				shouldSlow = false;
			}
		} else if (action.type === 'roomDeviceEnter' || action.type === 'roomDeviceLeave') {
			shouldSlow = config.affectRoomDeviceEnterLeave;
		} else if (action.type === 'actionAttemptInterrupt') {
			shouldSlow = config.affectActionInterrupts;
		} else {
			shouldSlow = false;
		}

		return shouldSlow ? { result: 'slow', milliseconds: config.delay * 1_000 } : 'allow';
	},
});
