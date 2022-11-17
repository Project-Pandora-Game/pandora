import { CharacterSize } from 'pandora-common';
import { type AbstractRenderer, RenderTexture, Sprite, Geometry, Mesh, MeshMaterial, Texture, Graphics, Filter, type IMaskTarget, type FilterSystem, type CLEAR_MODES, type ISpriteMaskTarget, Matrix, TextureMatrix } from 'pixi.js';

const FILTER_CONDITION = 'masky.a > 0.5 && masky.r < 0.5';
const POLYGON_COLOR = 0xFF0000;
const POLYGON_ALPHA = 1.0;

export class GraphicsMaskLayer {
	private readonly _renderer: AbstractRenderer;
	private readonly _getTexture: (image: string) => Promise<Texture>;
	private readonly _renderTexture: RenderTexture;
	private _textureParent?: Sprite | MeshMaterial;
	private _texture: Texture = Texture.EMPTY;
	private _result?: Mesh | Sprite;
	private _geometry?: Geometry;
	private _lastContent?: string | [number, number][][];

	public readonly maskWidth: number;
	public readonly maskHeight: number;
	public readonly maskOverscan: number;

	public readonly sprite: Sprite;
	public readonly filter: Filter;

	constructor(renderer: AbstractRenderer, maskSprite: Sprite, getTexture: (image: string) => Promise<Texture>, width: number, height: number, overscan: number) {
		this.maskWidth = width;
		this.maskHeight = height;
		this.maskOverscan = overscan;
		this._renderer = renderer;
		this._getTexture = getTexture;
		this._renderTexture = RenderTexture.create({ width, height });
		this.sprite = maskSprite;
		this.sprite.texture = this._renderTexture;
		this.filter = new AlphaMaskFilter(this.sprite);
	}

	public render() {
		if (this._texture === Texture.EMPTY || !this._textureParent || !this._result) {
			return;
		}
		this._textureParent.texture = this._texture;
		this._renderer.render(this._result, { renderTexture: this._renderTexture });
	}

	public destroy() {
		this.filter.destroy();
		this.sprite.texture = Texture.WHITE;
		this._renderTexture.destroy(true);
		this._result?.destroy();
		this._result = undefined;
		if (this._texture instanceof RenderTexture) {
			this._texture.destroy();
		}
		this._texture = Texture.EMPTY;
	}

	public updateContent(content: string | [number, number][][]): void {
		if (this._lastContent === content) return;
		this._lastContent = content;
		if (typeof content === 'string') {
			this._getTexture(content).then((texture) => {
				if (this._texture === texture) return;
				if (this._lastContent !== content) return;
				if (this._texture instanceof RenderTexture) {
					this._texture.destroy(true);
				}
				this._texture = texture;
				this.render();
			}).catch(() => {
				this._texture = Texture.EMPTY;
				this.render();
			});
		} else {
			const g = new Graphics();
			g.width = CharacterSize.WIDTH;
			g.height = CharacterSize.HEIGHT;
			for (const polygonPoints of content) {
				g.beginFill(POLYGON_COLOR, POLYGON_ALPHA);
				g.drawPolygon(polygonPoints.flat());
				g.endFill();
			}
			let renderTexture: RenderTexture | undefined;
			let clear = false;
			if (this._texture instanceof RenderTexture) {
				renderTexture = this._texture;
			} else {
				this._texture.destroy();
				this._texture = renderTexture = RenderTexture.create({ width: CharacterSize.WIDTH, height: CharacterSize.HEIGHT });
				clear = true;
			}
			this._renderer.render(g, { renderTexture, clear });
			this.render();
		}
	}

	public updateGeometry(geometry?: Geometry) {
		if (this._geometry === geometry) {
			this.render();
			return;
		}
		this._geometry = geometry;
		this._result?.destroy();
		if (this._geometry) {
			this._result = new Mesh(this._geometry, this._textureParent = new MeshMaterial(this._texture));
		} else {
			this._result = this._textureParent = new Sprite(this._texture);
		}
		this._result.position.set(this.maskOverscan, this.maskOverscan);
		this.render();
	}
}

const VERTEXT_SHADER_SOURCE = `
attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;

uniform mat3 projectionMatrix;
uniform mat3 otherMatrix;

varying vec2 vMaskCoord;
varying vec2 vTextureCoord;

void main(void)
{
	gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);

	vTextureCoord = aTextureCoord;
	vMaskCoord = ( otherMatrix * vec3( aTextureCoord, 1.0)  ).xy;
}
`;

const FRAGMENT_SHADER_SOURCE = `
varying vec2 vMaskCoord;
varying vec2 vTextureCoord;

uniform sampler2D uSampler;
uniform sampler2D mask;

void main(void)
{
	vec4 original = texture2D(uSampler, vTextureCoord);
	vec4 masky = texture2D(mask, vMaskCoord);
	if (${FILTER_CONDITION}) {
		discard;
	} else {
		gl_FragColor = original;
	}
}
`;

class AlphaMaskFilter extends Filter {
	private readonly _maskSprite: IMaskTarget;
	private readonly _maskMatrix = new Matrix();

	constructor(mask: IMaskTarget) {
		super(VERTEXT_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE);
		this._maskSprite = mask;
		this._maskSprite.renderable = false;
	}

	public override apply(filterManager: FilterSystem, input: RenderTexture, output: RenderTexture, clearMode: CLEAR_MODES) {
		const maskSprite = this._maskSprite as ISpriteMaskTarget;
		const tex = maskSprite._texture;

		if (!tex.valid) {
			return;
		}
		if (!tex.uvMatrix) {
			// margin = 0.0, let it bleed a bit, shader code becomes easier
			// assuming that atlas textures were made with 1-pixel padding
			tex.uvMatrix = new TextureMatrix(tex, 0.0);
		}
		tex.uvMatrix.update();

		this.uniforms.mask = tex;
		// get _normalized sprite texture coords_ and convert them to _normalized atlas texture coords_ with `prepend`
		this.uniforms.otherMatrix = filterManager.calculateSpriteMatrix(this._maskMatrix, maskSprite)
			.prepend(tex.uvMatrix.mapCoord);

		filterManager.applyFilter(this, input, output, clearMode);
	}
}
