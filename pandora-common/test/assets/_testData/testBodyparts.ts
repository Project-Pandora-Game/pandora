import type { Immutable } from 'immer';
import type { AssetBodyPart } from '../../../src/assets/definitions.ts';

const ASSET_TEST_BODYPART_ORDER = [
	'base',
	'head',
	'eyes',
	'lips',
	'backhair',
	'fronthair',
] as const;

const ASSET_TEST_BODYPART_DEFINITIONS: Record<AssetTestBodypartName, Partial<Omit<AssetBodyPart, 'name'>>> = {
	base: {
		required: true,
	},
	head: {
		required: true,
	},
	eyes: {
		required: true,
	},
	lips: {
		required: true,
	},
	backhair: {
		allowMultiple: true,
		adjustable: true,
	},
	fronthair: {
		allowMultiple: true,
		adjustable: true,
	},
};

const BODYPART_DEFAULT: Omit<AssetBodyPart, 'name'> = {
	required: false,
	allowMultiple: false,
	adjustable: false,
};

export type AssetTestBodypartName = string & (typeof ASSET_TEST_BODYPART_ORDER)[number];

export const ASSET_TEST_BODYPARTS: Immutable<AssetBodyPart[]> = ASSET_TEST_BODYPART_ORDER
	.map((name) => ({
		...BODYPART_DEFAULT,
		...ASSET_TEST_BODYPART_DEFINITIONS[name],
		name,
	}));
