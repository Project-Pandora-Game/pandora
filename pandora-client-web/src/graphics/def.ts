import _ from 'lodash';
import { Item, LayerPriority, LAYER_PRIORITIES } from 'pandora-common';
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
	'BELOW_BREASTS',
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
	'BELOW_BREASTS',
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
	'BELOW_BREASTS',
	'BELOW_ARMS',
]);
