import { ZodMatcher } from 'pandora-common';
import React, { ReactElement } from 'react';
import { z } from 'zod';
import { BrowserStorage } from '../browserStorage';
import { Select } from '../components/common/Select/Select';
import { useObservable } from '../observable';

export const GraphicsSettingsScheme = z.object({
	resolution: z.number().int().min(0).max(100),
});
export type IGraphicsSettings = z.infer<typeof GraphicsSettingsScheme>;

const GRAPHICS_SETTINGS_DEFAULT: IGraphicsSettings = {
	resolution: 100,
};

const storage = BrowserStorage.create<IGraphicsSettings>('settings.graphics', GRAPHICS_SETTINGS_DEFAULT, ZodMatcher(GraphicsSettingsScheme));

export function useGraphicsSettings(): IGraphicsSettings {
	return useObservable(storage);
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
	const { resolution } = useGraphicsSettings();

	return (
		<fieldset>
			<legend>Quality</legend>
			<div className='input-row'>
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
		</fieldset>
	);
}
