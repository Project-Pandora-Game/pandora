import type { Immutable } from 'immer';
import {
	AppearancePose,
	Assert,
	AssertNever,
	IsNotNullable,
	Item,
	LAYER_PRIORITIES,
	LayerPriority,
	type GraphicsLayer,
	type LayerStateOverrides,
} from 'pandora-common';
import { useMemo } from 'react';

export type LayerState = {
	layerKey: string;
	layer: Immutable<GraphicsLayer>;
	item: Item | null;
	state?: LayerStateOverrides;
};

export function ComputeLayerPriorityOrder({ view, armsOrder, leftArm, rightArm, legs }: Immutable<AppearancePose>): readonly LayerPriority[] {
	function ReverseIf(condition: boolean, ...arr: ((LayerPriority | null)[] | null)[]): (LayerPriority | null)[] {
		return condition ? arr.reverse().flat() : arr.flat();
	}

	const order: LayerPriority[] = ([
		'BACKGROUND',

		...(ReverseIf(armsOrder.upper === 'left',
			leftArm.position === 'back_below_hair' ? [
				'BELOW_ARM_LEFT',
				'ARM_LEFT',
				'ABOVE_ARM_LEFT',
			] : null,
			rightArm.position === 'back_below_hair' ? [
				'BELOW_ARM_RIGHT',
				'ARM_RIGHT',
				'ABOVE_ARM_RIGHT',
			] : null,
		)),

		'BELOW_BACK_HAIR',
		'BACK_HAIR',
		'ABOVE_BACK_HAIR',

		...(ReverseIf(armsOrder.upper === 'left',
			leftArm.position === 'back' ? [
				'BELOW_ARM_LEFT',
				'ARM_LEFT',
				'ABOVE_ARM_LEFT',
			] : null,
			rightArm.position === 'back' ? [
				'BELOW_ARM_RIGHT',
				'ARM_RIGHT',
				'ABOVE_ARM_RIGHT',
			] : null,
		)),

		...(ReverseIf(legs.upper === 'left',
			[
				'BELOW_SOLE_LEFT',
				'SOLE_LEFT',
			],
			[
				'BELOW_SOLE_RIGHT',
				'SOLE_RIGHT',
			],
		)),

		'BELOW_BODY',

		...(ReverseIf(legs.upper === 'left',
			[
				'BELOW_LEG_LEFT',
				'LEG_LEFT',
				'ABOVE_LEG_LEFT',
			],
			[
				'BELOW_LEG_RIGHT',
				'LEG_RIGHT',
				'ABOVE_LEG_RIGHT',
			],
		)),

		'BODY',
		'BELOW_BREASTS',
		'BREASTS',
		'ABOVE_BODY',

		...(ReverseIf(armsOrder.upper === 'left',
			leftArm.position === 'front' ? [
				'BELOW_ARM_LEFT',
				'ARM_LEFT',
				'ABOVE_ARM_LEFT',
			] : null,
			rightArm.position === 'front' ? [
				'BELOW_ARM_RIGHT',
				'ARM_RIGHT',
				'ABOVE_ARM_RIGHT',
			] : null,
		)),

		'FRONT_HAIR',
		'ABOVE_FRONT_HAIR',

		...(ReverseIf(armsOrder.upper === 'left',
			leftArm.position === 'front_above_hair' ? [
				'BELOW_ARM_LEFT',
				'ARM_LEFT',
				'ABOVE_ARM_LEFT',
			] : null,
			rightArm.position === 'front_above_hair' ? [
				'BELOW_ARM_RIGHT',
				'ARM_RIGHT',
				'ABOVE_ARM_RIGHT',
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
	'BELOW_SOLE_LEFT',
	'BELOW_SOLE_RIGHT',
	'SOLE_LEFT',
	'SOLE_RIGHT',
	'BELOW_LEG_LEFT',
	'BELOW_LEG_RIGHT',
	'BELOW_BODY',
	'BELOW_BREASTS',
	'BELOW_ARM_LEFT',
	'BELOW_ARM_RIGHT',
] satisfies LayerPriority[]);

