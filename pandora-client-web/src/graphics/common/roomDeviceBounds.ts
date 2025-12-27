import type { Immutable } from 'immer';
import { max, min } from 'lodash-es';
import { AssertNever, CharacterSize, type Asset, type AssetGraphicsRoomDeviceDefinition, type Rectangle } from 'pandora-common';
import { CHARACTER_PIVOT_POSITION } from '../graphicsCharacter.tsx';

/**
 * Calculates approximate bounds for room device graphics, relative to its pivot
 * @param asset
 */
export function CalculateRoomDeviceGraphicsBounds(asset: Asset<'roomDevice'>, graphics: Immutable<AssetGraphicsRoomDeviceDefinition>): Rectangle {
	const definition = asset.definition;

	let itemLeft = definition.pivot.x - 20;
	let itemRight = definition.pivot.x + 20;
	let itemTop = definition.pivot.y - 20;
	let itemBottom = definition.pivot.y + 20;

	for (const layer of graphics.layers) {
		if (layer.type === 'sprite') {
			const offsetXmin = min([layer.x ?? 0, ...(layer.offsetOverrides?.map((o) => o.offset.x) ?? [])]) ?? 0;
			const offsetXmax = max([layer.x ?? 0, ...(layer.offsetOverrides?.map((o) => o.offset.x) ?? [])]) ?? 0;
			const offsetYmin = min([layer.y ?? 0, ...(layer.offsetOverrides?.map((o) => o.offset.y) ?? [])]) ?? 0;
			const offsetYmax = max([layer.y ?? 0, ...(layer.offsetOverrides?.map((o) => o.offset.y) ?? [])]) ?? 0;

			itemLeft = Math.min(itemLeft, offsetXmin);
			itemTop = Math.min(itemTop, offsetYmin);
			itemRight = Math.max(itemRight, offsetXmax + layer.width);
			itemBottom = Math.max(itemBottom, offsetYmax + layer.height);
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
		} else if (layer.type === 'mesh') {
			if (layer.geometry.type === '2d') {
				const vertices = Math.floor(layer.geometry.positions.length / 2);
				const offsetXmin = min([layer.geometry.offset?.x ?? 0, ...(layer.geometry.offsetOverrides?.map((o) => o.offset.x) ?? [])]) ?? 0;
				const offsetXmax = max([layer.geometry.offset?.x ?? 0, ...(layer.geometry.offsetOverrides?.map((o) => o.offset.x) ?? [])]) ?? 0;
				const offsetYmin = min([layer.geometry.offset?.y ?? 0, ...(layer.geometry.offsetOverrides?.map((o) => o.offset.y) ?? [])]) ?? 0;
				const offsetYmax = max([layer.geometry.offset?.y ?? 0, ...(layer.geometry.offsetOverrides?.map((o) => o.offset.y) ?? [])]) ?? 0;

				for (let vi = 0; vi < vertices; vi++) {
					const x = layer.geometry.positions[2 * vi];
					const y = layer.geometry.positions[2 * vi + 1];

					itemLeft = Math.min(itemLeft, x + offsetXmin);
					itemTop = Math.min(itemTop, y + offsetYmin);
					itemRight = Math.max(itemRight, x + offsetXmax);
					itemBottom = Math.max(itemBottom, y + offsetYmax);
				}
			} else {
				AssertNever(layer.geometry.type);
			}
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
