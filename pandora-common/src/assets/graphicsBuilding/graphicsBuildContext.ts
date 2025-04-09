import type { Immutable } from 'immer';
import type { PointTemplateSource } from '../graphics/points.ts';
import type { AssetModuleDefinition } from '../modules.ts';
import type { GraphicsBuildImageResource } from './graphicsBuildImageResource.ts';

export interface GraphicsBuildContext {
	readonly runImageBasedChecks: boolean;
	readonly generateOptimizedTextures: boolean;
	readonly generateResolutions: readonly number[];

	getPointTemplate(name: string): Immutable<PointTemplateSource> | undefined;
	loadImage(image: string): GraphicsBuildImageResource;
	bufferToBase64: (buffer: Uint8Array) => string;

	readonly builtAssetData: Immutable<{
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		modules: Record<string, AssetModuleDefinition<unknown, any>> | undefined;
	}>;
}
