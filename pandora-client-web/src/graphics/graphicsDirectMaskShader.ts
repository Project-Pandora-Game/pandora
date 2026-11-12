import { Assert } from 'pandora-common';
import { GlProgram } from 'pixi.js';

/** Leave room for material textures within WebGL's minimum fragment sampler limit. */
export const DIRECT_MASK_MAX_DEPTH = 8;
export type DirectMaskSampleFormat = 'rg8unorm' | 'keep';

export interface DirectMaskPrograms { glProgram: GlProgram; }

const programs = new WeakMap<GlProgram, Map<string, DirectMaskPrograms>>();

/** Clip the material output without changing its vertex program or early returns. */
export function GetDirectMaskPrograms(
	gl: GlProgram | null | undefined,
	depth: number,
	formats?: readonly DirectMaskSampleFormat[],
): DirectMaskPrograms {
	Assert(depth > 0 && depth <= DIRECT_MASK_MAX_DEPTH && Number.isInteger(depth));
	Assert(gl, 'Direct masking requires a WebGL shader program');
	Assert(formats === undefined || formats.length === depth, 'Direct mask formats must match mask depth');
	const channels = Array.from({ length: depth }, (_, i) => formats?.[i] === 'keep' ? 'keep' : 'g');
	const key = channels.join('');
	let cache = programs.get(gl);
	if (!cache) programs.set(gl, cache = new Map<string, DirectMaskPrograms>());
	const cached = cache.get(key);
	if (cached) return cached;
	Assert(gl.vertex && gl.fragment, 'Destroyed direct mask WebGL program');
	const header: string[] = [];
	const predicate: string[] = [];
	for (let i = 0; i < depth; i++) {
		header.push(`uniform highp mat3 uDirectMaskMatrix${i}; uniform sampler2D uDirectMask${i};`);
		const sample = `pandoraDirectMask${i}`;
		const cut = channels[i] === 'keep' ? `${sample}.r < 0.5` : `${sample}.g > 0.5 && ${sample}.r < 0.5`;
		predicate.push(`highp vec2 pandoraDirectMaskUV${i} = (uDirectMaskMatrix${i} * vec3(gl_FragCoord.xy, 1.)).xy;
vec4 ${sample} = texture(uDirectMask${i}, pandoraDirectMaskUV${i}); if (${cut}) discard;`);
	}
	// Let GLSL rename the entry point without parsing or editing the material.
	// Calling it before clipping preserves early returns and derivative evaluation.
	let name = 'pandoraDirectMaskMaterial';
	while (gl.fragment.includes(name)) name += '_';
	const fragment = `#define main ${name}\n${gl.fragment}\n#undef main\n${header.join('\n')}\nvoid main() { ${name}();\n${predicate.join('\n')}\n}`;
	const result = { glProgram: GlProgram.from({ name: 'pandora-direct-mask', vertex: gl.vertex, fragment, transformFeedbackVaryings: gl.transformFeedbackVaryings }) };
	cache.set(key, result);
	return result;
}
