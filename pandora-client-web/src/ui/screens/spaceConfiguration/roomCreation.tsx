import { produce, type Immutable } from 'immer';
import {
	AssertNotNullable,
	CloneDeepMutable,
	DEFAULT_ROOM_NEIGHBOR_LINK_CONFIG,
	GenerateSpiralCurve,
	LIMIT_ROOM_DESCRIPTION_LENGTH,
	LIMIT_ROOM_NAME_LENGTH,
	ResolveBackground,
	RoomDescriptionSchema,
	RoomNameSchema,
	RoomTemplateSchema,
	type AppearanceAction,
	type AssetFrameworkGlobalState,
	type Coordinates,
	type RoomTemplate,
} from 'pandora-common';
import { ReactElement, useId, useMemo, useState } from 'react';
import importIcon from '../../../assets/icons/import.svg';
import { useCharacterAppearance } from '../../../character/character.ts';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { TextAreaInput } from '../../../common/userInteraction/input/textAreaInput.tsx';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { Button } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { FormCreateStringValidator, FormError } from '../../../components/common/form/form.tsx';
import { ModalDialog } from '../../../components/dialog/dialog.tsx';
import { ImportDialog } from '../../../components/exportImport/importDialog.tsx';
import { usePlayer } from '../../../components/gameContext/playerContextProvider.tsx';
import { GameLogicActionButton } from '../../../components/wardrobe/wardrobeComponents.tsx';
import { BackgroundSelectUi } from './backgroundSelect.tsx';
import { RoomConfigurationBackgroundPreview } from './roomConfiguration.tsx';

export function RoomCreation({ globalState, close }: {
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
		description: '',
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

	const nameValueError = FormCreateStringValidator(RoomNameSchema.def.in.max(LIMIT_ROOM_NAME_LENGTH), 'value')(roomTemplate.name);
	const descriptionValueError = FormCreateStringValidator(RoomDescriptionSchema.def.in.max(LIMIT_ROOM_DESCRIPTION_LENGTH), 'value')(roomTemplate.description);
	const roomBackground = useMemo(() => ResolveBackground(globalState.assetManager, roomTemplate.roomGeometry), [globalState.assetManager, roomTemplate.roomGeometry]);

	const newRoomAction = useMemo((): AppearanceAction => ({
		type: 'spaceRoomLayout',
		subaction: {
			type: 'createRoom',
			template: CloneDeepMutable(roomTemplate),
			position: CloneDeepMutable(position),
			direction: 'N', // TODO
			settings: {},
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
							className='flex-1'
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
					<label htmlFor={ id + ':room-description' }>Description ({ roomTemplate.description.length }/{ LIMIT_ROOM_DESCRIPTION_LENGTH } characters):</label>
					<TextAreaInput
						id={ id + ':room-description' }
						value={ roomTemplate.description }
						rows={ 10 }
						maxLength={ LIMIT_ROOM_DESCRIPTION_LENGTH }
						onChange={ (newValue) => {
							setRoomTemplate((t) => produce(t, (d) => {
								d.description = newValue;
							}));
						} }
					/>
					{ descriptionValueError ? (
						<FormError error={ descriptionValueError } />
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
					<RoomConfigurationBackgroundPreview
						background={ roomBackground }
						previewSize={ 384 }
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
