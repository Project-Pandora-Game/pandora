import { CharacterSize } from 'pandora-common';
import { type AbstractRenderer, RenderTexture, Sprite, Geometry, Mesh, MeshMaterial, Texture, Graphics, Filter, type IMaskTarget, type FilterSystem, type CLEAR_MODES, type ISpriteMaskTarget, Matrix, TextureMatrix, Container } from 'pixi.js';
import { GraphicsManagerInstance } from '../assets/graphicsManager';

const FILTER_CONDITION = 'a > 0.0';
const POLYGON_COLOR = 0xFF0000;
const POLYGON_ALPHA = 1.0;

export class GraphicsMaskLayer {
	private readonly _renderer: AbstractRenderer;
	private readonly _renderTexture = RenderTexture.create({ width: CharacterSize.WIDTH, height: CharacterSize.HEIGHT });
	private _textureParent?: Sprite | MeshMaterial;
	private _texture: Texture = Texture.EMPTY;
	private _result?: Mesh | Sprite;
	private _geometry?: Geometry;
	private _lastContent?: string | [number, number][][];

	public readonly sprite = new Sprite(this._renderTexture);
	public readonly filter: Filter = new AlphaMaskFilter(this.sprite);

	constructor(renderer: AbstractRenderer) {
		this._renderer = renderer;
	}

	render() {
		if (this._texture === Texture.EMPTY || !this._textureParent || !this._result) {
			return;
		}
		this._textureParent.texture = this._texture;
		this._renderer.render(this._result, { renderTexture: this._renderTexture });
	}

	destroy() {
		this.filter.destroy();
		this._renderTexture.destroy();
		this.sprite.destroy();
		this._result?.destroy();
		if (this._texture instanceof RenderTexture) {
			this._texture.destroy();
		}
	}

	updateContent(content: string | [number, number][][]): void {
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

	updateGeometry(geometry?: Geometry) {
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
		this.render();
	}

	private _getTexture(image: string): Promise<Texture> {
		const manager = GraphicsManagerInstance.value;
		if (!manager)
			return Promise.reject();
		return manager.loader.getTexture(image);
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
	if (masky.${FILTER_CONDITION}) {
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

	override apply(filterManager: FilterSystem, input: RenderTexture, output: RenderTexture, clearMode: CLEAR_MODES) {
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
