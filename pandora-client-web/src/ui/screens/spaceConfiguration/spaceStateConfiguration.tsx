import classNames from 'classnames';
import { produce, type Immutable } from 'immer';
import { isEqual } from 'lodash-es';
import {
	AssertNotNullable,
	CARDINAL_DIRECTION_NAMES,
	CardinalDirectionSchema,
	CloneDeepMutable,
	DEFAULT_ROOM_NEIGHBOR_LINK_CONFIG,
	GenerateSpiralCurve,
	LIMIT_ROOM_NAME_LENGTH,
	ResolveBackground,
	RoomId,
	RoomNameSchema,
	RoomTemplateSchema,
	type AppearanceAction,
	type AssetFrameworkGlobalState,
	type AssetFrameworkRoomState,
	type AssetFrameworkSpaceState,
	type CardinalDirection,
	type Coordinates,
	type RoomBackgroundData,
	type RoomTemplate,
} from 'pandora-common';
import { ReactElement, useEffect, useId, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import deleteIcon from '../../../assets/icons/delete.svg';
import exportIcon from '../../../assets/icons/export.svg';
import importIcon from '../../../assets/icons/import.svg';
import plusIcon from '../../../assets/icons/plus.svg';
import { useCharacterAppearance } from '../../../character/character.ts';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { Select } from '../../../common/userInteraction/select/select.tsx';
import { Button } from '../../../components/common/button/button.tsx';
import { Column, DivContainer, Row } from '../../../components/common/container/container.tsx';
import { FormCreateStringValidator, FormError } from '../../../components/common/form/form.tsx';
import { SelectionIndicator } from '../../../components/common/selectionIndicator/selectionIndicator.tsx';
import { ModalDialog } from '../../../components/dialog/dialog.tsx';
import { ExportDialog } from '../../../components/exportImport/exportDialog.tsx';
import { ImportDialog } from '../../../components/exportImport/importDialog.tsx';
import { usePlayer } from '../../../components/gameContext/playerContextProvider.tsx';
import { GameLogicActionButton } from '../../../components/wardrobe/wardrobeComponents.tsx';
import { Container } from '../../../graphics/baseComponents/container.ts';
import { GraphicsBackground } from '../../../graphics/graphicsBackground.tsx';
import { GraphicsSceneBackgroundRenderer } from '../../../graphics/graphicsSceneRenderer.tsx';
import { serviceManagerContext } from '../../../services/serviceProvider.tsx';
import { BackgroundSelectDialog, BackgroundSelectUi } from './backgroundSelect.tsx';
import './spaceStateConfiguration.scss';

export type SpaceStateConfigurationUiProps = {
	globalState: AssetFrameworkGlobalState;
};

export function SpaceStateConfigurationUi({
	globalState,
}: SpaceStateConfigurationUiProps): ReactElement {
	const [selectedRoom, setSelectedRoom] = useState<RoomId | null>(globalState.space.rooms.length === 1 ? globalState.space.rooms[0].id : null);
	const [showRoomCreation, setShowRoomCreation] = useState(false);

	const selectedRoomState = selectedRoom == null ? null : globalState.space.getRoom(selectedRoom);

	return (
		<Column className='SpaceStateConfigurationUi' alignX='center'>
			<Row
				className={ classNames(
					'spaceLayout',
					globalState.space.rooms.length === 1 ? 'singleRoom' : null,
				) }>
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
					<button
						className={ classNames(
							'wardrobeActionButton',
							'roomListItem',
							showRoomCreation ? 'selected' : null,
							'allowed',
						) }
						onClick={ () => {
							setShowRoomCreation(true);
						} }
					>
						<img src={ plusIcon } className='icon' alt='Create room' />
						<span className='name'>Create a new room</span>
					</button>
				</Column>
				{ showRoomCreation ? (
					<RoomCreation
						globalState={ globalState }
						close={ () => {
							setShowRoomCreation(false);
						} }
					/>
				) : null }
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
								<BackgroundPreview background={ r.roomBackground } previewSize={ 256 * (window.devicePixelRatio || 1) } />
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
	const [directionChange, setDirectionChange] = useState<CardinalDirection | null>(null);

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
					<RoomExportButton roomState={ roomState } />
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
				<Row>
					<Column className='flex-1'>
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
						</Row>
						<Row alignY='center'>
							<label htmlFor={ id + ':room-name' }>Far wall direction</label>
							<Select
								className='flex-1'
								value={ directionChange ?? roomState.direction }
								onChange={ (ev) => {
									const value = ev.target.value;
									setDirectionChange(CardinalDirectionSchema.parse(value));
								} }
							>
								{
									CardinalDirectionSchema.options.map((d) => (
										<option key={ d } value={ d }>{ CARDINAL_DIRECTION_NAMES[d] }</option>
									))
								}
							</Select>
						</Row>
					</Column>
					<GameLogicActionButton
						action={ {
							type: 'spaceRoomLayout',
							subaction: {
								type: 'moveRoom',
								id: roomState.id,
								position: CloneDeepMutable(positionChange ?? roomState.position),
								direction: CloneDeepMutable(directionChange ?? roomState.direction),
							},
						} }
						disabled={ (positionChange == null || isEqual(positionChange, roomState.position)) &&
							(directionChange == null || directionChange === roomState.direction) }
					>
						Move
					</GameLogicActionButton>
				</Row>
				<Column>
				</Column>
				<Row alignY='start'>
					<Button
						onClick={ () => setShowBackgrounds(true) }
					>
						Select a background
					</Button>
					<BackgroundPreview
						background={ roomState.roomBackground }
						previewSize={ 384 * (window.devicePixelRatio || 1) }
						className='flex-1'
					/>
				</Row>
			</Column>
		</fieldset>
	);
}

function RoomCreation({ globalState, close }: {
	globalState: AssetFrameworkGlobalState;
	close: () => void;
}): ReactElement {
	const id = useId();
	const [showBackgrounds, setShowBackgrounds] = useState(false);
	const [showImportDialog, setShowImportDialog] = useState(false);

	const player = usePlayer();
	AssertNotNullable(player);
	const playerAppearance = useCharacterAppearance(globalState, player);

	const [roomTemplate, setRoomTemplate] = useState((): RoomTemplate => ({
		name: '',
		items: [],
		roomGeometry: {
			type: 'defaultPublicSpace',
		},
		roomLinkNodes: CloneDeepMutable(DEFAULT_ROOM_NEIGHBOR_LINK_CONFIG),
	}));
	const [position, setPosition] = useState((): Immutable<Coordinates> => {
		const playerRoom = playerAppearance.getCurrentRoom();

		for (const c of GenerateSpiralCurve(playerRoom?.position.x ?? 0, playerRoom?.position.y ?? 0)) {
			if (!globalState.space.rooms.some((r) => r.position.x === c.x && r.position.y === c.y)) {
				return c;
			}
		}

		return { x: 0, y: 0 };
	});

	const nameValueError = FormCreateStringValidator(RoomNameSchema._def.schema.max(LIMIT_ROOM_NAME_LENGTH), 'value')(roomTemplate.name);
	const roomBackground = useMemo(() => ResolveBackground(globalState.assetManager, roomTemplate.roomGeometry), [globalState.assetManager, roomTemplate.roomGeometry]);

	const newRoomAction = useMemo((): AppearanceAction => ({
		type: 'spaceRoomLayout',
		subaction: {
			type: 'createRoom',
			template: CloneDeepMutable(roomTemplate),
			position: CloneDeepMutable(position),
			direction: 'N', // TODO
		},
	}), [roomTemplate, position]);

	if (showImportDialog) {
		return (
			<ImportDialog
				expectedType='RoomTemplate'
				expectedVersion={ 1 }
				dataSchema={ RoomTemplateSchema }
				closeDialog={ () => {
					setShowImportDialog(false);
				} }
				onImport={ (importData) => {
					setRoomTemplate(importData);
					setShowImportDialog(false);
				} }
			/>
		);
	}

	return (
		<ModalDialog priority={ 1 } position='top'>
			{ showBackgrounds ? (
				<ModalDialog position='top' priority={ 3 }>
					<BackgroundSelectUi
						value={ roomTemplate.roomGeometry }
						onChange={ (newGeometry) => {
							setRoomTemplate((v) => produce(v, (d) => {
								d.roomGeometry = CloneDeepMutable(newGeometry);
							}));
						} }
					/>
					<Row className='fill-x' padding='medium' alignX='space-around'>
						<Button
							onClick={ () => {
								setShowBackgrounds(false);
							} }>
							Close
						</Button>
					</Row>
				</ModalDialog>
			) : null }
			<Column>
				<Row padding='medium' alignX='end'>
					<Button
						onClick={ () => setShowImportDialog(true) }
					>
						<img src={ importIcon } alt='Import' crossOrigin='anonymous' /> Import
					</Button>
				</Row>
				<Column>
					<Row alignY='center'>
						<label htmlFor={ id + ':room-name' }>Room name</label>
						<TextInput
							id={ id + ':room-name' }
							value={ roomTemplate.name }
							onChange={ (newValue) => {
								setRoomTemplate((t) => produce(t, (d) => {
									d.name = newValue;
								}));
							} }
						/>
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
							value={ position.x }
							onChange={ (x) => {
								setPosition({
									...position,
									x,
								});
							} }
						/>
						<NumberInput
							className='zero-width flex-1'
							value={ position.y }
							onChange={ (y) => {
								setPosition({
									...position,
									y,
								});
							} }
						/>
					</Row>
				</Column>
				<Row alignY='start'>
					<Button
						onClick={ () => setShowBackgrounds(true) }
					>
						Select a background
					</Button>
					<BackgroundPreview
						background={ roomBackground }
						previewSize={ 384 * (window.devicePixelRatio || 1) }
						className='flex-1'
					/>
				</Row>
				<Row alignX='space-between' padding='medium'>
					<Button
						onClick={ close }
					>
						Cancel
					</Button>
					<GameLogicActionButton
						action={ newRoomAction }
						onExecute={ close }
						disabled={ nameValueError != null }
					>
						Create room
					</GameLogicActionButton>
				</Row>
			</Column>
		</ModalDialog>
	);
}

function BackgroundPreview({ background, previewSize, className }: {
	background: Immutable<RoomBackgroundData> | null;
	previewSize: number;
	className?: string;
}): ReactElement | null {
	if (background == null) {
		return null;
	}

	const previewScale = Math.min(previewSize / background.imageSize[0], previewSize / background.imageSize[1]);
	const previewSizeX = Math.ceil(previewScale * background.imageSize[0]);
	const previewSizeY = Math.ceil(previewScale * background.imageSize[1]);

	return (
		<DivContainer className={ classNames('RoomConfigurationBackgroundPreview', className) }>
			<GraphicsSceneBackgroundRenderer
				renderArea={ { x: 0, y: 0, width: previewSizeX, height: previewSizeY } }
				resolution={ 1 }
				backgroundColor={ 0x000000 }
				backgroundAlpha={ 0 }
				forwardContexts={ [serviceManagerContext] }
			>
				<Container
					scale={ { x: previewScale, y: previewScale } }
					x={ (previewSizeX - previewScale * background.imageSize[0]) / 2 }
					y={ (previewSizeY - previewScale * background.imageSize[1]) / 2 }
				>
					<GraphicsBackground
						background={ background }
					/>
				</Container>
			</GraphicsSceneBackgroundRenderer>
		</DivContainer>
	);
}

function RoomExportButton({ roomState }: {
	roomState: AssetFrameworkRoomState;
}): ReactElement {
	const [showExportDialog, setShowExportDialog] = useState(false);
	const roomTemplate = useMemo(() => roomState.exportToTemplate({ includeAllItems: true }), [roomState]);

	return (
		<>
			<button
				className='wardrobeActionButton allowed'
				onClick={ () => {
					setShowExportDialog(true);
				} }
			>
				<img src={ exportIcon } alt='Export room' />&nbsp;Export
			</button>
			{
				showExportDialog ? (
					<ExportDialog
						exportType='RoomTemplate'
						exportVersion={ 1 }
						dataSchema={ RoomTemplateSchema }
						data={ roomTemplate }
						closeDialog={ () => setShowExportDialog(false) }
					/>
				) : null
			}
		</>
	);
}
