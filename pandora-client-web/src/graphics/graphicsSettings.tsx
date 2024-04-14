import { CloneDeepMutable } from 'pandora-common';
import React, { ReactElement, useMemo } from 'react';
import { z } from 'zod';
import { BrowserStorage } from '../browserStorage';
import { SelectSettingInput } from '../components/settings/helpers/settingsInputs';
import { useObservable } from '../observable';
import { ContextHelpButton } from '../components/help/contextHelpButton';

export const GraphicsSettingsSchema = z.object({
	resolution: z.number().int().min(0).max(100),
	alphamaskEngine: z.enum(['pixi', 'customShader', 'disabled']),
});
export type GraphicsSettings = z.infer<typeof GraphicsSettingsSchema>;

const GRAPHICS_SETTINGS_DEFAULT: GraphicsSettings = {
	resolution: 100,
	alphamaskEngine: 'disabled',
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
		customShader: 'Custom Pandora shader (recommended for less clipping)',
		disabled: 'Ignore masks (recommended for avoiding lag)',
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
				label={
					<>
						Alphamasking engine
						<ContextHelpButton>
							<p>
								Alphamasks allow assets to hide parts of other assets beneath them, so they do not clip through.<br />
								Common examples of this are various shoes hiding feet/socks and pants hiding normally wide end of tops.<br />
								While not using an alphamasking engine will cause clipping with assets, <br />
								we decided to disable it by default, as many people are encountering performance issues due to it.
							</p>

							<p>
								We have a planned rework that should allow alphamasks to work again without the performance impact, <br />
								but it will take some time until this is implemented and adopted by assets.
							</p>

							<p>
								If you do have a powerful computer, you can attempt to re-enable this option. <br />
								In that case we recommend using the "Custom Pandora shader" option.
							</p>
						</ContextHelpButton>
						<br />
						<strong>The current implementation is known to cause lag on most devices</strong>
					</>
				}
				stringify={ ALPHAMASK_ENGINES_DESCRIPTIONS }
				schema={ GraphicsSettingsSchema.shape.alphamaskEngine }
				onChange={ (v) => SetGraphicsSettings({ alphamaskEngine: v }) }
				onReset={ () => ResetGraphicsSettings(['alphamaskEngine']) }
			/>
		</fieldset>
	);
}
