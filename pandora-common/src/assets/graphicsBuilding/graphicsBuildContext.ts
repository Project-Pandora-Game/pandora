import type { Immutable } from 'immer';
import type { PointTemplate } from '../graphics/points.ts';
import type { GraphicsBuildImageResource } from './graphicsBuildImageResource.ts';

export interface GraphicsBuildContext {
	readonly generateOptimizedTextures: boolean;
	readonly generateResolutions: readonly number[];

	getPointTemplate(name: string): Immutable<PointTemplate> | undefined;
	loadImage(image: string): GraphicsBuildImageResource;
	bufferToBase64: (buffer: Uint8Array) => string;
}
