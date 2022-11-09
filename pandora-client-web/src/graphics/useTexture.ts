import { Texture } from 'pixi.js';
import { useEffect, useRef, useState } from 'react';
import { GraphicsManagerInstance } from '../assets/graphicsManager';
import { useObservable } from '../observable';

export function useTexture(image: string, preferBlank: boolean = false, customGetTexture?: (path: string) => Promise<Texture>): Texture {
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
		if (!getTexture) {
			setTexture({
				image,
				texture: Texture.EMPTY,
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
	}, [manager, image, customGetTexture]);

	if (texture.image === image)
		return texture.texture;

	return (customGetTexture ? null : manager?.loader.getCachedTexture(image)) ??
		(preferBlank ? Texture.EMPTY : texture.texture);
}
