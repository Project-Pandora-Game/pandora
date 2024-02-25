import { CloneDeepMutable } from 'pandora-common';
import React, { ReactElement, useMemo } from 'react';
import { z } from 'zod';
import { BrowserStorage } from '../browserStorage';
import { SelectSettingInput } from '../components/settings/helpers/settingsInputs';
import { useObservable } from '../observable';

export const GraphicsSettingsSchema = z.object({
	resolution: z.number().int().min(0).max(100),
	alphamaskEngine: z.enum(['pixi', 'customShader', 'disabled']),
});
export type GraphicsSettings = z.infer<typeof GraphicsSettingsSchema>;

const GRAPHICS_SETTINGS_DEFAULT: GraphicsSettings = {
	resolution: 100,
	alphamaskEngine: 'customShader',
};

const storage = BrowserStorage.create<Partial<GraphicsSettings>>('settings.graphics', {}, GraphicsSettingsSchema.partial());

export function useGraphicsSettings(): GraphicsSettings {
	const overrides = useObservable(storage);
	return useMemo(() => ({
		...GRAPHICS_SETTINGS_DEFAULT,
		...overrides,
	}), [overrides]);
}

function SetGraphicsSettings(changes: Partial<GraphicsSettings>): void {
	storage.value = {
		...storage.value,
		...changes,
	};
}

function ResetGraphicsSettings(settings: readonly (keyof GraphicsSettings)[]): void {
	storage.produce((v) => {
		const newValue = CloneDeepMutable(v);
		for (const s of settings) {
			delete newValue[s];
		}
		return newValue;
	});
}

export function GraphicsSettings(): ReactElement | null {
	return (
		<QualitySettings />
	);
}

function QualitySettings(): ReactElement {
	const { resolution, alphamaskEngine } = useObservable(storage);

	const ALPHAMASK_ENGINES_DESCRIPTIONS: Record<GraphicsSettings['alphamaskEngine'], string> = {
		pixi: 'Pixi.js',
		customShader: 'Custom Pandora shader (default)',
		disabled: 'Ignore masks - WILL CAUSE VISUAL GLITCHES',
	};

	return (
		<fieldset>
			<legend>Quality</legend>
			<SelectSettingInput<string>
				currentValue={ resolution?.toString() }
				defaultValue={ GRAPHICS_SETTINGS_DEFAULT.resolution.toString() }
				label='Resolution'
				stringify={
					Object.fromEntries(
						([100, 90, 80, 65, 50, 25, 0])
							.map((v) => [v.toString(), `${v}%`]),
					)
				}
				schema={ z.string() }
				onChange={ (v) => {
					const newValue = GraphicsSettingsSchema.shape.resolution.parse(Number.parseInt(v, 10));
					SetGraphicsSettings({ resolution: newValue });
				} }
				onReset={ () => ResetGraphicsSettings(['resolution']) }
			/>
			<SelectSettingInput<GraphicsSettings['alphamaskEngine']>
				currentValue={ alphamaskEngine }
				defaultValue={ GRAPHICS_SETTINGS_DEFAULT.alphamaskEngine }
				label='Alphamasking engine'
				stringify={ ALPHAMASK_ENGINES_DESCRIPTIONS }
				schema={ GraphicsSettingsSchema.shape.alphamaskEngine }
				onChange={ (v) => SetGraphicsSettings({ alphamaskEngine: v }) }
				onReset={ () => ResetGraphicsSettings(['alphamaskEngine']) }
			/>
		</fieldset>
	);
}
