import { MAX_BONE_COUNT } from 'pandora-common';
import type { Application, Mesh as PixiMesh, Shader as PixiShader, WebGLRenderer } from 'pixi.js';

const jest = import.meta.jest;
const canvasProbe = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
const P = await import('pixi.js');
const { GraphicsDirectMask } = await import('../../src/graphics/graphicsDirectMask.ts');
const { GraphicsBonePalette } = await import('../../src/graphics/graphicsBonePalette.ts');
const { CreateOrUpdateNormalMeshShader } = await import('../../src/graphics/layers/graphicsLayerMeshNormalsShader.ts');
const { GraphicsRasterStencilMask } = await import('../../src/graphics/graphicsStencilMask.ts');
afterAll(() => canvasProbe.mockRestore());

function Fixture() {
	let drawScene = () => undefined;
	const captured: PixiShader[] = [];
	const nativeDraw = (drawable: PixiMesh) => {
		if (drawable.shader) captured.push(drawable.shader);
	};
	const nativeRender = () => drawScene();
	const renderer = {
		gl: {},
		render: nativeRender,
		renderPipes: { mesh: { execute: nativeDraw } },
		runners: { prerender: { add: jest.fn(), remove: jest.fn() } },
		renderTarget: { viewport: new P.Rectangle(0, 0, 1500, 1500), renderTarget: { isRoot: true, pixelHeight: 1500 } },
		globalUniforms: { globalUniformData: { projectionMatrix: new P.Matrix(), worldTransformMatrix: new P.Matrix(), offset: new P.Point() } },
	} as unknown as WebGLRenderer;
	const geometry = new P.MeshGeometry({ positions: new Float32Array([0, 0, 10, 0, 0, 10]), uvs: new Float32Array([0, 0, 1, 0, 0, 1]), indices: new Uint32Array([0, 1, 2]) });
	geometry.batchMode = 'no-batch';
	const app: Application = new P.Application();
	app.renderer = renderer;
	const raster = new GraphicsRasterStencilMask(app, P.Texture.WHITE, geometry);
	const effect = new GraphicsDirectMask(renderer, raster);
	const root = new P.Container();
	root.addChild(effect.anchor);
	const mesh = new P.Mesh({ geometry, texture: P.Texture.WHITE });
	root.addChild(mesh);
	return {
		renderer, nativeDraw, nativeRender, captured, raster, effect, root, mesh, geometry, setDraw(callback: () => undefined) {
			drawScene = callback;
		},
	};
}

describe('direct mask resource and render scope ownership', () => {
	it('removes interception and owned shader resources when the last mask leaves a surviving mesh', () => {
		const f = Fixture();
		const listeners = f.mesh.listenerCount('destroyed');
		try {
			f.effect.state.active.push(f.effect);
			f.renderer.renderPipes.mesh.execute(f.mesh);
			expect(f.mesh.shader).toBeNull();
			expect(f.captured).toHaveLength(1);
			const fused = f.captured[0];
			const uniforms = fused.resources.directMaskUniforms as InstanceType<typeof P.UniformGroup>;
			// Give the owned uniform group a real buffer so deterministic teardown
			// is checked without asking a GPU renderer to allocate it.
			uniforms.buffer = new P.Buffer({ data: new Float32Array(12), usage: P.BufferUsage.UNIFORM });
			const buffer = uniforms.buffer;
			expect(f.mesh.listenerCount('destroyed')).toBe(listeners + 1);
			f.effect.destroy();
			// eslint-disable-next-line @typescript-eslint/unbound-method -- Verify restoration by function identity.
			expect(f.renderer.renderPipes.mesh.execute).toBe(f.nativeDraw);
			// eslint-disable-next-line @typescript-eslint/no-deprecated, @typescript-eslint/unbound-method -- Verify restoration by function identity.
			expect(f.renderer.render).toBe(f.nativeRender);
			expect(f.mesh.listenerCount('destroyed')).toBe(listeners);
			expect(fused.gpuProgram).toBeNull();
			expect(buffer.destroyed).toBe(true);
			expect(P.Texture.WHITE.source.destroyed).toBe(false);
		} finally {
			f.raster.destroy();
			f.root.destroy({ children: true });
			f.geometry.destroy();
		}
	});

	it.each([true, false])('maps physical fragment pixels through offset viewports (WebGL=%s)', (gl) => {
		const f = Fixture();
		if (!gl) Reflect.deleteProperty(f.renderer, 'gl');
		f.renderer.renderTarget.viewport.set(10, 20, 100, 200);
		try {
			f.effect.state.active.push(f.effect);
			f.renderer.renderPipes.mesh.execute(f.mesh);
			const uniforms = f.captured[0].resources.directMaskUniforms as InstanceType<typeof P.UniformGroup>;
			const transform = uniforms.uniforms.uDirectMaskMatrix0 as InstanceType<typeof P.Matrix>;
			const viewportY = gl ? 1500 - 200 - 20 : 20;
			const center = transform.apply(new P.Point(60, viewportY + 100));
			expect(center.x).toBeCloseTo(250 / 1500, 10);
			expect(center.y).toBeCloseTo(0, 10);
			const corner = transform.apply(new P.Point(10, viewportY));
			expect(corner.x).toBeCloseTo(249 / 1500, 10);
			expect(corner.y).toBeCloseTo((gl ? -1 : 1) / 1500, 10);
		} finally {
			f.effect.destroy();
			f.raster.destroy();
			f.root.destroy({ children: true });
			f.geometry.destroy();
		}
	});

	it('borrows normal material and palette bindings without releasing their ownership', () => {
		const f = Fixture();
		const palette = new GraphicsBonePalette();
		const bones = new Float32Array(8 * MAX_BONE_COUNT);
		bones[0] = 1;
		const material = CreateOrUpdateNormalMeshShader(undefined, {
			texture: P.Texture.WHITE, normalMapTexture: P.Texture.WHITE,
			normalMapData: { roughness: 0.5, specularStrength: 0.25 }, color: 0xffffff,
			boneTransforms: bones, bonePalette: palette,
		});
		f.mesh.shader = Object.assign(material, { texture: P.Texture.WHITE });
		const paletteGroup = material.resources.skinningUniforms as InstanceType<typeof P.UniformGroup>;
		const paletteBuffer = paletteGroup.buffer!;
		const textureGroup = material.resources.textureUniforms as InstanceType<typeof P.UniformGroup>;
		textureGroup.buffer = new P.Buffer({ data: new Float32Array(16), usage: P.BufferUsage.UNIFORM });
		const textureBuffer = textureGroup.buffer;
		try {
			f.effect.state.active.push(f.effect);
			f.renderer.renderPipes.mesh.execute(f.mesh);
			expect(f.mesh.shader).toBe(material);
			expect(f.captured[0].resources.skinningUniforms).toBe(paletteGroup);
			expect(f.captured[0].resources.textureUniforms).toBe(textureGroup);
			f.effect.destroy();
			expect(material.gpuProgram).toBeDefined();
			expect(palette.referenceCount).toBe(1);
			expect(paletteBuffer.destroyed).toBe(false);
			expect(textureBuffer.destroyed).toBe(false);
		} finally {
			material.destroy();
			textureBuffer.destroy();
			f.raster.destroy();
			f.root.destroy({ children: true });
			f.geometry.destroy();
		}
		expect(palette.referenceCount).toBe(0);
		expect(paletteBuffer.destroyed).toBe(true);
	});

	it('restores the enclosing mask stack after independent nested renders and errors', () => {
		const f = Fixture();
		try {
			f.effect.state.active.push(f.effect);
			f.setDraw(() => {
				expect(f.effect.state.active).toHaveLength(0);
				f.effect.state.active.push(f.effect);
				throw new Error('draw failed');
			});
			expect(() => f.renderer.render({ container: f.root })).toThrow('draw failed');
			expect(f.effect.state.active).toEqual([f.effect]);
			f.effect.state.active.length = 0;
			f.setDraw(() => {
				f.effect.state.active.push(f.effect);
				throw new Error('outer failed');
			});
			expect(() => f.renderer.render({ container: f.root })).toThrow('outer failed');
			expect(f.effect.state.active).toHaveLength(0);
		} finally {
			f.effect.destroy();
			f.raster.destroy();
			f.root.destroy({ children: true });
			f.geometry.destroy();
		}
	});
});
