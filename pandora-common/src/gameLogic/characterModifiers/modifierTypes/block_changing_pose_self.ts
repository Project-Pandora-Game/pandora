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
			name: 'Prevent turning around',
			type: 'toggle',
			default: true,
		},
		limitRotating: {
			name: 'Prevent rotating the body',
			type: 'toggle',
			default: true,
		},
		limitBoneMovement: {
			name: 'Prevent rotating the arms/legs',
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
		if (action.type === 'moveCharacter') {
			if (action.target.characterId !== player.appearance.id)
				return 'allow';

			if (config.limitTurning && action.pose?.view && action.pose.view !== player.appearance.characterState.requestedPose.view)
				return 'block';

			if (config.limitBoneMovement && action.pose?.bones && Object.entries(action.pose.bones).some(([bone, value]) => (player.appearance.characterState.requestedPose.bones[bone] ?? 0) !== value))
				return 'block';

			if (config.limitLegStates && action.pose?.legs?.pose && action.pose.legs.pose !== player.appearance.characterState.requestedPose.legs.pose)
				return 'block';

			if (config.limitAllPosing)
				return 'block';

			if (config.limitRotating && action.moveTo?.type === 'normal' && action.moveTo.rotation !== player.appearance.characterState.position.rotation)
				return 'block';
		}

		return 'allow';
	},
});
