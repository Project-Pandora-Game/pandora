import { Texture } from 'pixi.js';
import { useEffect, useRef, useState } from 'react';
import { GraphicsManagerInstance } from '../assets/graphicsManager';
import { useObservable } from '../observable';

export function useTexture(image: string, preferBlank: boolean = false, customGetTexture?: (path: string) => Promise<Texture>): Texture {
	const manager = useObservable(GraphicsManagerInstance);

	const wanted = useRef(image);
	const [texture, setTexture] = useState({
		image: '',
		texture: Texture.EMPTY,
	});

	useEffect(() => {
		wanted.current = image;
		const getTexture = customGetTexture ?? manager?.loader.getTexture.bind(manager.loader);
		if (!getTexture) {
			setTexture({
				image: '',
				texture: Texture.EMPTY,
			});
			return;
		}
		(async () => {
			const t = await getTexture(image);
			if (wanted.current === image) {
				setTexture({
					image,
					texture: t,
				});
			}
		})()
			.catch((_err) => {
				if (wanted.current === image) {
					setTexture({
						image: '',
						texture: Texture.EMPTY,
					});
				}
			});
	}, [manager, image, customGetTexture]);

	if (texture.image === image)
		return texture.texture;

	return manager?.loader.getCachedTexture(image) ?? (preferBlank ? Texture.EMPTY : texture.texture);
}
