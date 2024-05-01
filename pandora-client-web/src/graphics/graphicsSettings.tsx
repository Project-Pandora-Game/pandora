import { CloneDeepMutable } from 'pandora-common';
import React, { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { BrowserStorage } from '../browserStorage';
import { ContextHelpButton } from '../components/help/contextHelpButton';
import { SelectSettingInput } from '../components/settings/helpers/settingsInputs';
import { useObservable } from '../observable';
import { GraphicsManagerInstance, type IGraphicsLoaderStats } from '../assets/graphicsManager';
import { Button } from '../components/common/button/button';
import { Column, Row } from '../components/common/container/container';

export const GraphicsSettingsSchema = z.object({
	renderResolution: z.number().int().min(0).max(100),
	textureResolution: z.enum(['1', '0.5', '0.25']),
	alphamaskEngine: z.enum(['pixi', 'customShader', 'disabled']),
});
export type GraphicsSettings = z.infer<typeof GraphicsSettingsSchema>;

const GRAPHICS_SETTINGS_DEFAULT: GraphicsSettings = {
	renderResolution: 100,
	textureResolution: '1',
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
<>
		<QualitySettings />
<GraphicsDebug />
		</>
	);
}

const GRAPHICS_TEXTURE_RESOLUTION_DESCRIPTIONS: Record<GraphicsSettings['textureResolution'], string> = {
	'1': 'Full',
	'0.5': '50%',
	'0.25': '25%',
};

export const GRAPHICS_TEXTURE_RESOLUTION_SCALE: Record<GraphicsSettings['textureResolution'], number> = {
	'1': 1,
	'0.5': 2,
	'0.25': 4,
};

function QualitySettings(): ReactElement {
	const { renderResolution, textureResolution, alphamaskEngine } = useObservable(storage);

	const ALPHAMASK_ENGINES_DESCRIPTIONS: Record<GraphicsSettings['alphamaskEngine'], string> = {
		pixi: 'Pixi.js',
		customShader: 'Custom Pandora shader (recommended for less clipping)',
		disabled: 'Ignore masks (recommended for avoiding lag)',
	};

	return (
		<fieldset>
			<legend>Quality</legend>
			<SelectSettingInput<string>
				currentValue={ renderResolution?.toString() }
				defaultValue={ GRAPHICS_SETTINGS_DEFAULT.renderResolution.toString() }
				label='Render resolution'
				stringify={
					Object.fromEntries(
						([100, 90, 80, 65, 50, 25, 0])
							.map((v) => [v.toString(), `${v}%`]),
					)
				}
				schema={ z.string() }
				onChange={ (v) => {
					const newValue = GraphicsSettingsSchema.shape.renderResolution.parse(Number.parseInt(v, 10));
					SetGraphicsSettings({ renderResolution: newValue });
				} }
				onReset={ () => ResetGraphicsSettings(['renderResolution']) }
			/>
			<SelectSettingInput<GraphicsSettings['textureResolution']>
				currentValue={ textureResolution }
				defaultValue={ GRAPHICS_SETTINGS_DEFAULT.textureResolution }
				label='Texture resolution'
				stringify={ GRAPHICS_TEXTURE_RESOLUTION_DESCRIPTIONS }
				schema={ GraphicsSettingsSchema.shape.textureResolution }
				onChange={ (v) => SetGraphicsSettings({ textureResolution: v }) }
				onReset={ () => ResetGraphicsSettings(['textureResolution']) }
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

function GraphicsDebug(): ReactElement {
	const graphicsManger = useObservable(GraphicsManagerInstance);

	const [stats, setStats] = useState<IGraphicsLoaderStats>(() => ({
		inUseTextures: 0,
		loadedTextures: 0,
		trackedTextures: 0,
	}));

	const refreshStats = useCallback(() => {
		if (graphicsManger == null)
			return;

		setStats(graphicsManger.loader.getDebugStats());
	}, [graphicsManger]);

	useEffect(() => {
		if (graphicsManger == null)
			return;

		refreshStats();

		return graphicsManger.loader.on('storeChaged', () => {
			refreshStats();
		});
	}, [graphicsManger, refreshStats]);

	if (graphicsManger == null) {
		return (
			<fieldset>
				<legend>Graphics manager debug</legend>
				Graphics manager is not loaded
			</fieldset>
		);
	}

	return (
		<fieldset>
			<legend>Graphics manager debug</legend>
			<Column>
				<Row>
					<Button onClick={ refreshStats } slim>Refresh</Button>
				</Row>
				<span>Tracked textures: { stats.trackedTextures }</span>
				<span>Loaded textures: { stats.loadedTextures }</span>
				<span>Used textures: { stats.inUseTextures }</span>
				<hr className='fill-x' />
				<Row>
					<Button onClick={ () => {
						graphicsManger.loader.gc();
						refreshStats();
					} } slim>
						Purge unused textures
					</Button>
				</Row>
			</Column>
		</fieldset>
	);
}
