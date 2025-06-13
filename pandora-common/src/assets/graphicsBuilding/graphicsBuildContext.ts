import type { Immutable } from 'immer';
import type { BoneDefinition } from '../graphics/graphics.ts';
import type { PointTemplateSource } from '../graphics/points.ts';
import type { AssetModuleDefinition } from '../modules.ts';
import type { GraphicsBuildImageResource } from './graphicsBuildImageResource.ts';

export interface GraphicsBuildContextAssetData {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	modules: Record<string, AssetModuleDefinition<unknown, any>> | undefined;
	/** List of all valid colorization keys for this asset. */
	colorizationKeys: ReadonlySet<string>;
}

export interface GraphicsBuildContext {
	readonly runImageBasedChecks: boolean;
	readonly generateOptimizedTextures: boolean;
	readonly generateResolutions: readonly number[];

	getBones(): Immutable<BoneDefinition[]>;
	getPointTemplate(name: string): Immutable<PointTemplateSource> | undefined;
	loadImage(image: string): GraphicsBuildImageResource;
	bufferToBase64: (buffer: Uint8Array) => string;

	readonly builtAssetData: Immutable<GraphicsBuildContextAssetData>;
}
