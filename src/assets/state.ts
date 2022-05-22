import type { ArrayCompressType } from '../utility';
import type { AssetId } from '.';

export type AssetState = {
	id: AssetId;
	layers?: Partial<Record<'base' | `${number}`, LayerStateCompressed>>;
};

type LayerState = {
	color?: number;
	alpha?: number;
};
export type LayerStateCompressed = ArrayCompressType<LayerState, ['color', 'alpha']>;

type BoneState = {
	name: string;
	rotation: number;
};
export type BoneStateCompressed = ArrayCompressType<BoneState, ['name', 'rotation']>;
