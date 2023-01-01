import _ from 'lodash';
import { ArmsPose, Item, LayerPriority, LAYER_PRIORITIES } from 'pandora-common';
import { AssetGraphicsLayer } from '../assets/assetGraphics';

export type LayerStateOverrides = {
	color?: number;
	alpha?: number;
};

export type LayerState = {
	layer: AssetGraphicsLayer,
	item: Item | null,
	state?: LayerStateOverrides;
};

export const DOUBLE_ORDERED = ['BELOW_ARMS', 'ARMS', 'ABOVE_ARMS'] satisfies LayerPriority[];
type DoubleOrdered = typeof DOUBLE_ORDERED[number];

export type ComputedLayerPriority = keyof Omit<Record<LayerPriority, unknown>, DoubleOrdered>
	| `${DoubleOrdered}_BACK`
	| `${DoubleOrdered}_FRONT`;

export const COMPUTED_LAYER_ORDERING = [
	'BACKGROUND',
	'BELOW_BACK_HAIR',
	'BACK_HAIR',

	'BELOW_ARMS_BACK',
	'ARMS_BACK',
	'ABOVE_ARMS_BACK',

	'BELOW_BODY',
	'BODY',
	'BELOW_BREASTS',
	'BREASTS',
	'ABOVE_BODY',

	'BELOW_ARMS_FRONT',
	'ARMS_FRONT',
	'ABOVE_ARMS_FRONT',

	'FRONT_HAIR',
	'ABOVE_FRONT_HAIR',
	'OVERLAY',
] satisfies ComputedLayerPriority[];

if (new Set(COMPUTED_LAYER_ORDERING).size !== COMPUTED_LAYER_ORDERING.length || LAYER_PRIORITIES.length + DOUBLE_ORDERED.length !== COMPUTED_LAYER_ORDERING.length) {
	throw new Error('COMPUTED_LAYER_ORDERING not valid');
}

export const PRIORITY_ORDER_SPRITES = [
	'BACKGROUND',
	'BELOW_BACK_HAIR',
	'BACK_HAIR',
	'BELOW_BODY',
	'BODY',
	'BELOW_BREASTS',
	'BREASTS',
	'ABOVE_BODY',
	'FRONT_HAIR',
	'ABOVE_FRONT_HAIR',
	'BELOW_ARMS_BACK',
	'BELOW_ARMS_FRONT',
	'ARMS_BACK',
	'ARMS_FRONT',
	'ABOVE_ARMS_BACK',
	'ABOVE_ARMS_FRONT',
	'OVERLAY',
] satisfies ComputedLayerPriority[];

if (new Set(PRIORITY_ORDER_SPRITES).size !== PRIORITY_ORDER_SPRITES.length || LAYER_PRIORITIES.length + DOUBLE_ORDERED.length !== PRIORITY_ORDER_SPRITES.length) {
	throw new Error('PRIORITY_ORDER_SPRITES not valid');
}

// Some priority layers need their internal order reversed to make sense
export const PRIORITY_ORDER_REVERSE_PRIORITIES: ReadonlySet<ComputedLayerPriority> = new Set([
	'BACKGROUND',
	'BELOW_BACK_HAIR',
	'BACK_HAIR',
	'BELOW_BODY',
	'BELOW_BREASTS',
	'BELOW_ARMS_BACK',
	'BELOW_ARMS_FRONT',
]);

export function ComputeLayerPriority(priority: LayerPriority, armsPose: ArmsPose): ComputedLayerPriority {
	if (!DOUBLE_ORDERED.includes(priority as DoubleOrdered)) {
		return priority as ComputedLayerPriority;
	}
	if (armsPose === ArmsPose.FRONT) {
		return `${priority}_FRONT` as ComputedLayerPriority;
	} else {
		return `${priority}_BACK` as ComputedLayerPriority;
	}
}
