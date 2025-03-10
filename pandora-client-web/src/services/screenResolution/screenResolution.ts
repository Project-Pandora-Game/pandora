import type { Immutable } from 'immer';
import { CharacterSize, GetLogger, TypedEventEmitter } from 'pandora-common';
import { useCallback, useSyncExternalStore } from 'react';
import { z } from 'zod';
import { BrowserStorage } from '../../browserStorage.ts';
import type { GraphicsSettings } from '../../graphics/graphicsSettings.tsx';

/**
 * List of resolutions to try in format [width, height, textureResolution].
 * The first for which (screenWidth >= width || screenHeight >= height) is true is used.
 * When a screen gets bigger, the resolution might change to a better one,
 * but it never returns to a worse one.
 */
const AUTOMATIC_TEXTURE_RESOLUTIONS: Immutable<[number, number, Exclude<GraphicsSettings['textureResolution'], 'auto'>][]> = [
	[
		2 * CharacterSize.WIDTH,
		1.6 * CharacterSize.HEIGHT,
		'1',
	],
	[
		2 * 0.5 * CharacterSize.WIDTH,
		1.6 * 0.5 * CharacterSize.HEIGHT,
		'0.5',
	],
	[0, 0, '0.25'],
] as const;

export type ScreenResolutionSericeEvents = {
	resolutionChanged: readonly [number, number];
	automaticResolutionChanged: GraphicsSettings['textureResolution'];
};

const logger = GetLogger('ScreenResolutionSerice');

export const ScreenResolutionSerice = new class ScreenResolutionSerice extends TypedEventEmitter<ScreenResolutionSericeEvents> {
	private readonly _screenSizeObserver: ResizeObserver;

	public get automaticTextureResolution(): Exclude<GraphicsSettings['textureResolution'], 'auto'> {
		if (this.forceFullResolution)
			return '1';

		return AUTOMATIC_TEXTURE_RESOLUTIONS[this._automaticResolutionIndex.value]?.[2] ?? '1';
	}

	public forceFullResolution: boolean = false;

	private _screenWidth = 0;
	private _screenHeight = 0;
	private readonly _automaticResolutionIndex = BrowserStorage.create<number>(
		'screen-resolution.auto-resolution-index',
		AUTOMATIC_TEXTURE_RESOLUTIONS.length - 1,
		z.number().int().min(0).max(AUTOMATIC_TEXTURE_RESOLUTIONS.length - 1),
	);

	constructor() {
		super();
		this._screenSizeObserver = new ResizeObserver(() => this._onUpdate());
		this._screenSizeObserver.observe(window.document.body);
		this._onUpdate();
		logger.verbose('Loaded; selected automatic texture resolution:', this.automaticTextureResolution);

		this._automaticResolutionIndex.subscribe(() => {
			logger.verbose('Automatic texture resolution changed:', this.automaticTextureResolution);
			this.emit('automaticResolutionChanged', this.automaticTextureResolution);
		});
	}

	private _onUpdate(): void {
		this._screenWidth = Math.ceil(window.innerWidth * window.devicePixelRatio);
		this._screenHeight = Math.ceil(window.innerHeight * window.devicePixelRatio);

		this.emit('resolutionChanged', [this._screenWidth, this._screenHeight]);

		const resolutionIndex = AUTOMATIC_TEXTURE_RESOLUTIONS
			.findIndex(([width, height]) => this._screenWidth >= width || this._screenHeight >= height);
		if (resolutionIndex >= 0 && resolutionIndex < this._automaticResolutionIndex.value) {
			this._automaticResolutionIndex.value = resolutionIndex;
		}
	}
};

export function useAutomaticResolution(): Exclude<GraphicsSettings['textureResolution'], 'auto'> {
	return useSyncExternalStore(
		useCallback((change) => ScreenResolutionSerice.on('automaticResolutionChanged', change), []),
		useCallback(() => ScreenResolutionSerice.automaticTextureResolution, []),
	);
}
