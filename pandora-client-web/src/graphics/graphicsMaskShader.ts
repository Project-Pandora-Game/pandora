import { GpuProgram } from 'pixi.js';

// Keep Pixi's filter coordinate conventions and the legacy premultiplied texture
// samples. The binary cut is intentionally independent of sprite alpha and the
// mask clamp uniforms, matching the existing WebGL custom mask filter.
const ALPHA_MASK_FILTER_WGSL = /* wgsl */`
struct GlobalFilterUniforms {
	uInputSize: vec4<f32>,
	uInputPixel: vec4<f32>,
	uInputClamp: vec4<f32>,
	uOutputFrame: vec4<f32>,
	uGlobalFrame: vec4<f32>,
	uOutputTexture: vec4<f32>,
};

struct MaskUniforms {
	uFilterMatrix: mat3x3<f32>,
	uMaskClamp: vec4<f32>,
	uAlpha: f32,
};

@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;
@group(1) @binding(0) var<uniform> filterUniforms: MaskUniforms;
@group(1) @binding(1) var uMaskTexture: texture_2d<f32>;
@group(1) @binding(2) var uMaskSampler: sampler;

struct VSOutput {
	@builtin(position) position: vec4<f32>,
	@location(0) uv: vec2<f32>,
	@location(1) maskUv: vec2<f32>,
};

fn filterVertexPosition(aPosition: vec2<f32>) -> vec4<f32> {
	var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;
	position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
	position.y = position.y * (2.0 * gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;
	return vec4<f32>(position, 0.0, 1.0);
}

fn filterTextureCoord(aPosition: vec2<f32>) -> vec2<f32> {
	return aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw);
}

@vertex
fn mainVertex(@location(0) aPosition: vec2<f32>) -> VSOutput {
	let uv = filterTextureCoord(aPosition);
	let maskUv = (filterUniforms.uFilterMatrix * vec3<f32>(uv, 1.0)).xy;
	return VSOutput(filterVertexPosition(aPosition), uv, maskUv);
}

@fragment
fn mainFragment(
	@location(0) uv: vec2<f32>,
	@location(1) maskUv: vec2<f32>,
) -> @location(0) vec4<f32> {
	let original = textureSample(uTexture, uSampler, uv);
	let masky = textureSample(uMaskTexture, uMaskSampler, maskUv);
	if (masky.a > 0.5 && masky.r < 0.5) {
		discard;
	}
	return original;
}
`;

export function GetAlphaMaskGpuProgram(): GpuProgram {
	return GpuProgram.from({
		name: 'pandora-alpha-mask-filter',
		vertex: { source: ALPHA_MASK_FILTER_WGSL, entryPoint: 'mainVertex' },
		fragment: { source: ALPHA_MASK_FILTER_WGSL, entryPoint: 'mainFragment' },
	});
}
