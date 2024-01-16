import React, { ReactElement, useMemo } from 'react';
import { z } from 'zod';
import { BrowserStorage } from '../browserStorage';
import { Select } from '../components/common/select/select';
import { useObservable } from '../observable';

export const GraphicsSettingsScheme = z.object({
	resolution: z.number().int().min(0).max(100),
	alphamaskEngine: z.enum(['pixi', 'customShader', 'disabled']),
});
export type IGraphicsSettings = z.infer<typeof GraphicsSettingsScheme>;

const GRAPHICS_SETTINGS_DEFAULT: IGraphicsSettings = {
	resolution: 100,
	alphamaskEngine: 'customShader',
};

const storage = BrowserStorage.create<Partial<IGraphicsSettings>>('settings.graphics', {}, GraphicsSettingsScheme.partial());

export function useGraphicsSettings(): IGraphicsSettings {
	const overrides = useObservable(storage);
	return useMemo(() => ({
		...GRAPHICS_SETTINGS_DEFAULT,
		...overrides,
	}), [overrides]);
}

export function SetGraphicsSettings(changes: Partial<IGraphicsSettings>): void {
	storage.value = {
		...storage.value,
		...changes,
	};
}

export function GraphicsSettings(): ReactElement | null {
	return (
		<QualitySettings />
	);
}

function QualitySettings(): ReactElement {
	const { resolution, alphamaskEngine } = useGraphicsSettings();

	const ALPHAMASK_ENGINES_DESCRIPTIONS: Record<IGraphicsSettings['alphamaskEngine'], string> = {
		pixi: 'Pixi.js',
		customShader: 'Custom Pandora shader (default)',
		disabled: 'Ignore masks - WILL CAUSE VISUAL GLITCHES',
	};

	return (
		<fieldset>
			<legend>Quality</legend>
			<div className='input-section'>
				<label>Resolution</label>
				<Select value={ Math.round(resolution).toString() } onChange={ (e) => {
					const res = GraphicsSettingsScheme.shape.resolution.safeParse(Number.parseInt(e.target.value, 10));
					SetGraphicsSettings({ resolution: res.success ? res.data : GRAPHICS_SETTINGS_DEFAULT.resolution });
				} }>
					{
						[100, 90, 80, 65, 50, 25, 0].map((v) => <option key={ v } value={ v.toString() }>{ `${v}%` }</option>)
					}
				</Select>
			</div>
			<div className='input-section'>
				<label>Alphamasking engine</label>
				<Select value={ alphamaskEngine } onChange={ (e) => {
					const res = GraphicsSettingsScheme.shape.alphamaskEngine.safeParse(e.target.value);
					SetGraphicsSettings({ alphamaskEngine: res.success ? res.data : GRAPHICS_SETTINGS_DEFAULT.alphamaskEngine });
				} }>
					{
						(Object.keys(ALPHAMASK_ENGINES_DESCRIPTIONS) as IGraphicsSettings['alphamaskEngine'][]).map((v) => <option key={ v } value={ v }>{ ALPHAMASK_ENGINES_DESCRIPTIONS[v] }</option>)
					}
				</Select>
			</div>
		</fieldset>
	);
}
