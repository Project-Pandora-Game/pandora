import classNames from 'classnames';
import { type Immutable } from 'immer';
import {
	LIMIT_ITEM_SPACE_ITEMS_TOTAL,
	LIMIT_SPACE_ROOM_COUNT,
	SpaceRoomLayoutNeighborRoomCoordinates,
	type AssetFrameworkGlobalState,
	type AssetFrameworkRoomState,
	type AssetFrameworkSpaceState,
	type CardinalDirection,
	type Coordinates,
	type RoomId,
	type RoomLinkNodeData,
} from 'pandora-common';
import { ReactElement, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import plusIcon from '../../../assets/icons/plus.svg';
import settingIcon from '../../../assets/icons/setting.svg';
import { Button } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { SelectionIndicator } from '../../../components/common/selectionIndicator/selectionIndicator.tsx';
import { UsageMeter } from '../../../components/common/usageMeter/usageMeter.tsx';
import { RoomConfiguration } from './roomConfiguration.tsx';
import { RoomConfigurationBackgroundPreview } from './roomConfigurationBackgroundPreview.tsx';
import { RoomCreation } from './roomCreation.tsx';
import { RoomSpaceGlobalSettingsDialog } from './roomSettings.tsx';
import './spaceStateConfiguration.scss';

export type SpaceStateConfigurationUiProps = {
	spaceState: AssetFrameworkSpaceState;
	initialSelectedRoom: RoomId | null;
	getCurrentGlobalState: () => AssetFrameworkGlobalState;
};

export function SpaceStateConfigurationUi({
	spaceState,
	initialSelectedRoom,
	getCurrentGlobalState,
}: SpaceStateConfigurationUiProps): ReactElement {
	const [selectedRoom, setSelectedRoom] = useState<RoomId | null>(() => initialSelectedRoom);
	const [showRoomCreation, setShowRoomCreation] = useState(false);
	const [showGlobalRoomSettings, setShowGlobalRoomSettings] = useState(false);

	const selectedRoomState = selectedRoom == null ? null : spaceState.getRoom(selectedRoom);

	return (
		<Column className='SpaceStateConfigurationUi' alignX='center' gap='none'>
			<Row className='fill-x' padding='small'>
				<Row className='flex-2' alignX='space-evenly' alignY='center'>
					<UsageMeter
						title='Rooms inside the space'
						used={ spaceState.rooms.length }
						limit={ LIMIT_SPACE_ROOM_COUNT }
					/>
					<UsageMeter
						title='Total items across all room inventories'
						used={ spaceState.getTotalItemCount() }
						limit={ LIMIT_ITEM_SPACE_ITEMS_TOTAL }
					/>
				</Row>
				<Row className='flex-1' alignX='start' padding='small'>
					<Button
						className='half-slim align-start'
						onClick={ () => setShowGlobalRoomSettings(true) }
						badge={ Object.keys(spaceState.globalRoomSettings).length || null }
						badgeType='passive'
						badgeTitle='Count of modified settings'
					>
						<img src={ settingIcon } />
						<div>Default room settings</div>
					</Button>
				</Row>
			</Row>
			<Row
				className={ classNames(
					'spaceLayout',
					spaceState.rooms.length === 1 ? 'singleRoom' : null,
				) }>
				<RoomGrid
					spaceState={ spaceState }
					selectedRoom={ selectedRoom }
					setSelectedRoom={ setSelectedRoom }
				/>
				<Column className='roomList fill-y flex-1' padding='medium' overflowY='auto'>
					{
						spaceState.rooms.map((r) => (
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
						spaceState={ spaceState }
						initialPlayerRoom={ initialSelectedRoom }
						close={ () => {
							setShowRoomCreation(false);
						} }
					/>
				) : null }
				{ showGlobalRoomSettings ? (
					<RoomSpaceGlobalSettingsDialog
						spaceState={ spaceState }
						close={ () => {
							setShowGlobalRoomSettings(false);
						} }
					/>
				) : null }
			</Row>
			<hr className='fill-x' />
			<Column className='fill-x fit-x flex-1' alignX='center' padding='medium'>
				{
					selectedRoomState != null ? (
						<RoomConfiguration
							key={ selectedRoomState.id }
							isEntryRoom={ spaceState.rooms[0].id === selectedRoom }
							roomState={ selectedRoomState }
							spaceState={ spaceState }
							getCurrentGlobalState={ getCurrentGlobalState }
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
								title={ r.name || r.id }
								onClick={ () => {
									suppressScroll.current = r.id;
									setSelectedRoom((v) => v === r.id ? null : r.id);
								} }
							>
								<RoomConfigurationBackgroundPreview className='fit' background={ r.roomBackground } previewSize={ 256 } />
								<span className='coordinates'>{ r.position.x }, { r.position.y }</span>
								<div className='overlay'>
									<span className='label'>{ r.name || r.id }</span>
									<GridDirectionArrow roomState={ r } linkData={ r.roomLinkData.N } spaceState={ spaceState } />
									<GridDirectionArrow roomState={ r } linkData={ r.roomLinkData.E } spaceState={ spaceState } />
									<GridDirectionArrow roomState={ r } linkData={ r.roomLinkData.S } spaceState={ spaceState } />
									<GridDirectionArrow roomState={ r } linkData={ r.roomLinkData.W } spaceState={ spaceState } />
								</div>
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

function GridDirectionArrow({ roomState, linkData, spaceState }: { roomState: AssetFrameworkRoomState; linkData: Immutable<RoomLinkNodeData>; spaceState: AssetFrameworkSpaceState; }): ReactNode | null {
	const arrows: Record<CardinalDirection, string> = { N: '↑', E: '→', S: '↓', W: '←' };

	const neighbor = spaceState.getRoomByPosition(SpaceRoomLayoutNeighborRoomCoordinates(roomState.position, linkData.direction));
	if (neighbor == null)
		return null;

	return (
		<div className={ `directionArrow direction-${linkData.direction} state-${linkData.disabled ? 'disabled' : (linkData.useMinimumRole != null && linkData.useMinimumRole !== 'everyone') ? 'limited' : 'enabled'}` }>
			{ linkData.disabled ? '×' : arrows[linkData.direction] }
		</div>
	);
}
