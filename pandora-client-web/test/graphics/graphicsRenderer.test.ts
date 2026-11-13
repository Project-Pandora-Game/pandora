const jest = import.meta.jest;
const canvasProbe = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
const { GraphicsSettingsStorage, SetGraphicsSettings, GetGraphicsAntialias } = await import('../../src/graphics/graphicsSettings.tsx');
const originalSettings = GraphicsSettingsStorage.value;

afterEach(() => {
	jest.restoreAllMocks();
	GraphicsSettingsStorage.value = originalSettings;
});
afterAll(() => canvasProbe.mockRestore());

describe('saved masking preferences', () => {
	it.each(['customShader', 'pixi', 'stencil', 'directShader'])('loads %s as the replacement custom shader without losing preferences', (engine) => {
		GraphicsSettingsStorage.setParse(JSON.stringify({ alphamaskEngine: engine, antialias: true, textureResolution: '0.5' }));
		expect(GraphicsSettingsStorage.value).toEqual({ alphamaskEngine: 'customShader', antialias: true, textureResolution: '0.5' });
		expect(GetGraphicsAntialias()).toBe(true);
	});

	it.each(['customShader', 'disabled'] as const)('honors the antialias preference independently of %s masking', (alphamaskEngine) => {
		GraphicsSettingsStorage.value = { alphamaskEngine };
		expect(GetGraphicsAntialias()).toBe(true);
		SetGraphicsSettings({ antialias: false });
		expect(GetGraphicsAntialias()).toBe(false);
		SetGraphicsSettings({ antialias: true });
		expect(GetGraphicsAntialias()).toBe(true);
	});
});
