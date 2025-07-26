import classNames from 'classnames';
import type { Immutable } from 'immer';
import {
	LIMIT_ROOM_NAME_LENGTH,
	RoomId,
	RoomNameSchema,
	type AssetFrameworkGlobalState,
	type AssetFrameworkRoomState,
	type RoomBackgroundData,
} from 'pandora-common';
import { ReactElement, useId, useState } from 'react';
import { GetAssetsSourceUrl } from '../../../assets/assetManager.tsx';
import deleteIcon from '../../../assets/icons/delete.svg';
import plusIcon from '../../../assets/icons/plus.svg';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { Button } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { FormCreateStringValidator, FormError } from '../../../components/common/form/form.tsx';
import { GameLogicActionButton } from '../../../components/wardrobe/wardrobeComponents.tsx';
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
				<div className='flex-2' />
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
