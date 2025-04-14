import type { Immutable } from 'immer';
import { AssertNever, CloneDeepMutable } from 'pandora-common';
import { useMemo } from 'react';
import { z } from 'zod';
import { GraphicsManagerInstance } from '../assets/graphicsManager.ts';
import { BrowserStorage } from '../browserStorage.ts';
import { useMediaQuery } from '../common/useMediaQuery.ts';
import type { SettingDriver } from '../components/settings/helpers/settingsInputs.tsx';
import { useObservable } from '../observable.ts';

export const GraphicsSettingsSchema = z.object({
	// Effects
	effectBlinking: z.boolean(),
	smoothMovement: z.enum(['auto', 'enabled', 'disabled']),
	// Quality
	renderResolution: z.number().int().min(0).max(100),
	textureResolution: z.enum(['auto', '1', '0.5', '0.25']),
	alphamaskEngine: z.enum(['pixi', 'customShader', 'disabled']),
});
export type GraphicsSettings = z.infer<typeof GraphicsSettingsSchema>;

export const GRAPHICS_SETTINGS_DEFAULT: Readonly<GraphicsSettings> = {
	// Effects
	effectBlinking: true,
	smoothMovement: 'auto',
	// Quality
	renderResolution: 100,
	textureResolution: 'auto',
	alphamaskEngine: 'disabled',
} as const;

export const GraphicsSettingsStorage = BrowserStorage.create<Partial<Immutable<GraphicsSettings>>>('settings.graphics', {}, GraphicsSettingsSchema.partial());
// Add a hook to purge the current graphics loader cache when the graphics settins change in any way
// (most of the changes cause different textures to be loaded, so get rid of old ones)
GraphicsSettingsStorage.subscribe(() => {
	// Do the cleanup asynchronously so things have time to unload if they were loaded
	setTimeout(() => {
		GraphicsManagerInstance.value?.loader.gc();
	}, 500);
});

export function useGraphicsSettings(): GraphicsSettings {
	const overrides = useObservable(GraphicsSettingsStorage);
	return useMemo(() => ({
		...GRAPHICS_SETTINGS_DEFAULT,
		...overrides,
	}), [overrides]);
}

export function SetGraphicsSettings(changes: Partial<GraphicsSettings>): void {
	GraphicsSettingsStorage.value = {
		...GraphicsSettingsStorage.value,
		...changes,
	};
}

export function ResetGraphicsSettings(settings: readonly (keyof GraphicsSettings)[]): void {
	GraphicsSettingsStorage.produce((v) => {
		const newValue = CloneDeepMutable(v);
		for (const s of settings) {
			delete newValue[s];
		}
		return newValue;
	});
}

export function useGraphicsSettingDriver<const Setting extends keyof GraphicsSettings>(setting: Setting): SettingDriver<Immutable<GraphicsSettings>[Setting]> {
	const settings = useObservable(GraphicsSettingsStorage);
	const currentValue: Immutable<GraphicsSettings>[Setting] | undefined = settings[setting];

	return useMemo((): SettingDriver<Immutable<GraphicsSettings>[Setting]> => ({
		currentValue,
		defaultValue: GRAPHICS_SETTINGS_DEFAULT[setting],
		onChange(newValue) {
			SetGraphicsSettings({ [setting]: newValue });
		},
		onReset() {
			ResetGraphicsSettings([setting]);
		},
	}), [currentValue, setting]);
}

//#region Setting-specific helpers and values

// Smooth movement

/**
 * Tests whether graphics smooth movement should be enabled or not, if using "auto" option.
 * @returns If smooth movement should be enabled by default
 */
export function useGraphicsSmoothMovementAutoEnabled(): boolean {
	return !useMediaQuery('(prefers-reduced-motion)');
}

/**
 * Tests whether graphics smooth movement should be enabled or not, if using "auto" option.
 * If it shouldn't be, it returns a short reason why not.
 * @returns If smooth movement should be enabled by default, or reason why not
 */
export function useGraphicsSmoothMovementAutoEnabledExplain(): [true] | [false, reason: string] {
	const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion)');

	return useMemo((): ReturnType<typeof useGraphicsSmoothMovementAutoEnabledExplain> => {
		if (prefersReducedMotion)
			return [false, 'system settings prefer reduced motion'];

		return [true];
	}, [prefersReducedMotion]);
}

/**
 * Checks whether graphics smooth movement should be enabled or not,
 * checking user's settings and resolving "auto" value if necessary.
 * @returns If smooth movement should be enabled
 */
export function useGraphicsSmoothMovementEnabled(): boolean {
	// get storage value
	const currentSmoothMovementSetting = useGraphicsSettings().smoothMovement;
	const smoothMovementAutoSetting = useGraphicsSmoothMovementAutoEnabled();
	// if auto call useGraphicsSmoothMovementAutoEnabled or useGraphicsSmoothMovementAutoEnabledExplain
	switch (currentSmoothMovementSetting) {
		case 'auto':
			return smoothMovementAutoSetting;
		case 'enabled':
			return true;
		case 'disabled':
			return false;
	}
	AssertNever(currentSmoothMovementSetting);
}

// Texture resolution

export const GRAPHICS_TEXTURE_RESOLUTION_SCALE: Record<Exclude<GraphicsSettings['textureResolution'], 'auto'>, number> = {
	'1': 1,
	'0.5': 2,
	'0.25': 4,
};

//#endregion
