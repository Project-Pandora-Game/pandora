import { DefineCharacterModifier } from '../helpers/modifierDefinition.ts';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const block_changing_pose_self = DefineCharacterModifier({
	typeId: 'block_changing_pose_self',
	visibleName: 'Block: Prevent changing pose on self',
	description: `
This modifier prevents the character from changing their own pose on their own, partially or completely.

Other characters can still change the pose of this character normally, if they have the according permission.
	`,
	strictnessCategory: 'normal',
	config: {
		limitTurning: {
			name: 'Prevent turning the body',
			type: 'toggle',
			default: true,
		},
		limitRotating: {
			name: 'Prevent rotating the body',
			type: 'toggle',
			default: true,
		},
		limitLegStates: {
			name: 'Prevent switching leg states',
			type: 'toggle',
			default: true,
		},
		limitAllPosing: {
			name: 'Prevent posing the complete body (including all above)',
			type: 'toggle',
			default: false,
		},
	},

	checkCharacterAction(config, action, player, _result) {
		if (action.type !== 'pose')
			return 'allow';

		if (action.target !== player.appearance.id)
			return 'allow';

		if (config.limitTurning && action.view && action.view !== player.appearance.characterState.actualPose.view)
			return 'block';

		if (config.limitRotating && action.bones && action.bones.character_rotation !== player.appearance.characterState.actualPose.bones.character_rotation)
			return 'block';

		if (config.limitLegStates && action.legs?.pose && action.legs?.pose !== player.appearance.characterState.actualPose.legs.pose)
			return 'block';

		if (config.limitAllPosing)
			return 'block';

		return 'allow';
	},
});
