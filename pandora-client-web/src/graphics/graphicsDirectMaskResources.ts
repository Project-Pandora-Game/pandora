import { Matrix, Shader, Texture, UniformGroup } from 'pixi.js';
import type { DirectMaskSampleFormat } from './graphicsDirectMaskShader.ts';

export interface DirectMaskSample {
	texture: Texture;
	matrix: Matrix;
	format: DirectMaskSampleFormat;
	revision: number;
}

/** Initial bindings must exist when Pixi creates the shader's resource accessors. */
export function CreateDirectMaskResources(samples: readonly DirectMaskSample[]): Record<string, unknown> & { directMaskUniforms: UniformGroup; } {
	const resources: ReturnType<typeof CreateDirectMaskResources> = {
		directMaskUniforms: new UniformGroup(Object.fromEntries(samples.map((_sample, i) => [`uDirectMaskMatrix${i}`, { type: 'mat3x3<f32>' as const, value: new Matrix() }]))),
	};
	for (let i = 0; i < samples.length; i++) {
		resources[`uDirectMask${i}`] = samples[i].texture.source;
		resources[`uDirectMaskSampler${i}`] = samples[i].texture.source.style;
	}
	return resources;
}

/** Call after restoring owned bind groups; coverage draws additionally offset the viewport. */
export function UpdateDirectMaskResources({ shader, uniforms }: { shader: Shader; uniforms: UniformGroup; }, samples: readonly DirectMaskSample[], offset?: Matrix): void {
	for (let i = 0; i < samples.length; i++) {
		const matrix = (uniforms.uniforms[`uDirectMaskMatrix${i}`] as Matrix).copyFrom(samples[i].matrix);
		if (offset) matrix.append(offset);
		shader.resources[`uDirectMask${i}`] = samples[i].texture.source;
		shader.resources[`uDirectMaskSampler${i}`] = samples[i].texture.source.style;
	}
	uniforms.update();
	shader.resources.directMaskUniforms = uniforms;
}

/** Release borrowed mask bindings before the raster's final lease disappears. */
export function UnbindDirectMaskTexture(shader: Shader, texture: Texture): void {
	for (const name of Object.getOwnPropertyNames(shader.resources)) {
		if (!/^uDirectMask\d+$/.test(name) || shader.resources[name] !== texture.source) continue;
		shader.resources[name] = Texture.EMPTY.source;
		shader.resources[name.replace('uDirectMask', 'uDirectMaskSampler')] = Texture.EMPTY.source.style;
	}
}
