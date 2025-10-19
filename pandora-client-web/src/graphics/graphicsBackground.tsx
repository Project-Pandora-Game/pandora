import type { Immutable } from 'immer';
import { AssertNever, GetRoomPositionBounds, type RoomBackground3dBoxSide, type RoomBackgroundData, type RoomBackgroundGraphics } from 'pandora-common';
import { Filter, Texture } from 'pixi.js';
import { memo, ReactElement, useMemo } from 'react';
import { useImageResolutionAlternative } from '../assets/assetGraphicsCalculations.ts';
import { useAssetManager } from '../assets/assetManager.tsx';
import { Container } from './baseComponents/container.ts';
import { PixiMesh } from './baseComponents/mesh.tsx';
import { Sprite } from './baseComponents/sprite.ts';
import { DEFAULT_BACKGROUND_COLOR } from './graphicsScene.tsx';
import { useRoomViewProjection } from './room/roomProjection.tsx';
import { useTexture } from './useTexture.ts';

export const GraphicsBackground = memo(function GraphicsBackground({
	background,
	backgroundFilters,
	zIndex,
}: {
	background: Immutable<RoomBackgroundData>;
	backgroundFilters?: readonly Filter[];
	zIndex?: number;
}): ReactElement | null {
	if (background.graphics.type === 'image') {
		return (
			<GraphicsBackgroundImage
				graphics={ background.graphics }
				backgroundSize={ background.imageSize }
				backgroundFilters={ backgroundFilters }
				zIndex={ zIndex }
			/>
		);
	} else if (background.graphics.type === '3dBox') {
		return (
			<GraphicsBackground3DBox
				graphics={ background.graphics }
				background={ background }
				backgroundFilters={ backgroundFilters }
				zIndex={ zIndex }
			/>
		);
	}

	AssertNever(background.graphics);
});

function GraphicsBackgroundImage({
	graphics,
	backgroundSize,
	backgroundFilters,
	zIndex,
}: {
	graphics: Immutable<Extract<RoomBackgroundGraphics, { type: 'image'; }>>;
	backgroundSize: readonly [number, number];
	backgroundFilters?: readonly Filter[];
	zIndex?: number;
}): ReactElement | null {
	const backgroundResult = useMemo<{
		backgroundTint: number;
		backgroundAlpha: number;
		backgroundImage: string;
	}>(() => {
		// If background is not defined, use default one
		if (!graphics.image) {
			return {
				backgroundTint: DEFAULT_BACKGROUND_COLOR,
				backgroundAlpha: 1,
				backgroundImage: '*',
			};
		}
		// Parse color in hex format, with optional alpha
		if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(graphics.image)) {
			return {
				backgroundTint: parseInt(graphics.image.substring(1, 7), 16),
				backgroundAlpha: graphics.image.length > 7 ? (parseInt(graphics.image.substring(7, 9), 16) / 255) : 1,
				backgroundImage: '*',
			};
		}
		// Otherwise try to use background as image path
		return {
			backgroundTint: 0xffffff,
			backgroundAlpha: 1,
			backgroundImage: graphics.image,
		};
	}, [graphics]);

	const backgroundTexture = useTexture(useImageResolutionAlternative(backgroundResult.backgroundImage).image, true);

	return (
		<Sprite
			width={ backgroundSize[0] }
			height={ backgroundSize[1] }
			zIndex={ zIndex }
			texture={ backgroundTexture }
			tint={ backgroundResult.backgroundTint }
			filters={ backgroundFilters }
		/>
	);
}

type GraphicsBackground3DBoxPart = {
	vertices: Float32Array;
	uvs: Float32Array;
	indices: Uint32Array;
	data: RoomBackground3dBoxSide;
};
export const GRAPHICS_BACKGROUND_TILE_SIZE = 128;
/**
 * We subdivide title to reduce warping effect along the diagonal with our perspective transform.
 * This variable defines how many levels of subdivision happen.
 */
export const GRAPHICS_BACKGROUND_TILE_SUBDIVISION = 2;
function GraphicsBackground3DBox({
	graphics,
	background,
	backgroundFilters,
	zIndex,
}: {
	graphics: Immutable<Extract<RoomBackgroundGraphics, { type: '3dBox'; }>>;
	background: Immutable<RoomBackgroundData>;
	backgroundFilters?: readonly Filter[];
	zIndex?: number;
}): ReactElement | null {
	const projection = useRoomViewProjection(background);

	const parts = useMemo((): GraphicsBackground3DBoxPart[] => {
		const result: GraphicsBackground3DBoxPart[] = [];

		const { ceiling } = background;
		const { minX, maxX, minY, maxY } = GetRoomPositionBounds(background);

		function CreateTiledMesh(
			width: number,
			height: number,
			data: RoomBackground3dBoxSide,
			transform: (u: number, v: number) => [x: number, y: number],
		): GraphicsBackground3DBoxPart {
			const tileSize = GRAPHICS_BACKGROUND_TILE_SIZE * data.tileScale;
			const squareSize = tileSize / (2 ** GRAPHICS_BACKGROUND_TILE_SUBDIVISION);
			const widthCount = Math.ceil(width / squareSize);
			const heightCount = Math.ceil(height / squareSize);
			const vertexCount = (widthCount + 1) * (heightCount + 1);

			const vertices = new Float32Array(2 * vertexCount);
			const uvs = new Float32Array(2 * vertexCount);
			const indices = new Uint32Array((2 * 3 * widthCount * heightCount));

			// Generate vertices
			for (let y = 0; y <= heightCount; y++) {
				for (let x = 0; x <= widthCount; x++) {
					const index = 2 * (y * (widthCount + 1) + x);
					const xCoordinate = Math.min(x * squareSize, width);
					const yCoordinate = Math.min(y * squareSize, height);
					const [remmappedX, remmappedY] = transform(xCoordinate, yCoordinate);
					vertices[index] = remmappedX;
					vertices[index + 1] = remmappedY;
					uvs[index] = (data.rotate ? yCoordinate : xCoordinate) / tileSize;
					uvs[index + 1] = (data.rotate ? (tileSize - xCoordinate) : yCoordinate) / tileSize;
				}
			}

			// Generate triangles
			let indicesIndex = 0;
			for (let y = 0; y < heightCount; y++) {
				for (let x = 0; x < widthCount; x++) {
					const vertexA = (y * (widthCount + 1) + x);
					const vertexB = (y * (widthCount + 1) + x + 1);
					const vertexC = ((y + 1) * (widthCount + 1) + x + 1);
					const vertexD = ((y + 1) * (widthCount + 1) + x);

					indices[indicesIndex++] = vertexA;
					indices[indicesIndex++] = vertexB;
					indices[indicesIndex++] = vertexC;
					indices[indicesIndex++] = vertexC;
					indices[indicesIndex++] = vertexD;
					indices[indicesIndex++] = vertexA;
				}
			}

			return {
				vertices,
				uvs,
				indices,
				data,
			};
		}

		result.push(CreateTiledMesh(
			maxX - minX,
			maxY - minY,
			graphics.floor,
			(u, v) => projection.transform(minX + u, maxY - v, 0),
		));

		result.push(CreateTiledMesh(
			maxX - minX,
			ceiling - 0,
			graphics.wallBack,
			(u, v) => projection.transform(minX + u, maxY, ceiling - v),
		));

		if (graphics.wallLeft != null) {
			const leftWall = CreateTiledMesh(
				maxY - minY,
				ceiling - 0,
				graphics.wallLeft,
				(u, v) => projection.transform(minX, minY + u, ceiling - v),
			);
			// We need little UV adjustment to cutoff near the left side instead of right one for the left wall specifically
			const tileSize = GRAPHICS_BACKGROUND_TILE_SIZE * graphics.wallLeft.tileScale;
			const tileOverlap = (maxY - minY) % tileSize;
			if (tileOverlap !== 0) {
				const shift = tileOverlap / tileSize;
				for (let i = (graphics.wallLeft.rotate ? 1 : 0); i < leftWall.uvs.length; i += 2) {
					leftWall.uvs[i] -= shift;
				}
			}
			result.push(leftWall);
		}

		if (graphics.wallRight != null) {
			result.push(CreateTiledMesh(
				maxY - minY,
				ceiling - 0,
				graphics.wallRight,
				(u, v) => projection.transform(maxX, maxY - u, ceiling - v),
			));
		}

		if (graphics.ceiling != null) {
			result.push(CreateTiledMesh(
				maxX - minX,
				maxY - minY,
				graphics.ceiling,
				(u, v) => projection.transform(minX + u, maxY - v, ceiling),
			));
		}

		return result;
	}, [graphics, background, projection]);

	return (
		<Container zIndex={ zIndex } filters={ backgroundFilters }>
			{
				parts.map((p, i) => (
					<GraphicsBackground3DBoxSide
						key={ i }
						part={ p }
					/>
				))
			}
		</Container>
	);
}

function GraphicsBackground3DBoxSide({ part }: {
	part: GraphicsBackground3DBoxPart;
}) {
	const assetManager = useAssetManager();
	const tileInfo = (!!part.data.texture && part.data.texture !== '*') ? assetManager.tileTextures.get(part.data.texture) : undefined;

	const texture = useTexture(tileInfo?.image ?? '*');

	if (texture !== Texture.WHITE && texture !== Texture.EMPTY) {
		const sourceStyle = texture.source.style;
		sourceStyle.addressMode = 'repeat';
		sourceStyle.update();
	}

	return (
		<PixiMesh
			texture={ texture }
			vertices={ part.vertices }
			uvs={ part.uvs }
			indices={ part.indices }
			tint={ parseInt(part.data.tint.substring(1, 7), 16) }
		/>
	);
}
