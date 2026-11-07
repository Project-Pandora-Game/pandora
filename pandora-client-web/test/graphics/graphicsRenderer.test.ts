import type { Application, ApplicationOptions, Renderer } from 'pixi.js';

const jest = import.meta.jest;
const canvasProbe = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
const { Application: PixiApplication, RendererType } = await import('pixi.js');
const { CreateGraphicsApplication, GraphicsRendererStatus } = await import('../../src/graphics/graphicsRenderer.ts');
const { GraphicsSettingsSchema, GraphicsSettingsStorage, GetGraphicsRendererPreference, SetGraphicsSettings, ResetGraphicsSettings } = await import('../../src/graphics/graphicsSettings.tsx');
const originalSettings = GraphicsSettingsStorage.value;

afterEach(() => {
	jest.restoreAllMocks();
	GraphicsRendererStatus.value = null;
	GraphicsSettingsStorage.value = originalSettings;
});
afterAll(() => canvasProbe.mockRestore());

function MockRenderer(type: number): Renderer {
	return { type, destroy: () => undefined } as unknown as Renderer;
}

function SucceedWith(type: number) {
	return function (this: Application, _options?: Partial<ApplicationOptions>): Promise<void> {
		this.renderer = MockRenderer(type);
		return Promise.resolve();
	};
}

describe('graphics renderer initialization', () => {
	it('uses WebGL exclusively when WebGL is requested, preserving the application options', async () => {
		const init = jest.spyOn(PixiApplication.prototype, 'init').mockImplementation(SucceedWith(RendererType.WEBGL));
		const app = await CreateGraphicsApplication({ autoStart: false, multiView: true, antialias: false }, 'webgl');
		expect(init).toHaveBeenCalledWith({ preference: ['webgl'], autoStart: false, multiView: true, antialias: false });
		expect(app.renderer.type).toBe(RendererType.WEBGL);
		expect(GraphicsRendererStatus.value).toEqual({ requested: 'webgl', active: 'webgl', webgpuFallback: false });
	});

	it('requests WebGPU and records the backend that actually initialized', async () => {
		const init = jest.spyOn(PixiApplication.prototype, 'init').mockImplementation(SucceedWith(RendererType.WEBGPU));
		const app = await CreateGraphicsApplication({ autoStart: false }, 'webgpu');
		expect(init).toHaveBeenCalledWith({ preference: ['webgpu', 'webgl'], autoStart: false });
		expect(app.renderer.type).toBe(RendererType.WEBGPU);
		expect(GraphicsRendererStatus.value).toEqual({ requested: 'webgpu', active: 'webgpu', webgpuFallback: false });
	});

	it('reports Pixi capability fallback without presenting WebGPU as active', async () => {
		const init = jest.spyOn(PixiApplication.prototype, 'init').mockImplementation(SucceedWith(RendererType.WEBGL));
		await CreateGraphicsApplication({}, 'webgpu');
		expect(init).toHaveBeenCalledTimes(1);
		expect(GraphicsRendererStatus.value).toEqual({ requested: 'webgpu', active: 'webgl', webgpuFallback: true });
	});

	it('retries WebGL on a fresh application when WebGPU initialization rejects', async () => {
		let failedStage: Application['stage'] | undefined;
		const init = jest.spyOn(PixiApplication.prototype, 'init')
			.mockImplementationOnce(function (this: Application) {
				failedStage = this.stage;
				return Promise.reject(new Error('WebGPU device unavailable'));
			})
			.mockImplementationOnce(SucceedWith(RendererType.WEBGL));
		const app = await CreateGraphicsApplication({ antialias: true }, 'webgpu');
		expect(init).toHaveBeenNthCalledWith(1, { preference: ['webgpu', 'webgl'], antialias: true });
		expect(init).toHaveBeenNthCalledWith(2, { preference: ['webgl'], antialias: true });
		expect(app.stage).not.toBe(failedStage);
		expect(failedStage?.destroyed).toBe(true);
		expect(GraphicsRendererStatus.value?.active).toBe('webgl');
		expect(GraphicsRendererStatus.value?.webgpuFallback).toBe(true);
	});

	it('preserves fallback reporting if another graphics view successfully starts WebGPU', async () => {
		jest.spyOn(PixiApplication.prototype, 'init')
			.mockImplementationOnce(SucceedWith(RendererType.WEBGL))
			.mockImplementationOnce(SucceedWith(RendererType.WEBGPU));
		await CreateGraphicsApplication({}, 'webgpu');
		await CreateGraphicsApplication({}, 'webgpu');
		expect(GraphicsRendererStatus.value).toEqual({ requested: 'webgpu', active: 'webgpu', webgpuFallback: true });
	});

	it('propagates a complete initialization failure to the existing application error handler', async () => {
		const failure = new Error('WebGL is unavailable too');
		jest.spyOn(PixiApplication.prototype, 'init')
			.mockImplementationOnce(() => Promise.reject(new Error('WebGPU failed')))
			.mockImplementationOnce(() => Promise.reject(failure));
		await expect(CreateGraphicsApplication({}, 'webgpu')).rejects.toBe(failure);
		expect(GraphicsRendererStatus.value?.active).toBeNull();
	});
});

describe('saved renderer preference', () => {
	it('accepts legacy partial settings and defaults their missing renderer to WebGL', () => {
		const saved = GraphicsSettingsSchema.partial().parse({ antialias: false, textureResolution: '0.5', effectBlinking: false });
		GraphicsSettingsStorage.value = saved;
		expect(GetGraphicsRendererPreference()).toBe('webgl');
		expect(GraphicsSettingsStorage.value).toEqual({ antialias: false, textureResolution: '0.5', effectBlinking: false });
	});

	it('saves and resets the renderer without losing existing preferences', () => {
		GraphicsSettingsStorage.value = { antialias: false, textureResolution: '0.25' };
		SetGraphicsSettings({ renderer: 'webgpu' });
		expect(GetGraphicsRendererPreference()).toBe('webgpu');
		expect(GraphicsSettingsStorage.value).toEqual({ renderer: 'webgpu', antialias: false, textureResolution: '0.25' });
		ResetGraphicsSettings(['renderer']);
		expect(GetGraphicsRendererPreference()).toBe('webgl');
		expect(GraphicsSettingsStorage.value).toEqual({ antialias: false, textureResolution: '0.25' });
	});
});
