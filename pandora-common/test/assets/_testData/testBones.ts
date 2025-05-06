import { Immutable } from 'immer';
import type { BoneDefinitionCompressed } from '../../../src/assets/graphics/compressed.ts';

const ASSET_TEST_BONE_DEFINITIONS_IMPL = {
	arm_l: {
		pos: [578, 432],
		mirror: 'arm_r',
		type: 'pose',
	},
	elbow_l: {
		pos: [728, 434],
		mirror: 'elbow_r',
		parent: 'arm_l',
		type: 'pose',
	},
	leg_l: {
		pos: [521, 735],
		uiPositionOffset: [24, -28],
		mirror: 'leg_r',
		baseRotation: 90,
		type: 'pose',
	},
	breasts: { type: 'body' },
	tiptoeing: { type: 'pose' },
	character_rotation: {
		baseRotation: -90,
		type: 'pose',
	},
} as const satisfies Immutable<Record<string, BoneDefinitionCompressed>>;

type Key = keyof typeof ASSET_TEST_BONE_DEFINITIONS_IMPL;

type Mirrored<Bone extends Key> = Bone extends `${infer M}_l` ? `${M}_r` : never;

export const ASSET_TEST_BONE_DEFINITIONS: Immutable<Record<Key, BoneDefinitionCompressed>> = ASSET_TEST_BONE_DEFINITIONS_IMPL;

export type AssetTestBones = Key | ((typeof ASSET_TEST_BONE_DEFINITIONS_IMPL)[Key] & { mirror: Mirrored<Key>; })['mirror'];
