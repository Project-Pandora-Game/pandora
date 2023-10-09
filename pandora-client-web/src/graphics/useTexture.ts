import { Texture } from 'pixi.js';
import { useEffect, useRef, useState } from 'react';
import { GraphicsManagerInstance } from '../assets/graphicsManager';
import { useObservable } from '../observable';

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
			const img = new Image();
			img.src = image;
			setTexture({
				image,
				texture: Texture.from(img),
			});
			return;
		}

		const unregister = loader.useTexture(image, (t) => {
			if (wanted.current === image) {
				setTexture({
					image,
					texture: t,
				});
			}
		});

		return () => {
			// Clear the wanted image so set doesn't happen after unmount
			wanted.current = '';
			unregister();
		};
	}, [manager, image, customGetTexture]);

	// Special cases of textures

	// Some constants reffer to specific constant textures
	const specialTexture = SPECIAL_TEXTURES.get(image);
	if (specialTexture != null)
		return specialTexture;

	// Custom getter has priority over loaded textures
	if (customGetTexture != null)
		return customGetTexture(image);

	// If the loaded texture is the one we requested, return it
	if (texture.image === image)
		return texture.texture;

	// Fallback texture logic:
	// - Try cached texture (avoids flickering during change before async event has chance to finish processing)
	// - If a blank texture is preferred over stale one, return blank texture
	// - Return stale texture
	return (manager?.loader.getCachedTexture(image)) ??
		(preferBlank ? Texture.EMPTY : texture.texture);
}
