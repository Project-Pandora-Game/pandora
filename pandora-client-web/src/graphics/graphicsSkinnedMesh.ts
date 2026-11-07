import { MAX_BONE_COUNT } from 'pandora-common';
import {
	Bounds, Buffer, BufferUsage, Geometry, Mesh, Shader, UniformGroup,
	compileHighShaderGlProgram, compileHighShaderGpuProgram, localUniformBit, localUniformBitGl,
	pointInTriangle, roundPixelsBit, roundPixelsBitGl, textureBit, textureBitGl,
	type DestroyOptions, type HighShaderBit, type PointData, type State, type Texture,
} from 'pixi.js';
import type { LayerVerticesTransformData } from './layers/graphicsLayerVertices.ts';
import { CreateGraphicsSkinningShader, UpdateGraphicsSkinningShaderPalette, type GraphicsBonePalette } from './graphicsBonePalette.ts';
import { SkinMeshPositions } from './graphicsSkinning.ts';

/** The same dual-quaternion blend as CharacterPoseTransforms.skinPoint, evaluated per vertex. */
export const SKINNING_BIT_GL: HighShaderBit = {
	name: 'pandora-skinning',
	fragment: { header: '#version 300 es' },
	vertex: {
		header: /* glsl */`
layout(std140) uniform skinningUniforms {
	vec4 uBoneQuat[${2 * MAX_BONE_COUNT}];
};
in uvec4 aBoneIndices;
in vec4 aBoneWeights;
`,
		main: /* glsl */`
vec4 realQuat = vec4(0.);
vec4 dualQuat = vec4(0.);
float remainingWeight = 1.;
for (int si = 0; si < 4; si++) {
	float weight = aBoneWeights[si];
	uint boneIndex = aBoneIndices[si];
	if (boneIndex == 0u || weight == 0.) continue;
	realQuat += weight * uBoneQuat[2u * boneIndex];
	dualQuat += weight * uBoneQuat[2u * boneIndex + 1u];
	remainingWeight -= weight;
}
if (remainingWeight != 0.) {
	realQuat += remainingWeight * uBoneQuat[0];
	dualQuat += remainingWeight * uBoneQuat[1];
}
float inverseLength = 1. / length(realQuat);
vec4 r = realQuat.yzwx * inverseLength;
vec4 d = dualQuat.yzwx * inverseLength;
vec2 translation = 2. * vec2(
	-d.w * r.x + d.x * r.w - d.y * r.z + d.z * r.y,
	-d.w * r.y + d.x * r.z + d.y * r.w - d.z * r.x
);
position = mat2(
	1. - 2. * r.y * r.y - 2. * r.z * r.z, 2. * r.x * r.y + 2. * r.w * r.z,
	2. * r.x * r.y - 2. * r.w * r.z, 1. - 2. * r.x * r.x - 2. * r.z * r.z
) * position + translation;
`,
	},
};

export const SKINNING_BIT: HighShaderBit = {
	name: 'pandora-skinning',
	vertex: {
		header: /* wgsl */`
@in aBoneIndices: vec4<u32>;
@in aBoneWeights: vec4<f32>;
struct SkinningUniforms {
	uBoneQuat: array<vec4<f32>, ${2 * MAX_BONE_COUNT}>,
};
@group(3) @binding(0) var<uniform> skinningUniforms: SkinningUniforms;
`,
		main: /* wgsl */`
var realQuat = vec4<f32>(0.);
var dualQuat = vec4<f32>(0.);
var remainingWeight = 1.;
for (var si = 0u; si < 4u; si++) {
	let weight = aBoneWeights[si];
	let boneIndex = aBoneIndices[si];
	if (boneIndex == 0u || weight == 0.) { continue; }
	realQuat += weight * skinningUniforms.uBoneQuat[2u * boneIndex];
	dualQuat += weight * skinningUniforms.uBoneQuat[2u * boneIndex + 1u];
	remainingWeight -= weight;
}
if (remainingWeight != 0.) {
	realQuat += remainingWeight * skinningUniforms.uBoneQuat[0];
	dualQuat += remainingWeight * skinningUniforms.uBoneQuat[1];
}
let inverseLength = 1. / length(realQuat);
let r = realQuat.yzwx * inverseLength;
let d = dualQuat.yzwx * inverseLength;
let translation = 2. * vec2<f32>(
	-d.w * r.x + d.x * r.w - d.y * r.z + d.z * r.y,
	-d.w * r.y + d.x * r.z + d.y * r.w - d.z * r.x
);
position = mat2x2<f32>(
	1. - 2. * r.y * r.y - 2. * r.z * r.z, 2. * r.x * r.y + 2. * r.w * r.z,
	2. * r.x * r.y - 2. * r.w * r.z, 1. - 2. * r.x * r.x - 2. * r.z * r.z
) * position + translation;
`,
	},
};

let glProgram: ReturnType<typeof compileHighShaderGlProgram> | undefined;
let gpuProgram: ReturnType<typeof compileHighShaderGpuProgram> | undefined;
export function GetSkinnedMeshGlProgram(): ReturnType<typeof compileHighShaderGlProgram> {
	return glProgram ??= compileHighShaderGlProgram({
		name: 'pandora-skinned-mesh', bits: [localUniformBitGl, SKINNING_BIT_GL, textureBitGl, roundPixelsBitGl],
	});
}
export function GetSkinnedMeshGpuProgram(): ReturnType<typeof compileHighShaderGpuProgram> {
	return gpuProgram ??= compileHighShaderGpuProgram({
		name: 'pandora-skinned-mesh', bits: [localUniformBit, SKINNING_BIT, textureBit, roundPixelsBit],
	});
}

function CreateGeometry(data: LayerVerticesTransformData, uvs: Float32Array, indices: Uint32Array): Geometry {
	// eslint-disable-next-line no-bitwise
	const usage = BufferUsage.VERTEX | BufferUsage.COPY_DST;
	return new Geometry({
		attributes: {
			aPosition: { buffer: new Buffer({ data: data.vertices, usage }), format: 'float32x2' },
			aUV: { buffer: new Buffer({ data: uvs, usage }), format: 'float32x2' },
			aBoneIndices: { buffer: new Buffer({ data: data.vertexSkinningBoneIndices, usage }), format: 'uint16x4' },
			aBoneWeights: { buffer: new Buffer({ data: data.vertexSkinningBoneWeights, usage }), format: 'float32x4' },
		},
		indexBuffer: indices,
		topology: 'triangle-list',
	});
}

/** Owns its shader/geometry, retaining static buffers and the texture across pose updates. */
export class GraphicsSkinnedMesh extends Mesh<Geometry, Shader> {
	private _vertices: LayerVerticesTransformData;
	private _uvs: Float32Array;
	private _indices: Uint32Array;
	private _posedPositions: Float32Array | undefined;
	private readonly _posedBounds = new Bounds();
	private _bonePalette: GraphicsBonePalette | undefined;
	private readonly _textureUniforms: UniformGroup<{ uTextureMatrix: { type: 'mat3x3<f32>'; value: Texture['textureMatrix']['mapCoord']; }; }>;

	constructor(vertices: LayerVerticesTransformData, uvs: Float32Array, indices: Uint32Array, texture: Texture, state?: State, bonePalette?: GraphicsBonePalette) {
		const textureUniforms = new UniformGroup({ uTextureMatrix: { type: 'mat3x3<f32>', value: texture.textureMatrix.mapCoord } });
		const shader = CreateGraphicsSkinningShader({
			glProgram: GetSkinnedMeshGlProgram(), gpuProgram: GetSkinnedMeshGpuProgram(),
			resources: { uTexture: texture.source, uSampler: texture.source.style, textureUniforms },
		}, vertices.boneTransforms, bonePalette);
		super({ geometry: CreateGeometry(vertices, uvs, indices), shader, texture, state });
		this._vertices = vertices;
		this._uvs = uvs;
		this._indices = indices;
		this._bonePalette = bonePalette;
		this._textureUniforms = textureUniforms;
	}

	public update(vertices: LayerVerticesTransformData, uvs: Float32Array, indices: Uint32Array, texture: Texture): void {
		const old = this._vertices;
		if (vertices === old && uvs === this._uvs && indices === this._indices && texture === this.texture)
			return;
		if (vertices.vertices !== old.vertices) this.geometry.getBuffer('aPosition').data = vertices.vertices;
		if (vertices.vertexSkinningBoneIndices !== old.vertexSkinningBoneIndices) this.geometry.getBuffer('aBoneIndices').data = vertices.vertexSkinningBoneIndices;
		if (vertices.vertexSkinningBoneWeights !== old.vertexSkinningBoneWeights) this.geometry.getBuffer('aBoneWeights').data = vertices.vertexSkinningBoneWeights;
		if (uvs !== this._uvs) this.geometry.getBuffer('aUV').data = uvs;
		if (indices !== this._indices) this.geometry.indexBuffer.data = indices;
		if (vertices.boneTransforms !== old.boneTransforms) {
			UpdateGraphicsSkinningShaderPalette(this.shader!, vertices.boneTransforms, this._bonePalette);
		}
		if (texture !== this.texture) {
			this.texture = texture;
			this.shader!.resources.uTexture = texture.source;
			this.shader!.resources.uSampler = texture.source.style;
			this._textureUniforms.uniforms.uTextureMatrix = texture.textureMatrix.mapCoord;
			this._textureUniforms.update();
		}
		if (vertices !== old) this._posedPositions = undefined;
		this._vertices = vertices;
		this._uvs = uvs;
		this._indices = indices;
		this.onViewUpdate();
	}

	public setBonePalette(palette: GraphicsBonePalette | undefined): void {
		if (palette === this._bonePalette)
			return;
		UpdateGraphicsSkinningShaderPalette(this.shader!, this._vertices.boneTransforms, palette);
		this._bonePalette = palette;
	}

	public override get bounds(): Bounds {
		this._ensurePosedPositions();
		return this._posedBounds;
	}

	public override updateBounds(): void {
		this._bounds = this.bounds;
	}

	private _ensurePosedPositions(): Float32Array {
		if (this._posedPositions == null) {
			this._posedPositions = SkinMeshPositions(this._vertices);
			this._posedBounds.clear();
			this._posedBounds.addVertexData(this._posedPositions, 0, this._posedPositions.length);
		}
		return this._posedPositions;
	}

	public override containsPoint(point: PointData): boolean {
		if (!this.bounds.containsPoint(point.x, point.y)) return false;
		const positions = this._ensurePosedPositions();
		for (let i = 0; i + 2 < this._indices.length; i += 3) {
			const a = 2 * this._indices[i];
			const b = 2 * this._indices[i + 1];
			const c = 2 * this._indices[i + 2];
			if (pointInTriangle(point.x, point.y, positions[a], positions[a + 1], positions[b], positions[b + 1], positions[c], positions[c + 1])) return true;
		}
		return false;
	}

	public override destroy(options?: DestroyOptions): void {
		const geometry = this.geometry;
		const shader = this.shader;
		super.destroy(options);
		geometry.destroy(true);
		shader?.destroy();
	}
}
