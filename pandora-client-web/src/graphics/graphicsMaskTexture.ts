import {
	Shader, UniformGroup,
	compileHighShaderGlProgram, localUniformBitGl, roundPixelsBitGl, textureBitGl,
	type HighShaderBit, type Texture,
} from 'pixi.js';

/** Keep source alpha as the blend factor, storing accumulated coverage in G. */
export const MASK_PACK_RG8_GL: HighShaderBit = {
	name: 'pandora-mask-pack-rg8',
	fragment: { end: 'finalColor = vec4(finalColor.r, finalColor.a, 0., finalColor.a);' },
};
let glProgram: ReturnType<typeof compileHighShaderGlProgram> | undefined;

/** Uses the ordinary mesh shader unchanged until the final output-channel swizzle. */
export class GraphicsMaskPackingShader extends Shader {
	private readonly _textureUniforms: UniformGroup<{ uTextureMatrix: { type: 'mat3x3<f32>'; value: Texture['textureMatrix']['mapCoord']; }; }>;

	constructor(texture: Texture) {
		const textureUniforms = new UniformGroup({ uTextureMatrix: { type: 'mat3x3<f32>', value: texture.textureMatrix.mapCoord } });
		super({
			glProgram: glProgram ??= compileHighShaderGlProgram({
				name: 'pandora-mask-pack-rg8', bits: [localUniformBitGl, textureBitGl, roundPixelsBitGl, MASK_PACK_RG8_GL],
			}),
			resources: { uTexture: texture.source, uSampler: texture.source.style, textureUniforms },
		});
		this._textureUniforms = textureUniforms;
	}

	public updateTexture(texture: Texture): void {
		this.resources.uTexture = texture.source;
		this.resources.uSampler = texture.source.style;
		this._textureUniforms.uniforms.uTextureMatrix = texture.textureMatrix.mapCoord;
		this._textureUniforms.update();
	}
}
