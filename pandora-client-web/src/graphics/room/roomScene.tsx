import {
	AssetFrameworkGlobalState,
	FilterItemType,
	ICharacterRoomData,
	ItemRoomDevice,
	type AssetFrameworkRoomState,
} from 'pandora-common';
import * as PIXI from 'pixi.js';
import { ReactElement, useCallback, useMemo } from 'react';
import type { Character } from '../../character/character.ts';
import { Container } from '../baseComponents/container.ts';
import { Graphics } from '../baseComponents/graphics.ts';
import { usePlayerVisionFilters } from '../common/visionFilters.tsx';
import { GraphicsBackground } from '../graphicsBackground.tsx';
import { RoomCharacter } from './roomCharacter.tsx';
import { RoomDevice } from './roomDevice.tsx';
import { useRoomViewProjection } from './roomProjection.tsx';

export interface RoomGraphicsProps {
	room: AssetFrameworkRoomState;
	characters: readonly Character<ICharacterRoomData>[];
	globalState: AssetFrameworkGlobalState;
	showCharacterNames: boolean;
}

export function RoomGraphics({
	room,
	characters,
	globalState,
	showCharacterNames,
}: RoomGraphicsProps): ReactElement {
	const roomDevices = useMemo((): readonly ItemRoomDevice[] => (room.items.filter(FilterItemType('roomDevice')) ?? []), [room]);
	const { roomBackground } = room;
	const projectionResolver = useRoomViewProjection(roomBackground);

	const borderDraw = useCallback((g: PIXI.GraphicsContext) => {
		g
			.rect(0, 0, roomBackground.imageSize[0], roomBackground.imageSize[1])
			.stroke({ width: 2, color: 0x404040, alpha: 0.4 });
	}, [roomBackground]);

	return (
		<Container key={ room.id }>
			<GraphicsBackground
				background={ roomBackground }
				backgroundFilters={ usePlayerVisionFilters(false) }
			/>
			<Graphics
				draw={ borderDraw }
			/>
			<Container sortableChildren>
				{
					characters.map((character) => {
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
								globalState={ globalState }
								character={ character }
								projectionResolver={ projectionResolver }
								showName={ showCharacterNames }
							/>
						);
					})
				}
				{
					roomDevices.map((device) => (device.isDeployed() ? (
						<RoomDevice
							key={ device.id }
							characters={ characters }
							globalState={ globalState }
							roomState={ room }
							item={ device }
							deployment={ device.deployment }
							projectionResolver={ projectionResolver }
						/>
					) : null))
				}
			</Container>
		</Container>
	);
}
