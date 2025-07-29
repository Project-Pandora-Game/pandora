import classNames from 'classnames';
import type { Immutable } from 'immer';
import { isEqual } from 'lodash-es';
import {
	CloneDeepMutable,
	LIMIT_ROOM_NAME_LENGTH,
	RoomId,
	RoomNameSchema,
	type AssetFrameworkGlobalState,
	type AssetFrameworkRoomState,
	type AssetFrameworkSpaceState,
	type Coordinates,
	type RoomBackgroundData,
} from 'pandora-common';
import { ReactElement, useEffect, useId, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { GetAssetsSourceUrl } from '../../../assets/assetManager.tsx';
import deleteIcon from '../../../assets/icons/delete.svg';
import plusIcon from '../../../assets/icons/plus.svg';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { Button } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { FormCreateStringValidator, FormError } from '../../../components/common/form/form.tsx';
import { SelectionIndicator } from '../../../components/common/selectionIndicator/selectionIndicator.tsx';
import { GameLogicActionButton } from '../../../components/wardrobe/wardrobeComponents.tsx';
import { Container } from '../../../graphics/baseComponents/container.ts';
import { GraphicsBackground } from '../../../graphics/graphicsBackground.tsx';
import { GraphicsSceneBackgroundRenderer } from '../../../graphics/graphicsSceneRenderer.tsx';
import { serviceManagerContext } from '../../../services/serviceProvider.tsx';
import { BackgroundSelectDialog } from './backgroundSelect.tsx';
import './spaceStateConfiguration.scss';

export type SpaceStateConfigurationUiProps = {
	globalState: AssetFrameworkGlobalState;
};

export function SpaceStateConfigurationUi({
	globalState,
}: SpaceStateConfigurationUiProps): ReactElement {
	const [selectedRoom, setSelectedRoom] = useState<RoomId | null>(null);

	const selectedRoomState = selectedRoom == null ? null : globalState.space.getRoom(selectedRoom);

	return (
		<Column className='SpaceStateConfigurationUi fill contain-size' alignX='center' overflowY='auto'>
			<Row className='spaceLayout'>
				<RoomGrid
					spaceState={ globalState.space }
					selectedRoom={ selectedRoom }
					setSelectedRoom={ setSelectedRoom }
				/>
				<Column className='roomList fill-y flex-1' padding='medium' overflowY='auto'>
					{
						globalState.space.rooms.map((r) => (
							<button
								key={ r.id }
								className={ classNames(
									'wardrobeActionButton',
									'roomListItem',
									(r.id === selectedRoom) ? 'selected' : null,
									'allowed',
								) }
								onClick={ () => {
									setSelectedRoom((v) => v === r.id ? null : r.id);
								} }
							>
								<span className='name'>{ r.name || r.id }</span>
							</button>
						))
					}
					<GameLogicActionButton
						className='roomListItem'
						action={ {
							type: 'spaceRoomLayout',
							subaction: {
								type: 'createRoom',
							},
						} }
					>
						<img src={ plusIcon } className='icon' alt='Create room' />
						<span className='name'>Create a new room</span>
					</GameLogicActionButton>
				</Column>
			</Row>
			<hr className='fill-x' />
			<Column className='fill-x flex-1 contain-size' alignX='center'>
				{
					selectedRoomState != null ? (
						<RoomConfiguration
							key={ selectedRoomState.id }
							isEntryRoom={ globalState.space.rooms[0].id === selectedRoom }
							roomState={ selectedRoomState }
							close={ () => {
								setSelectedRoom(null);
							} }
						/>
					) : null
				}
			</Column>
		</Column>
	);
}

function RoomGrid({ spaceState, selectedRoom, setSelectedRoom }: {
	spaceState: AssetFrameworkSpaceState;
	selectedRoom: RoomId | null;
	setSelectedRoom: Dispatch<SetStateAction<RoomId | null>>;
}): ReactElement {
	const [minCoords] = useMemo((): [Immutable<Coordinates>, Immutable<Coordinates>] => {
		const minCoordsTmp: Coordinates = { x: 0, y: 0 };
		const maxCoordsTmp: Coordinates = { x: 0, y: 0 };

		for (const room of spaceState.rooms) {
			minCoordsTmp.x = Math.min(minCoordsTmp.x, room.position.x);
			minCoordsTmp.y = Math.min(minCoordsTmp.y, room.position.y);
			maxCoordsTmp.x = Math.max(minCoordsTmp.x, room.position.x);
			maxCoordsTmp.y = Math.max(minCoordsTmp.y, room.position.y);
		}

		return [minCoordsTmp, maxCoordsTmp];
	}, [spaceState]);
	const roomGridDiv = useRef<HTMLDivElement>(null);
	const suppressScroll = useRef<RoomId>(null);

	const previewSize = 256 * (window.devicePixelRatio || 1);

	const selectedRoomState = selectedRoom != null ? spaceState.getRoom(selectedRoom) : null;
	const { x: selectedX, y: selectedY } = selectedRoomState?.position ?? { x: 0, y: 0 };
	useEffect(() => {
		if (roomGridDiv.current != null && selectedRoom != null && selectedRoom !== suppressScroll.current) {
			suppressScroll.current = null; // Reset scroll suppress in case another room was focused outside
			const roomTile = Array.from(roomGridDiv.current.childNodes)
				.filter((c) => c instanceof HTMLElement)
				.find((c) => c.dataset.roomId === selectedRoom);

			if (roomTile != null) {
				roomTile.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
			}
		}
	}, [selectedRoom, selectedX, selectedY]);

	return (
		<div className='RoomGrid' ref={ roomGridDiv }>
			{
				spaceState.rooms.map((r) => {
					const previewScale = Math.min(previewSize / r.roomBackground.imageSize[0], previewSize / r.roomBackground.imageSize[1]);
					const previewSizeX = Math.ceil(previewScale * r.roomBackground.imageSize[0]);
					const previewSizeY = Math.ceil(previewScale * r.roomBackground.imageSize[1]);

					return (
						<SelectionIndicator
							key={ r.id }
							selected={ r.id === selectedRoom }
							className='room'
							style={ {
								gridColumn: `${ r.position.x - minCoords.x + 1 } / span 1`,
								gridRow: `${ r.position.y - minCoords.y + 1 } / span 1`,
							} }
							data-room-id={ r.id }
						>
							<Button
								slim
								className='IconButton'
								onClick={ () => {
									suppressScroll.current = r.id;
									setSelectedRoom((v) => v === r.id ? null : r.id);
								} }
							>
								<GraphicsSceneBackgroundRenderer
									renderArea={ { x: 0, y: 0, width: previewSizeX, height: previewSizeY } }
									resolution={ 1 }
									backgroundColor={ 0x000000 }
									backgroundAlpha={ 0 }
									forwardContexts={ [serviceManagerContext] }
								>
									<Container
										scale={ { x: previewScale, y: previewScale } }
										x={ (previewSizeX - previewScale * r.roomBackground.imageSize[0]) / 2 }
										y={ (previewSizeY - previewScale * r.roomBackground.imageSize[1]) / 2 }
									>
										<GraphicsBackground
											background={ r.roomBackground }
										/>
									</Container>
								</GraphicsSceneBackgroundRenderer>
								<span className='coordinates'>{ r.position.x }, { r.position.y }</span>
								<span className='label'>{ r.name || r.id }</span>
							</Button>
						</SelectionIndicator>
					);
				})
			}
			{
				(!spaceState.rooms.some((r) => r.position.x === 0 && r.position.y === 0)) ? (
					// Always show 0, 0
					<div
						style={ {
							gridColumn: `${ 0 - minCoords.x + 1 } / span 1`,
							gridRow: `${ 0 - minCoords.y + 1 } / span 1`,
						} }
					/>
				) : null
			}
		</div>
	);
}

function RoomConfiguration({ isEntryRoom, roomState, close }: {
	isEntryRoom: boolean;
	roomState: AssetFrameworkRoomState;
	close: () => void;
}): ReactElement {
	const id = useId();
	const [showBackgrounds, setShowBackgrounds] = useState(false);
	const [name, setName] = useState<string | null>(null);
	const nameValueError = name != null ? FormCreateStringValidator(RoomNameSchema._def.schema.max(LIMIT_ROOM_NAME_LENGTH), 'value')(name) : undefined;
	const [positionChange, setPositionChange] = useState<Immutable<Coordinates> | null>(null);

	return (
		<fieldset className='roomConfiguration'>
			<legend>Room "{ roomState.name || roomState.id }"</legend>
			{ showBackgrounds && <BackgroundSelectDialog
				hide={ () => setShowBackgrounds(false) }
				room={ roomState.id }
				current={ roomState.roomGeometryConfig }
			/> }
			<Column>
				<Row padding='medium' wrap>
					<GameLogicActionButton action={ {
						type: 'spaceRoomLayout',
						subaction: {
							type: 'reorderRoomList',
							id: roomState.id,
							shift: -1,
						},
					} }>
						▲ Reorder higher
					</GameLogicActionButton>
					<GameLogicActionButton action={ {
						type: 'spaceRoomLayout',
						subaction: {
							type: 'reorderRoomList',
							id: roomState.id,
							shift: 1,
						},
					} }>
						▼ Reorder lower
					</GameLogicActionButton>
					<GameLogicActionButton
						action={ {
							type: 'spaceRoomLayout',
							subaction: {
								type: 'deleteRoom',
								id: roomState.id,
							},
						} }
						onExecute={ close }
					>
						<img src={ deleteIcon } alt='Delete action' /> Delete this room
					</GameLogicActionButton>
				</Row>
				{
					isEntryRoom ? (
						<span>Newly joining characters appear in this room</span>
					) : null
				}
				<Column>
					<Row alignY='center'>
						<label htmlFor={ id + ':room-name' }>Room name</label>
						<TextInput
							id={ id + ':room-name' }
							value={ name ?? roomState.name }
							onChange={ setName }
						/>
						<GameLogicActionButton
							action={ {
								type: 'roomConfigure',
								roomId: roomState.id,
								name: name ?? roomState.name,
							} }
							disabled={ name == null || name === roomState.name || nameValueError !== undefined }
						>
							Save
						</GameLogicActionButton>
					</Row>
					{ nameValueError ? (
						<FormError error={ nameValueError } />
					) : null }
				</Column>
				<Column>
					<Row alignY='center'>
						<label>Room position</label>
						<NumberInput
							className='zero-width flex-1'
							value={ (positionChange ?? roomState.position)?.x }
							onChange={ (x) => {
								setPositionChange({
									...(positionChange ?? roomState.position),
									x,
								});
							} }
						/>
						<NumberInput
							className='zero-width flex-1'
							value={ (positionChange ?? roomState.position)?.y }
							onChange={ (y) => {
								setPositionChange({
									...(positionChange ?? roomState.position),
									y,
								});
							} }
						/>
						<GameLogicActionButton
							action={ {
								type: 'spaceRoomLayout',
								subaction: {
									type: 'moveRoom',
									id: roomState.id,
									position: CloneDeepMutable(positionChange ?? roomState.position),
								},
							} }
							disabled={ positionChange == null || isEqual(positionChange, roomState.position) }
						>
							Move
						</GameLogicActionButton>
					</Row>
				</Column>
				<BackgroundInfo background={ roomState.roomBackground } />
				<Button
					onClick={ () => setShowBackgrounds(true) }
				>
					Select a background
				</Button>
			</Column>
		</fieldset>
	);
}

function BackgroundInfo({ background }: { background: Immutable<RoomBackgroundData>; }): ReactElement | null {
	if (background.graphics.type !== 'image' || background.graphics.image.startsWith('#')) {
		return null;
	}

	return (
		<Row alignX='center' className='backgroundInfo'>
			<div className='preview'>
				<img src={ GetAssetsSourceUrl() + background.graphics.image } />
			</div>
		</Row>
	);
}
