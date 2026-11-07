import { Assert } from 'pandora-common';
import { GlProgram, GpuProgram } from 'pixi.js';

/** Leave room for two material textures within WebGL's minimum fragment sampler limit. */
export const DIRECT_MASK_MAX_DEPTH = 8;

interface DirectMaskPrograms { glProgram: GlProgram; gpuProgram: GpuProgram; }
const programs = new WeakMap<GlProgram, WeakMap<GpuProgram, Map<number, DirectMaskPrograms>>>();

function ReplaceOnce(source: string, pattern: RegExp, replacement: string): string {
	const matches = Array.from(source.matchAll(new RegExp(pattern.source, 'g')));
	Assert(matches.length === 1, 'Unsupported direct mask shader structure');
	return source.replace(pattern, replacement);
}

/**
 * Augment only the fragment stage; preserve the original material/skinning vertex source.
 * Assertions reject foreign shader layouts; callers must use the stencil fallback for them.
 */
export function GetDirectMaskPrograms(gl: GlProgram, gpu: GpuProgram, depth: number): DirectMaskPrograms {
	Assert(depth > 0 && depth <= DIRECT_MASK_MAX_DEPTH);
	let gpuCache = programs.get(gl);
	if (!gpuCache) programs.set(gl, gpuCache = new WeakMap());
	let depthCache = gpuCache.get(gpu);
	if (!depthCache) gpuCache.set(gpu, depthCache = new Map<number, DirectMaskPrograms>());
	const cached = depthCache.get(depth);
	if (cached) return cached;
	Assert(gl.vertex && gl.fragment && gpu.vertex && gpu.fragment, 'Direct masking requires both shader programs');
	let glFragment = gl.fragment;
	let gpuFragment = gpu.fragment.source;
	Assert(/struct VSOutput\s*\{/.test(gpu.vertex.source), 'Unsupported direct mask vertex output');
	Assert(!/@builtin\s*\(\s*position\s*\)/.test(gpuFragment), 'Unsupported direct mask fragment position input');
	const bindings = Object.values(gpu.layout[2] ?? {});
	let binding = Math.max(-1, ...bindings) + 1;
	const matrixFields: string[] = [];
	const glFragmentHeader: string[] = [];
	const glFragmentEnd: string[] = [];
	const gpuFragmentHeader: string[] = [];
	const gpuFragmentEnd: string[] = [];
	const uniformBinding = binding++;
	for (let i = 0; i < depth; i++) {
		matrixFields.push(`uDirectMaskMatrix${i}: mat3x3<f32>,`);
		glFragmentHeader.push(`uniform highp mat3 uDirectMaskMatrix${i}; uniform sampler2D uDirectMask${i};`);
		glFragmentEnd.push(`highp vec2 directMaskUV${i} = (uDirectMaskMatrix${i} * vec3(gl_FragCoord.xy, 1.)).xy;
vec4 directMask${i} = texture(uDirectMask${i}, directMaskUV${i}); if (directMask${i}.g > 0.5 && directMask${i}.r < 0.5) discard;`);
		gpuFragmentHeader.push(`@group(2) @binding(${binding++}) var uDirectMask${i}: texture_2d<f32>; @group(2) @binding(${binding++}) var uDirectMaskSampler${i}: sampler;`);
		// Explicit LOD avoids derivative-uniformity requirements after a preceding discard.
		gpuFragmentEnd.push(`let directMaskUV${i} = (directMaskUniforms.uDirectMaskMatrix${i} * vec3<f32>(directMaskPosition.xy, 1.)).xy;
let directMask${i} = textureSampleLevel(uDirectMask${i}, uDirectMaskSampler${i}, directMaskUV${i}, 0.); if (directMask${i}.g > 0.5 && directMask${i}.r < 0.5) { discard; }`);
	}
	glFragment = ReplaceOnce(glFragment, /void main\s*\(\s*(?:void)?\s*\)\s*\{/, `${glFragmentHeader.join('\n')}\nvoid main() {`);
	glFragment = ReplaceOnce(glFragment, /}\s*$/, `${glFragmentEnd.join('\n')}\n}`);
	gpuFragmentHeader.push(`struct DirectMaskUniforms { ${matrixFields.join('\n')} }\n@group(2) @binding(${uniformBinding}) var<uniform> directMaskUniforms: DirectMaskUniforms;`);
	gpuFragment = ReplaceOnce(gpuFragment, /@fragment\s+fn main\s*\(/, `${gpuFragmentHeader.join('\n')}\n@fragment fn main(\n@builtin(position) directMaskPosition: vec4<f32>,`);
	gpuFragment = ReplaceOnce(gpuFragment, /return finalColor;/, `${gpuFragmentEnd.join('\n')}\nreturn finalColor;`);
	const result = {
		glProgram: GlProgram.from({ name: 'pandora-direct-mask', vertex: gl.vertex, fragment: glFragment }),
		gpuProgram: GpuProgram.from({ name: 'pandora-direct-mask', vertex: gpu.vertex, fragment: { source: gpuFragment, entryPoint: 'main' } }),
	};
	depthCache.set(depth, result);
	return result;
}
