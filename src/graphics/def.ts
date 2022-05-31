import { LayerPriority } from 'pandora-common';
import { AssetGraphicsLayer } from '../assets/assetGraphics';

export type LayerStateOverrides = {
	color?: number;
	alpha?: number;
};

export type LayerState = {
	layer: AssetGraphicsLayer,
	state?: LayerStateOverrides;
};

export const PRIORITY_ORDER_SPRITES: readonly LayerPriority[] = [
	LayerPriority.BACKGROUND,
	LayerPriority.BELOW_BODY,
	LayerPriority.BELOW_ARMS,
	LayerPriority.BODY,
	LayerPriority.ARMS,
	LayerPriority.ABOVE_BODY,
	LayerPriority.ABOVE_ARMS,
	LayerPriority.OVERLAY,
];

export const PRIORITY_ORDER_ARMS_BACK: readonly LayerPriority[] = [
	LayerPriority.BACKGROUND,
	LayerPriority.BELOW_ARMS,
	LayerPriority.ARMS,
	LayerPriority.ABOVE_ARMS,
	LayerPriority.BELOW_BODY,
	LayerPriority.BODY,
	LayerPriority.ABOVE_BODY,
	LayerPriority.OVERLAY,
];

export const PRIORITY_ORDER_ARMS_FRONT: readonly LayerPriority[] = [
	LayerPriority.BACKGROUND,
	LayerPriority.BELOW_BODY,
	LayerPriority.BODY,
	LayerPriority.ABOVE_BODY,
	LayerPriority.BELOW_ARMS,
	LayerPriority.ARMS,
	LayerPriority.ABOVE_ARMS,
	LayerPriority.OVERLAY,
];
