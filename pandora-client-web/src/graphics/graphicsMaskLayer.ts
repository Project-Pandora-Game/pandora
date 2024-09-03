import { Rectangle } from 'pandora-common';
import {
	Application,
	Filter,
	type FilterSystem,
	GlProgram,
	Matrix,
	Mesh,
	type MeshGeometry,
	type RenderSurface,
	RenderTexture,
	Sprite,
	Texture,
	TextureMatrix,
	UniformGroup,
} from 'pixi.js';

const FILTER_CONDITION = 'masky.a > 0.5 && masky.r < 0.5';

export class GraphicsMaskLayer {
	private readonly _pixiApp: Application;
	private readonly _renderTexture: RenderTexture;
	private _texture: Texture = Texture.EMPTY;
	private _result?: Mesh | Sprite;
	private _geometry?: MeshGeometry;

	public readonly maskSize: Readonly<Rectangle>;

	public readonly sprite: Sprite;
	public readonly filter: Filter;

	constructor(pixiApp: Application, maskSprite: Sprite, maskSize: Readonly<Rectangle>) {
		this.maskSize = maskSize;
		this._pixiApp = pixiApp;
		this._renderTexture = RenderTexture.create({ width: maskSize.width, height: maskSize.height });
		this.sprite = maskSprite;
		this.sprite.texture = this._renderTexture;
		this.filter = new AlphaMaskFilter(this.sprite);
	}

	private _render() {
		if (!this._result) {
			return;
		}
		this._result.texture = this._texture;
		this._pixiApp.renderer.render({
			container: this._result,
			target: this._renderTexture,
		});
	}

	public destroy() {
		this.filter.destroy();
		this.sprite.texture = Texture.WHITE;
		this._renderTexture.destroy(true);
		this._result?.destroy();
		this._result = undefined;
		this._texture = Texture.EMPTY;
	}

	public updateContent(texture: Texture): void {
		if (this._texture === texture) return;
		this._texture = texture;
		this._render();
	}

	public updateGeometry(geometry?: MeshGeometry) {
		if (this._geometry === geometry) {
			this._render();
			return;
		}
		this._geometry = geometry;
		this._result?.destroy({
			texture: false,
		});
		if (this._geometry) {
			this._result = new Mesh({
				geometry: this._geometry,
				texture: this._texture,
			});
		} else {
			this._result = new Sprite(this._texture);
		}
		this._result.position.set(this.maskSize.x, this.maskSize.y);
		this._render();
	}
}

const VERTEXT_SHADER_SOURCE = `
in vec2 aPosition;

out vec2 vTextureCoord;
out vec2 vMaskCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
uniform mat3 uFilterMatrix;

vec4 filterVertexPosition(  vec2 aPosition )
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;

    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;

    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(  vec2 aPosition )
{
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

vec2 getFilterCoord( vec2 aPosition )
{
    return  ( uFilterMatrix * vec3( filterTextureCoord(aPosition), 1.0)  ).xy;
}

void main(void)
{
    gl_Position = filterVertexPosition(aPosition);
    vTextureCoord = filterTextureCoord(aPosition);
    vMaskCoord = getFilterCoord(aPosition);
}

`;

const FRAGMENT_SHADER_SOURCE = `
varying vec2 vMaskCoord;
varying vec2 vTextureCoord;

uniform sampler2D uTexture;
uniform sampler2D uMaskTexture;

void main(void)
{
	vec4 original = texture2D(uTexture, vTextureCoord);
	vec4 masky = texture2D(uMaskTexture, vMaskCoord);
	if (${FILTER_CONDITION}) {
		discard;
	} else {
		gl_FragColor = original;
	}
}
`;

class AlphaMaskFilter extends Filter {
	private readonly _maskSprite: Sprite;
	private readonly _textureMatrix: TextureMatrix;
	private readonly _filterUniforms: UniformGroup<{
		uFilterMatrix: {
			value: Matrix;
			type: 'mat3x3<f32>';
		};
		uMaskClamp: {
			value: Float32Array;
			type: 'vec4<f32>';
		};
		uAlpha: {
			value: number;
			type: 'f32';
		};
	}>;

	constructor(mask: Sprite) {
		const textureMatrix = new TextureMatrix(mask.texture);

		const filterUniforms = new UniformGroup({
			uFilterMatrix: { value: new Matrix(), type: 'mat3x3<f32>' },
			uMaskClamp: { value: textureMatrix.uClampFrame, type: 'vec4<f32>' },
			uAlpha: { value: 1, type: 'f32' },
		});

		const glProgram = GlProgram.from({
			vertex: VERTEXT_SHADER_SOURCE,
			fragment: FRAGMENT_SHADER_SOURCE,
			name: 'mask-filter',
		});

		super({
			glProgram,
			resources: {
				filterUniforms,
				uMaskTexture: mask.texture.source,
			},
		});

		this._maskSprite = mask;
		this._maskSprite.renderable = false;
		this._textureMatrix = textureMatrix;
		this._filterUniforms = filterUniforms;
	}

	public override apply(filterManager: FilterSystem, input: Texture, output: RenderSurface, clearMode: boolean): void {
		// will trigger an update if the texture changed..
		this._textureMatrix.texture = this._maskSprite.texture;

		filterManager.calculateSpriteMatrix(
			this._filterUniforms.uniforms.uFilterMatrix,
			this._maskSprite,
		).prepend(this._textureMatrix.mapCoord);

		this.resources.uMaskTexture = this._maskSprite.texture.source;

		filterManager.applyFilter(this, input, output, clearMode);
	}
}
