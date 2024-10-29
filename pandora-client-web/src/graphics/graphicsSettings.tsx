import { CloneDeepMutable } from 'pandora-common';
import React, { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { GraphicsManagerInstance, type IGraphicsLoaderStats } from '../assets/graphicsManager';
import { BrowserStorage } from '../browserStorage';
import { Button } from '../components/common/button/button';
import { Column, Row } from '../components/common/container/container';
import { ContextHelpButton } from '../components/help/contextHelpButton';
import { SelectSettingInput, ToggleSettingInput } from '../components/settings/helpers/settingsInputs';
import { useObservable } from '../observable';
import { useAutomaticResolution } from '../services/screenResolution/screenResolution';

export const GraphicsSettingsSchema = z.object({
	// Effects
	effectBlinking: z.boolean(),
	// Quality
	renderResolution: z.number().int().min(0).max(100),
	textureResolution: z.enum(['auto', '1', '0.5', '0.25']),
	alphamaskEngine: z.enum(['pixi', 'customShader', 'disabled']),
});
export type GraphicsSettings = z.infer<typeof GraphicsSettingsSchema>;

const GRAPHICS_SETTINGS_DEFAULT: GraphicsSettings = {
	// Effects
	effectBlinking: false,
	// Quality
	renderResolution: 100,
	textureResolution: 'auto',
	alphamaskEngine: 'disabled',
};

const storage = BrowserStorage.create<Partial<GraphicsSettings>>('settings.graphics', {}, GraphicsSettingsSchema.partial());
// Add a hook to purge the current graphics loader cache when the graphics settins change in any way
// (most of the changes cause different textures to be loaded, so get rid of old ones)
storage.subscribe(() => {
	// Do the cleanup asynchronously so things have time to unload if they were loaded
	setTimeout(() => {
		GraphicsManagerInstance.value?.loader.gc();
	}, 500);
});

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
			<EffectsSettings />
			<QualitySettings />
			<GraphicsDebug />
		</>
	);
}

function EffectsSettings(): ReactElement {
	const { effectBlinking } = useObservable(storage);

	return (
		<fieldset>
			<legend>Effects</legend>
			<ToggleSettingInput
				currentValue={ effectBlinking }
				defaultValue={ GRAPHICS_SETTINGS_DEFAULT.effectBlinking }
				label='Character blinking'
				onChange={ (newValue) => {
					SetGraphicsSettings({ effectBlinking: newValue });
				} }
				onReset={ () => ResetGraphicsSettings(['effectBlinking']) }
			/>
		</fieldset>
	);
}

export const GRAPHICS_TEXTURE_RESOLUTION_SCALE: Record<Exclude<GraphicsSettings['textureResolution'], 'auto'>, number> = {
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

	const automaticTextureResolution = useAutomaticResolution();

	const GRAPHICS_TEXTURE_RESOLUTION_DESCRIPTIONS = useMemo((): Record<GraphicsSettings['textureResolution'], string | (() => string)> => ({
		'auto': () => `Automatic (currently: ${ String(GRAPHICS_TEXTURE_RESOLUTION_DESCRIPTIONS[automaticTextureResolution]) })`,
		'1': 'Full',
		'0.5': '50%',
		'0.25': '25%',
	}), [automaticTextureResolution]);

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
				optionOrder={ [100, 90, 80, 65, 50, 25, 0].map(String) }
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
				optionOrder={ ['auto', '1', '0.5', '0.25'] }
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
