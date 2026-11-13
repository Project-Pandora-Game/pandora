const jest = import.meta.jest;
const canvasProbe = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
const { GraphicsSettingsStorage } = await import('../../src/graphics/graphicsSettings.tsx');
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
	});

});
