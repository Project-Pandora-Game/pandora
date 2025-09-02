import { FormatBytes } from 'pandora-common';
import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import * as z from 'zod';
import { GraphicsManagerInstance, type IGraphicsLoaderStats } from '../../assets/graphicsManager.ts';
import { GraphicsSettingsSchema, useGraphicsSettingDriver, useGraphicsSettings, useGraphicsSmoothMovementAutoEnabledExplain, type GraphicsSettings } from '../../graphics/graphicsSettings.tsx';
import { useObservable } from '../../observable.ts';
import { useAutomaticResolution } from '../../services/screenResolution/screenResolutionHooks.ts';
import { Button } from '../common/button/button.tsx';
import { Column, Row } from '../common/container/container.tsx';
import { ContextHelpButton } from '../help/contextHelpButton.tsx';
import { SelectSettingInput, ToggleSettingInput } from './helpers/settingsInputs.tsx';

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
	const smoothMovementAutoValue = useGraphicsSmoothMovementAutoEnabledExplain();

	const SMOOTH_MOVEMENT_DESCRIPTIONS = useMemo((): Record<GraphicsSettings['smoothMovement'], string | (() => string)> => ({
		auto: () => `Automatic (currently: ${ smoothMovementAutoValue[0] ? 'Enabled' : `Disabled; ${ smoothMovementAutoValue[1] }` })`,
		enabled: 'Enabled',
		disabled: 'Disabled',
	}), [smoothMovementAutoValue]);

	return (
		<fieldset>
			<legend>Effects</legend>
			<Column gap='large'>
				<ToggleSettingInput
					driver={ useGraphicsSettingDriver('effectBlinking') }
					label='Eye blinking of characters'
				/>
				<SelectSettingInput<GraphicsSettings['smoothMovement']>
					driver={ useGraphicsSettingDriver('smoothMovement') }
					label='Smooth movement'
					stringify={ SMOOTH_MOVEMENT_DESCRIPTIONS }
					schema={ GraphicsSettingsSchema.shape.smoothMovement }
				/>
			</Column>
		</fieldset>
	);
}

function QualitySettings(): ReactElement {

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

	const renderResolutionDriver = useGraphicsSettingDriver('renderResolution');
	const currentGraphicsSettings = useGraphicsSettings();

	return (
		<fieldset>
			<legend>Quality</legend>
			<Column gap='large'>
				<SelectSettingInput<string>
					driver={ {
						currentValue: renderResolutionDriver.currentValue?.toString(),
						defaultValue: renderResolutionDriver.defaultValue.toString(),
						onChange(v) {
							const newValue = GraphicsSettingsSchema.shape.renderResolution.parse(Number.parseInt(v, 10));
							return renderResolutionDriver.onChange(newValue);
						},
						onReset: renderResolutionDriver.onReset,
					} }
					label='Render resolution'
					stringify={
						Object.fromEntries(
							([100, 90, 80, 65, 50, 25, 0])
								.map((v) => [v.toString(), `${v}%`]),
						)
					}
					optionOrder={ [100, 90, 80, 65, 50, 25, 0].map(String) }
					schema={ z.string() }
				/>
				<SelectSettingInput<GraphicsSettings['textureResolution']>
					driver={ useGraphicsSettingDriver('textureResolution') }
					label='Texture resolution'
					stringify={ GRAPHICS_TEXTURE_RESOLUTION_DESCRIPTIONS }
					optionOrder={ ['auto', '1', '0.5', '0.25'] }
					schema={ GraphicsSettingsSchema.shape.textureResolution }
				/>
				<Column gap='none'>
					<ToggleSettingInput
						driver={ useGraphicsSettingDriver('antialias') }
						disabled={ currentGraphicsSettings.alphamaskEngine !== 'disabled' }
						label={
							currentGraphicsSettings.alphamaskEngine !== 'disabled' ? (
								<span className='text-strikethrough'>Use antialiasing (if supported by your browser)</span>
							) : (
								<>
									Use antialiasing (if supported by your browser)
									<span className='warning-box inline slim' title='Changing this setting will reload the page'>
										↺
									</span>
								</>
							)
						}
					/>
					{
						currentGraphicsSettings.alphamaskEngine !== 'disabled' ? (
							<span>Unavailable as "Alphamasking engine" is not set to "Ignore masks"</span>
						) : null
					}
				</Column>
				<SelectSettingInput<GraphicsSettings['alphamaskEngine']>
					driver={ useGraphicsSettingDriver('alphamaskEngine') }
					label={
						<>
							Alphamasking engine
							{
								currentGraphicsSettings.antialias ? (
									<span className='warning-box inline slim' title='Changing this setting might reload the page'>
										↺
									</span>
								) : null
							}
							<ContextHelpButton>
								<p>
									Alphamasks allow assets to hide parts of other assets beneath them, so they do not clip through.<br />
									Common examples of this are various shoes hiding feet/socks and pants hiding normally wide end of tops.<br />
									While not using an alphamasking engine will cause clipping with assets, <br />
									we decided to disable it by default, as many people are encountering performance issues due to it.<br />
									Our current implementation of alphamasking is also not compatible with Antialiasing.
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
				/>
			</Column>
		</fieldset>
	);
}

function GraphicsDebug(): ReactElement {
	const graphicsManger = useObservable(GraphicsManagerInstance);

	const [stats, setStats] = useState<IGraphicsLoaderStats>(() => ({
		inUseTextures: 0,
		loadedTextures: 0,
		trackedTextures: 0,
		loadedPixels: 0,
		estLoadedSize: 0,
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
				<span>Loaded textures size (pixels): { stats.loadedPixels.toLocaleString(undefined, { useGrouping: 'always' }) }</span>
				<span>Loaded textures size (bytes, estimate): { FormatBytes(stats.estLoadedSize, true) }</span>
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
