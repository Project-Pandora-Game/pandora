import { Texture } from 'pixi.js';
import { useEffect, useRef, useState } from 'react';
import { GraphicsManagerInstance } from '../assets/graphicsManager';
import { useObservable } from '../observable';

/**
 * Resolves an image string to a texture. Supported image formats:
 * - `''` (empty string): `Texture.EMPTY`
 * - `'*'`: `Texture.WHITE`
 * - `data:image/png;base64,...`: The image created from the data blob
 * - `https://...`: Image available on URL
 * @param image - The image to resolve to texture
 * @param preferBlank - True: prefer blank (`Texture.EMPTY`) when texture is not ready; False: Reuse last ready texture when new texture is not ready
 * @param customGetTexture - Optional getter for resolving http-based textures (is not used for special ones)
 * @returns The requested texture, or `Texture.EMPTY` when the texture is not yet ready
 */
export function useTexture(image: string | '' | '*', preferBlank: boolean = false, customGetTexture?: (path: string) => Promise<Texture>): Texture {
	const manager = useObservable(GraphicsManagerInstance);

	const wanted = useRef('');
	const wantedGetTexture = useRef<((path: string) => Promise<Texture>) | undefined>(undefined);
	const [texture, setTexture] = useState({
		image: '',
		texture: Texture.EMPTY,
	});

	useEffect(() => {
		const getTexture = customGetTexture ?? manager?.loader.getTexture.bind(manager.loader);
		wanted.current = image;
		wantedGetTexture.current = getTexture;
		if (!getTexture || image === '') {
			setTexture({
				image,
				texture: Texture.EMPTY,
			});
			return;
		}

		if (image === '*') {
			setTexture({
				image,
				texture: Texture.WHITE,
			});
			return;
		}

		if (/^data:image\/png;base64,[0-9a-zA-Z+/=]+$/i.test(image)) {
			const img = new Image();
			img.src = image;
			setTexture({
				image,
				texture: Texture.from(img),
			});
			return;
		}

		(async () => {
			const t = await getTexture(image);
			if (wanted.current === image && wantedGetTexture.current === getTexture) {
				setTexture({
					image,
					texture: t,
				});
			}
		})()
			.catch((_err) => {
				if (wanted.current === image && wantedGetTexture.current === getTexture) {
					setTexture({
						image,
						texture: Texture.EMPTY,
					});
				}
			});

		return () => {
			// Clear the wanted image so set doesn't happen after unmount
			wanted.current = '';
		};
	}, [manager, image, customGetTexture]);

	if (texture.image === image)
		return texture.texture;

	return (customGetTexture ? null : manager?.loader.getCachedTexture(image)) ??
		(preferBlank ? Texture.EMPTY : texture.texture);
}
