import { GetLogger } from 'pandora-common';
import { Texture } from 'pixi.js';
import { useEffect, useRef, useState } from 'react';
import { ERROR_TEXTURE } from '../assets/graphicsLoader.ts';
import { GraphicsManagerInstance } from '../assets/graphicsManager.ts';
import { useObservable } from '../observable.ts';
import { useRegisterSuspenseAsset } from './graphicsSuspense/graphicsSuspense.tsx';
import { LoadInlineImageResource } from './utility.ts';

const RESULT_NO_TEXTURE = {
	image: '',
	texture: Texture.EMPTY,
} as const;

const SPECIAL_TEXTURES: ReadonlyMap<string, Texture> = new Map<string, Texture>([
	['', Texture.EMPTY],
	['*', Texture.WHITE],
]);

/**
 * Resolves an image string to a texture. Supported image formats:
 * - `''` (empty string): `Texture.EMPTY`
 * - `'*'`: `Texture.WHITE`
 * - `data:image/*;base64,...`: The image created from the data blob
 * - `https://...`: Image available on URL
 * @param image - The image to resolve to texture
 * @param preferBlank - True: prefer blank (`Texture.EMPTY`) when texture is not ready; False (default): Reuse last ready texture when new texture is not ready
 * @param customGetTexture - Optional getter for resolving http-based textures (is not used for special ones)
 * @returns The requested texture, or `Texture.EMPTY` when the texture is not yet ready
 */
export function useTexture(
	image: string | '' | '*',
	preferBlank: boolean = false,
	customGetTexture?: (path: string) => Texture,
): Texture {
	const manager = useObservable(GraphicsManagerInstance);

	const wanted = useRef('');
	const [texture, setTexture] = useState<{
		readonly image: string;
		readonly texture: Texture;
		readonly lock?: () => (() => void);
	}>(RESULT_NO_TEXTURE);

	useEffect(() => {
		const loader = manager?.loader;
		if (customGetTexture || loader == null || SPECIAL_TEXTURES.has(image)) {
			wanted.current = '';
			setTexture(RESULT_NO_TEXTURE);
			return;
		}

		wanted.current = image;

		if (/^data:image\/[^;]+;base64,[0-9a-zA-Z+/=]+$/i.test(image)) {
			LoadInlineImageResource(image)
				.then((source) => {
					if (wanted.current === image) {
						setTexture({
							image,
							texture: new Texture({ source }),
						});
					}
				})
				.catch((error) => {
					GetLogger('useTexture').error('Error loading inline texture:', error);
					if (wanted.current === image) {
						setTexture({
							image,
							texture: ERROR_TEXTURE,
						});
					}
				});
			return;
		}

		const unregister = loader.useTexture(image, (t, lock) => {
			if (wanted.current === image) {
				setTexture({
					image,
					texture: t,
					lock,
				});
			}
		});

		return () => {
			// Clear the wanted image so set doesn't happen after unmount
			wanted.current = '';
			unregister();
		};
	}, [manager, image, customGetTexture]);

	const suspenseAsset = useRegisterSuspenseAsset();

	useEffect(() => {
		return texture.lock?.();
	}, [texture]);

	// Special cases of textures

	// Some constants reffer to specific constant textures
	const specialTexture = SPECIAL_TEXTURES.get(image);
	if (specialTexture != null) {
		suspenseAsset.setReady(true);
		return specialTexture;
	}

	// Custom getter has priority over loaded textures
	if (customGetTexture != null) {
		suspenseAsset.setReady(true);
		return customGetTexture(image);
	}

	// If the loaded texture is the one we requested, return it
	if (texture.image === image) {
		suspenseAsset.setReady(true);
		return texture.texture;
	}

	// Fallback texture logic:
	// - Try cached texture (avoids flickering during change before async event has chance to finish processing)
	// - If a blank texture is preferred over stale one, return blank texture
	// - Return stale texture
	const resultTexture = (manager?.loader.getCachedTexture(image)) ??
		(preferBlank ? Texture.EMPTY : texture.texture);

	suspenseAsset.setReady(preferBlank || resultTexture !== Texture.EMPTY);
	return resultTexture;
}
