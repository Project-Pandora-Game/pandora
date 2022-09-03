import _ from 'lodash';
import { ArmsPose, BoneName, LayerPriority, LAYER_PRIORITIES } from 'pandora-common';
import { AssetGraphicsLayer } from '../assets/assetGraphics';

export type LayerStateOverrides = {
	color?: number;
	alpha?: number;
};

export type LayerState = {
	layer: AssetGraphicsLayer,
	state?: LayerStateOverrides;
};

export const PRIORITY_ORDER_SPRITES: readonly LayerPriority[] = LAYER_PRIORITIES;

export const PRIORITY_ORDER_ARMS_BACK: readonly LayerPriority[] = [
	'BACKGROUND',
	'BELOW_BACK_HAIR',
	'BACK_HAIR',
	'BELOW_ARMS',
	'ARMS',
	'ABOVE_ARMS',
	'BELOW_BODY',
	'BODY',
	'BREASTS',
	'ABOVE_BODY',
	'FRONT_HAIR',
	'ABOVE_FRONT_HAIR',
	'OVERLAY',
];
// Test we are correct
if (!_.isEqual(new Set(LAYER_PRIORITIES), new Set(PRIORITY_ORDER_ARMS_BACK)) || LAYER_PRIORITIES.length !== PRIORITY_ORDER_ARMS_BACK.length) {
	throw new Error('PRIORITY_ORDER_ARMS_BACK not valid');
}

export const PRIORITY_ORDER_ARMS_FRONT: readonly LayerPriority[] = [
	'BACKGROUND',
	'BELOW_BACK_HAIR',
	'BACK_HAIR',
	'BELOW_BODY',
	'BODY',
	'BREASTS',
	'ABOVE_BODY',
	'BELOW_ARMS',
	'ARMS',
	'ABOVE_ARMS',
	'FRONT_HAIR',
	'ABOVE_FRONT_HAIR',
	'OVERLAY',
];
// Test we are correct
if (!_.isEqual(new Set(LAYER_PRIORITIES), new Set(PRIORITY_ORDER_ARMS_FRONT)) || LAYER_PRIORITIES.length !== PRIORITY_ORDER_ARMS_FRONT.length) {
	throw new Error('PRIORITY_ORDER_ARMS_FRONT not valid');
}

// Some priority layers need their internal order reversed to make sense
export const PRIORITY_ORDER_REVERSE_PRIORITIES: ReadonlySet<LayerPriority> = new Set([
	'BACKGROUND',
	'BELOW_BACK_HAIR',
	'BACK_HAIR',
	'BELOW_BODY',
	'BELOW_ARMS',
]);

export const WARDROBE_POSES: {
	category: string;
	poses: {
		name: string;
		pose: Record<BoneName, number>;
		armsPose?: ArmsPose;
	}[];
}[] =
	/* eslint-disable @typescript-eslint/naming-convention */
	[
		{
			category: 'Arms (front)',
			poses: [
				{
					name: 'Hanging side',
					pose: {
						arm_r: 78,
						arm_l: 78,
						elbow_r: 9,
						elbow_l: 9,
					},
					armsPose: ArmsPose.FRONT,
				},
				{
					name: 'Hanging front',
					pose: {
						arm_r: 74,
						arm_l: 74,
						elbow_r: 22,
						elbow_l: 22,
					},
					armsPose: ArmsPose.FRONT,
				},
				// TODO: right side only poses can break in combination with back poses
				{
					name: 'Right hand over mouth',
					pose: {
						arm_r: 90,
						elbow_r: 161,
					},
					armsPose: ArmsPose.FRONT,
				},
				{
					name: 'Casual',
					pose: {
						arm_r: 82,
						arm_l: 48,
						elbow_r: 66,
						elbow_l: 66,
					},
					armsPose: ArmsPose.FRONT,
				},
				// TODO: Consider way to switch front/back view of just the hand (maybe together with option to show fists)
				{
					name: 'Covering eyes',
					pose: {
						arm_r: -43,
						arm_l: -43,
						elbow_r: -127,
						elbow_l: -127,
					},
					armsPose: ArmsPose.FRONT,
				},
				{
					name: 'Wrists crossed front',
					pose: {
						arm_r: 82,
						arm_l: 82,
						elbow_r: 55,
						elbow_l: 55,
					},
					armsPose: ArmsPose.FRONT,
				},
				{
					name: 'Arms folded over chest',
					pose: {
						arm_r: 70,
						arm_l: 79,
						elbow_r: 109,
						elbow_l: 108,
					},
					armsPose: ArmsPose.FRONT,
				},
				{
					name: 'Covering breasts',
					pose: {
						arm_r: 70,
						arm_l: 70,
						elbow_r: 129,
						elbow_l: 130,
					},
					armsPose: ArmsPose.FRONT,
				},
				{
					name: 'Covering sex 1',
					pose: {
						arm_r: 64,
						arm_l: 64,
						elbow_r: 66,
						elbow_l: 64,
					},
					armsPose: ArmsPose.FRONT,
				},
				{
					name: 'Covering sex 2',
					pose: {
						arm_r: 74,
						arm_l: 74,
						elbow_r: 43,
						elbow_l: 43,
					},
					armsPose: ArmsPose.FRONT,
				},
				{
					name: 'Covering breasts & sex',
					pose: {
						arm_r: 43,
						arm_l: 64,
						elbow_r: 144,
						elbow_l: 64,
					},
					armsPose: ArmsPose.FRONT,
				},
			],
		},
		{
			category: 'Arms (back)',
			poses: [
				{
					name: 'Hands behind',
					pose: {
						arm_r: 74,
						arm_l: 74,
						elbow_r: 43,
						elbow_l: 43,
					},
					armsPose: ArmsPose.BACK,
				},
				{
					name: 'Wrists crossed behind',
					pose: {
						arm_r: 82,
						arm_l: 82,
						elbow_r: 55,
						elbow_l: 55,
					},
					armsPose: ArmsPose.BACK,
				},
				{
					name: 'Arms folded behind',
					pose: {
						arm_r: 75,
						arm_l: 75,
						elbow_r: 98,
						elbow_l: 98,
					},
					armsPose: ArmsPose.BACK,
				},
				{
					name: 'Elbows together',
					pose: {
						arm_r: 104,
						arm_l: 104,
						elbow_r: -4,
						elbow_l: -4,
					},
					armsPose: ArmsPose.BACK,
				},
				{
					name: 'Covering butt',
					pose: {
						arm_r: 100,
						arm_l: 98,
						elbow_r: -11,
						elbow_l: -6,
					},
					armsPose: ArmsPose.BACK,
				},
				//  TODO: Hands are under the back hair; arms need to be split at the elbows most likely
				/* {
					name: 'Hands behind head',
					pose: {
						arm_r: -46,
						arm_l: -46,
						elbow_r: -124,
						elbow_l: -124,
					},
					armsPose: ArmsPose.BACK,
				}, */
			],
		},
		{
			category: 'Arms (spread)',
			poses: [
				{
					name: 'Up',
					pose: {
						arm_r: -70,
						arm_l: -70,
						elbow_r: -20,
						elbow_l: -20,
					},
					armsPose: ArmsPose.FRONT,
				},
				{
					name: 'Raised',
					pose: {
						arm_r: -25,
						arm_l: -25,
						elbow_r: -60,
						elbow_l: -60,
					},
					armsPose: ArmsPose.FRONT,
				},
				{
					name: 'Spread/Open',
					pose: {
						arm_r: -40,
						arm_l: -40,
						elbow_r: -11,
						elbow_l: -11,
					},
					armsPose: ArmsPose.FRONT,
				},
				{
					name: 'Spread/Open wide',
					pose: {
						arm_r: -22,
						arm_l: -22,
						elbow_r: -11,
						elbow_l: -11,
					},
					armsPose: ArmsPose.FRONT,
				},
				{
					name: 'T-Pose',
					pose: {
						arm_r: 0,
						arm_l: 0,
						elbow_r: 0,
						elbow_l: 0,
					},
					armsPose: ArmsPose.FRONT,
				},
			],
		},
		{
			category: 'Legs (straight)',
			poses: [
				{
					name: 'Normal',
					pose: {
						leg_r: 0,
						leg_l: 0,
						sitting: 0,
						kneeling: 0,
					},
				},
				{
					name: 'Closed',
					pose: {
						leg_r: 2,
						leg_l: 2,
						sitting: 0,
						kneeling: 0,
					},
				},
				{
					name: 'Crossed',
					pose: {
						leg_r: 6,
						leg_l: 6,
						sitting: 0,
						kneeling: 0,
					},
				},
				{
					name: 'Balancing',
					pose: {
						leg_r: 4,
						leg_l: 4,
						sitting: 0,
						kneeling: 0,
					},
				},
				{
					name: 'Spread slightly',
					pose: {
						leg_r: -8,
						leg_l: -8,
						sitting: 0,
						kneeling: 0,
					},
				},
				{
					name: 'Spread',
					pose: {
						leg_r: -18,
						leg_l: -18,
						sitting: 0,
						kneeling: 0,
					},
				},
				{
					name: 'Spread wide',
					pose: {
						leg_r: -30,
						leg_l: -30,
						sitting: 0,
						kneeling: 0,
					},
				},
				{
					name: 'Spread extreme',
					pose: {
						leg_r: -50,
						leg_l: -50,
						sitting: 0,
						kneeling: 0,
					},
				},
				{
					name: 'Full split',
					pose: {
						leg_r: -85,
						leg_l: -85,
						sitting: 0,
						kneeling: 0,
					},
				},
			],
		},
		{
			category: 'Legs (kneeling) [experimental]',
			poses: [
				{
					name: 'Kneeling',
					pose: {
						leg_r: 0,
						leg_l: 0,
						sitting: 0,
						kneeling: 180,
					},
				},
				{
					name: 'Kneeling spread slightly',
					pose: {
						leg_r: -7,
						leg_l: -7,
						sitting: 0,
						kneeling: 180,
					},
				},
				{
					name: 'Kneeling spread',
					pose: {
						leg_r: -16,
						leg_l: -16,
						sitting: 0,
						kneeling: 180,
					},
				},
				{
					name: 'Kneeling spread wide',
					pose: {
						leg_r: -25,
						leg_l: -25,
						sitting: 0,
						kneeling: 180,
					},
				},
			],
		},
		{
			category: 'Legs (sitting) [experimental]',
			poses: [
				{
					name: 'Sitting',
					pose: {
						leg_r: 0,
						leg_l: 0,
						sitting: 180,
						kneeling: 0,
					},
				},
				{
					name: 'Sitting spread slightly',
					pose: {
						leg_r: -7,
						leg_l: -7,
						sitting: 180,
						kneeling: 0,
					},
				},
				{
					name: 'Sitting spread',
					pose: {
						leg_r: -16,
						leg_l: -16,
						sitting: 180,
						kneeling: 0,
					},
				},
				{
					name: 'Sitting spread wide',
					pose: {
						leg_r: -25,
						leg_l: -25,
						sitting: 180,
						kneeling: 0,
					},
				},
			],
		},
	];
/* eslint-enable @typescript-eslint/naming-convention */
