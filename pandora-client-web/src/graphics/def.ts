import type { Immutable } from 'immer';
import {
	AppearancePose,
	Assert,
	AssertNever,
	IsNotNullable,
	Item,
	LAYER_PRIORITIES,
	LayerPriority,
	type LayerStateOverrides,
} from 'pandora-common';
import { useMemo } from 'react';
import { AssetGraphicsLayer } from '../assets/assetGraphics.ts';

export type LayerState = {
	layer: AssetGraphicsLayer;
	item: Item | null;
	state?: LayerStateOverrides;
};

export function ComputeLayerPriorityOrder({ view, armsOrder, leftArm, rightArm }: Immutable<AppearancePose>): readonly LayerPriority[] {
	function ReverseIf(condition: boolean, ...arr: ((LayerPriority | null)[] | null)[]): (LayerPriority | null)[] {
		return condition ? arr.reverse().flat() : arr.flat();
	}

	const order: LayerPriority[] = ([
		'BACKGROUND',

		...(ReverseIf(armsOrder.upper === 'left',
			leftArm.position === 'back_below_hair' ? [
				`BELOW_ARM_LEFT`,
				`ARM_LEFT`,
				`ABOVE_ARM_LEFT`,
			] : null,
			rightArm.position === 'back_below_hair' ? [
				`BELOW_ARM_RIGHT`,
				`ARM_RIGHT`,
				`ABOVE_ARM_RIGHT`,
			] : null,
		)),

		'BELOW_BACK_HAIR',
		'BACK_HAIR',

		...(ReverseIf(armsOrder.upper === 'left',
			leftArm.position === 'back' ? [
				`BELOW_ARM_LEFT`,
				`ARM_LEFT`,
				`ABOVE_ARM_LEFT`,
			] : null,
			rightArm.position === 'back' ? [
				`BELOW_ARM_RIGHT`,
				`ARM_RIGHT`,
				`ABOVE_ARM_RIGHT`,
			] : null,
		)),

		'BELOW_BODY_SOLES',
		'BODY_SOLES',
		'BELOW_BODY',
		'BODY',
		'BELOW_BREASTS',
		'BREASTS',
		'ABOVE_BODY',

		...(ReverseIf(armsOrder.upper === 'left',
			leftArm.position === 'front' ? [
				`BELOW_ARM_LEFT`,
				`ARM_LEFT`,
				`ABOVE_ARM_LEFT`,
			] : null,
			rightArm.position === 'front' ? [
				`BELOW_ARM_RIGHT`,
				`ARM_RIGHT`,
				`ABOVE_ARM_RIGHT`,
			] : null,
		)),

		'FRONT_HAIR',
		'ABOVE_FRONT_HAIR',

		...(ReverseIf(armsOrder.upper === 'left',
			leftArm.position === 'front_above_hair' ? [
				`BELOW_ARM_LEFT`,
				`ARM_LEFT`,
				`ABOVE_ARM_LEFT`,
			] : null,
			rightArm.position === 'front_above_hair' ? [
				`BELOW_ARM_RIGHT`,
				`ARM_RIGHT`,
				`ABOVE_ARM_RIGHT`,
			] : null,
		)),

		'OVERLAY',
	] satisfies readonly (LayerPriority | null)[])
		.filter(IsNotNullable);

	Assert(new Set(order).size === order.length);
	Assert(order.length === LAYER_PRIORITIES.length);

	switch (view) {
		case 'front':
			return order;
		case 'back':
			return order.reverse();
	}
	AssertNever(view);
}

export function useComputedLayerPriority(pose: Immutable<AppearancePose>): readonly LayerPriority[] {
	return useMemo((): readonly LayerPriority[] => ComputeLayerPriorityOrder(pose), [pose]);
}

// Some priority layers need their internal order reversed to make sense
export const PRIORITY_ORDER_REVERSE_PRIORITIES: ReadonlySet<LayerPriority> = new Set([
	'BACKGROUND',
	'BELOW_BACK_HAIR',
	'BACK_HAIR',
	'BELOW_BODY_SOLES',
	'BELOW_BODY',
	'BELOW_BREASTS',
	'BELOW_ARM_LEFT',
	'BELOW_ARM_RIGHT',
] satisfies LayerPriority[]);

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
