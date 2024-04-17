import type { Immutable } from 'immer';
import { useMemo } from 'react';
import {
	AppearancePose,
	ArrayIncludesGuard,
	Assert,
	AssertNever,
	CharacterArmsPose,
	Item,
	LAYER_PRIORITIES,
	LayerPriority,
} from 'pandora-common';
import { AssetGraphicsLayer } from '../assets/assetGraphics';

export type LayerStateOverrides = {
	color?: number;
	alpha?: number;
};

export type LayerState = {
	layer: AssetGraphicsLayer;
	item: Item | null;
	state?: LayerStateOverrides;
};

export const DOUBLE_ORDERED = [
	'BELOW_ARM_RIGHT',
	'BELOW_ARM_LEFT',
	'ARM_RIGHT',
	'ARM_LEFT',
	'ABOVE_ARM_RIGHT',
	'ABOVE_ARM_LEFT',
] as const satisfies readonly LayerPriority[];
type DoubleOrdered = typeof DOUBLE_ORDERED[number];

export type ComputedLayerPriority = Exclude<LayerPriority, DoubleOrdered>
	| `${DoubleOrdered}_BACK`
	| `${DoubleOrdered}_FRONT`;

type LeftRight = 'LEFT' | 'RIGHT';

export function useComputedLayerPriority({ view, armsOrder }: Immutable<AppearancePose>): readonly ComputedLayerPriority[] {
	return useMemo(() => {
		const arms: [LeftRight, LeftRight] = ['LEFT', 'RIGHT'];

		if (armsOrder.upper === 'left') {
			arms.reverse();
		}

		const order = [
			'BACKGROUND',
			'BELOW_BACK_HAIR',
			'BACK_HAIR',

			`BELOW_ARM_${arms[0]}_BACK`,
			`ARM_${arms[0]}_BACK`,
			`ABOVE_ARM_${arms[0]}_BACK`,

			`BELOW_ARM_${arms[1]}_BACK`,
			`ARM_${arms[1]}_BACK`,
			`ABOVE_ARM_${arms[1]}_BACK`,

			'BELOW_BODY_SOLES',
			'BODY_SOLES',
			'BELOW_BODY',
			'BODY',
			'BELOW_BREASTS',
			'BREASTS',
			'ABOVE_BODY',

			`BELOW_ARM_${arms[0]}_FRONT`,
			`ARM_${arms[0]}_FRONT`,
			`ABOVE_ARM_${arms[0]}_FRONT`,

			`BELOW_ARM_${arms[1]}_FRONT`,
			`ARM_${arms[1]}_FRONT`,
			`ABOVE_ARM_${arms[1]}_FRONT`,

			'FRONT_HAIR',
			'ABOVE_FRONT_HAIR',
			'OVERLAY',
		] satisfies readonly ComputedLayerPriority[];

		Assert(new Set(order).size === order.length);
		Assert(order.length === LAYER_PRIORITIES.length + DOUBLE_ORDERED.length);

		switch (view) {
			case 'front':
				return order;
			case 'back':
				return order.reverse();
		}
		AssertNever(view);
	}, [view, armsOrder.upper]);
}

// Some priority layers need their internal order reversed to make sense
export const PRIORITY_ORDER_REVERSE_PRIORITIES: ReadonlySet<ComputedLayerPriority> = new Set([
	'BACKGROUND',
	'BELOW_BACK_HAIR',
	'BACK_HAIR',
	'BELOW_BODY_SOLES',
	'BELOW_BODY',
	'BELOW_BREASTS',
	'BELOW_ARM_LEFT_BACK',
	'BELOW_ARM_RIGHT_BACK',
	'BELOW_ARM_LEFT_FRONT',
	'BELOW_ARM_RIGHT_FRONT',
]);

// Some priority layers should get mirrored when layer get mirrored
export const PRIORITY_ORDER_MIRROR: Partial<Record<LayerPriority, LayerPriority>> = {
	BELOW_ARM_LEFT: 'BELOW_ARM_RIGHT',
	BELOW_ARM_RIGHT: 'BELOW_ARM_LEFT',

	ARM_LEFT: 'ARM_RIGHT',
	ARM_RIGHT: 'ARM_LEFT',

	ABOVE_ARM_LEFT: 'ABOVE_ARM_RIGHT',
	ABOVE_ARM_RIGHT: 'ABOVE_ARM_LEFT',
};

if (!(Object.entries(PRIORITY_ORDER_MIRROR)).every(([original, mirror]) => PRIORITY_ORDER_MIRROR[mirror] === original)) {
	throw new Error('PRIORITY_ORDER_MIRROR not valid');
}

export function MirrorPriority(priority: LayerPriority): LayerPriority {
	const mirrorPriority = PRIORITY_ORDER_MIRROR[priority];
	return mirrorPriority != null ? mirrorPriority : priority;
}

export function ComputeLayerPriority(priority: LayerPriority, { leftArm, rightArm }: CharacterArmsPose): ComputedLayerPriority {
	if (!ArrayIncludesGuard(DOUBLE_ORDERED, priority)) {
		return priority;
	}

	switch (priority) {
		case 'ABOVE_ARM_LEFT':
		case 'ARM_LEFT':
		case 'BELOW_ARM_LEFT':
			return leftArm.position === 'front' ? `${priority}_FRONT` : `${priority}_BACK`;
		case 'ABOVE_ARM_RIGHT':
		case 'ARM_RIGHT':
		case 'BELOW_ARM_RIGHT':
			return rightArm.position === 'front' ? `${priority}_FRONT` : `${priority}_BACK`;
	}

	AssertNever(priority);
}
