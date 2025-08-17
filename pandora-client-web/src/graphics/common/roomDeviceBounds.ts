import { min } from 'lodash-es';
import { AssertNever, CharacterSize, type Asset, type Rectangle } from 'pandora-common';
import { CHARACTER_PIVOT_POSITION } from '../graphicsCharacter.tsx';

/**
 * Calculates approximate bounds for room device graphics, relative to its pivot
 * @param asset
 */
export function CalculateRoomDeviceGraphicsBounds(asset: Asset<'roomDevice'>): Rectangle {
	const definition = asset.definition;

	let itemLeft = definition.pivot.x - 20;
	let itemRight = definition.pivot.x + 20;
	let itemTop = definition.pivot.y - 20;
	let itemBottom = definition.pivot.y + 20;

	for (const layer of definition.graphicsLayers) {
		if (layer.type === 'sprite') {
			const offsetX = Math.min(layer.offset?.x ?? 0, min(layer.offsetOverrides?.map((o) => o.offset.x)) ?? layer.offset?.x ?? 0);
			const offsetY = Math.min(layer.offset?.y ?? 0, min(layer.offsetOverrides?.map((o) => o.offset.y)) ?? layer.offset?.y ?? 0);

			itemLeft = Math.min(itemLeft, offsetX);
			itemTop = Math.min(itemTop, offsetY);
			if (offsetX < definition.pivot.x) {
				const width = 2 * (definition.pivot.x - offsetX);
				itemRight = Math.max(itemRight, offsetX + width);
			}
		} else if (layer.type === 'slot') {
			for (const position of [layer.characterPosition, ...(layer.characterPositionOverrides ?? []).map((o) => o.position)]) {
				const characterScale = position.relativeScale ?? 1;
				const x = definition.pivot.x + position.offsetX - characterScale * (CHARACTER_PIVOT_POSITION.x + (position.pivotOffset?.x ?? 0));
				const y = definition.pivot.y + position.offsetY - characterScale * (CHARACTER_PIVOT_POSITION.y + (position.pivotOffset?.y ?? 0));

				itemLeft = Math.min(itemLeft, x);
				itemTop = Math.min(itemTop, y);
				const width = Math.ceil(characterScale * CharacterSize.WIDTH);
				itemRight = Math.max(itemRight, x + width);
				const height = Math.ceil(characterScale * CharacterSize.HEIGHT);
				itemBottom = Math.max(itemBottom, y + height);
			}
		} else if (layer.type === 'text') {
			const offsetX = layer.offset?.x ?? 0;
			const offsetY = layer.offset?.y ?? 0;

			itemLeft = Math.min(itemLeft, offsetX);
			itemTop = Math.min(itemTop, offsetY);
			itemRight = Math.max(itemRight, offsetX + layer.size.width);
			itemBottom = Math.max(itemBottom, offsetY + layer.size.height);
		} else {
			AssertNever(layer);
		}
	}

	return {
		x: itemLeft - definition.pivot.x,
		y: itemTop - definition.pivot.y,
		width: itemRight - itemLeft,
		height: itemBottom - itemTop,
	};
}
