import {
	AssetFrameworkGlobalState,
	EMPTY_ARRAY,
	FilterItemType,
	ICharacterRoomData,
	ItemRoomDevice,
	type AssetFrameworkCharacterState,
	type AssetFrameworkRoomState,
	type ItemId,
} from 'pandora-common';
import * as PIXI from 'pixi.js';
import { ReactElement, useCallback, useMemo } from 'react';
import type { Character } from '../../character/character.ts';
import { Container } from '../baseComponents/container.ts';
import { Graphics } from '../baseComponents/graphics.ts';
import { usePlayerVisionFiltersFactory } from '../common/visionFilters.tsx';
import { GraphicsBackground } from '../graphicsBackground.tsx';
import { RoomCharacter } from './roomCharacter.tsx';
import { RoomDevice } from './roomDevice.tsx';
import { useRoomViewProjection } from './roomProjection.tsx';
import './roomScene.scss';

export interface RoomGraphicsProps {
	room: AssetFrameworkRoomState;
	characters: readonly Character<ICharacterRoomData>[];
	globalState: AssetFrameworkGlobalState;
	showCharacterNames: boolean;
	/** @default false */
	noRoomBackground?: boolean;
}

export function RoomGraphics({
	room,
	characters,
	globalState,
	showCharacterNames,
	noRoomBackground = false,
}: RoomGraphicsProps): ReactElement {
	const roomDevices = useMemo((): readonly ItemRoomDevice[] => (room.items.filter(FilterItemType('roomDevice')) ?? []), [room]);
	// Optimize for the fact, that vast majority of room devices do not have a character
	const roomDeviceCharacters = useMemo((): ReadonlyMap<ItemId, readonly AssetFrameworkCharacterState[]> => {
		const result = new Map<ItemId, AssetFrameworkCharacterState[]>();
		for (const character of globalState.characters.values()) {
			const link = character.getRoomDeviceWearablePart()?.roomDeviceLink;
			if (link != null) {
				let deviceResult = result.get(link.device);
				if (deviceResult === undefined) {
					result.set(link.device, (deviceResult = []));
				}
				deviceResult.push(character);
			}
		}
		return result;
	}, [globalState]);

	const { roomBackground } = room;
	const projectionResolver = useRoomViewProjection(roomBackground);
	const playerVisionFilters = usePlayerVisionFiltersFactory(false);
	const playerSelfVisionFilters = usePlayerVisionFiltersFactory(true);
	const backgroundFilters = useMemo(playerVisionFilters, [playerVisionFilters]);

	const borderDraw = useCallback((g: PIXI.GraphicsContext) => {
		g
			.rect(0, 0, roomBackground.imageSize[0], roomBackground.imageSize[1])
			.stroke({ width: 2, color: 0x404040, alpha: 0.4 });
	}, [roomBackground]);

	return (
		<Container key={ room.id }>
			{ !noRoomBackground ? (
				<>
					<GraphicsBackground
						background={ roomBackground }
						backgroundFilters={ backgroundFilters }
					/>
					<Graphics
						draw={ borderDraw }
					/>
				</>
			) : null }
			<Container sortableChildren>
				{ roomDevices.map((device) => (device.isDeployed() ? (
					<RoomDevice
						key={ device.id }
						characters={ characters }
						charactersInDevice={ roomDeviceCharacters.get(device.id) ?? EMPTY_ARRAY }
						roomState={ room }
						item={ device }
						deployment={ device.deployment }
						projectionResolver={ projectionResolver }
						filters={ playerVisionFilters }
					/>
				) : null)) }
				{ characters.map((character) => {
					const characterState = globalState.characters.get(character.id);
					if (characterState == null ||
						characterState.position.type !== 'normal' ||
						characterState.currentRoom !== room.id
					) {
						return null;
					}

					return (
						<RoomCharacter
							key={ character.id }
							characterState={ characterState }
							character={ character }
							projectionResolver={ projectionResolver }
							showName={ showCharacterNames }
							visionFilters={ character.isPlayer() ? playerSelfVisionFilters : playerVisionFilters }
						/>
					);
				}) }
			</Container>
		</Container>
	);
}
