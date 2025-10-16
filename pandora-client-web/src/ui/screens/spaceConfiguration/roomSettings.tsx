import classNames from 'classnames';
import { produce, type Immutable } from 'immer';
import { CloneDeepMutable, GAME_LOGIC_ROOM_SETTINGS_DEFAULT, type AppearanceAction, type AssetFrameworkGlobalState, type AssetFrameworkRoomState, type GameLogicRoomSettings, type RoomId } from 'pandora-common';
import { useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { Button } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { Tab, TabContainer } from '../../../components/common/tabs/tabs.tsx';
import { ModalDialog } from '../../../components/dialog/dialog.tsx';
import { ContextHelpButton } from '../../../components/help/contextHelpButton.tsx';
import { ToggleSettingInput, type SettingDriver } from '../../../components/settings/helpers/settingsInputs.tsx';
import { GameLogicActionButton } from '../../../components/wardrobe/wardrobeComponents.tsx';

export function RoomSettingsDialog({ room, globalState, close }: {
	room: AssetFrameworkRoomState;
	globalState: AssetFrameworkGlobalState;
	close: () => void;
}): ReactElement | null {
	const [roomSettingsUpdate, setRoomSettingsUpdate] = useState<Partial<Immutable<GameLogicRoomSettings>> | null>(null);

	const getSettingDriver = useMemo((): RoomSettingsTabProps['getSettingDriver'] => {
		return (function <const Setting extends keyof GameLogicRoomSettings>(setting: Setting): SettingDriver<Immutable<GameLogicRoomSettings>[Setting]> {
			const settings: Partial<Immutable<GameLogicRoomSettings>> = (roomSettingsUpdate ?? room.settings);
			const currentValue: Immutable<GameLogicRoomSettings>[Setting] | undefined = settings[setting];

			return {
				currentValue,
				defaultValue: globalState.space.getEffectiveRoomSettings(null)[setting],
				onChange(newValue) {
					setRoomSettingsUpdate({
						...settings,
						[setting]: newValue,
					});
				},
				onReset() {
					setRoomSettingsUpdate(produce(settings, (d) => {
						delete d[setting];
					}));
				},
			};
		});
	}, [globalState.space, room, roomSettingsUpdate]);

	const updateAction = useMemo((): AppearanceAction | null => {
		if (roomSettingsUpdate == null)
			return null;

		return {
			type: 'roomConfigure',
			roomId: room.id,
			settings: CloneDeepMutable(roomSettingsUpdate),
		};
	}, [room.id, roomSettingsUpdate]);

	const tabProps: RoomSettingsTabProps = {
		roomId: room.id,
		globalState,
		getSettingDriver,
	};

	return (
		<ModalDialog priority={ 1 } className='max-size'>
			<Column className='fill'>
				<h2>Settings of room "{ room.displayName }"</h2>
				<RoomSettingsDialogContent
					{ ...tabProps }
				/>
				<hr className='fill-x' />
				{ updateAction == null ? (
					<Row alignX='center'>
						<Button onClick={ close }>
							Close
						</Button>
					</Row>
				) : (
					<Row alignX='space-between'>
						<Button onClick={ close }>
							Discard changes
						</Button>
						<GameLogicActionButton action={ updateAction } onExecute={ close }>
							Apply settings
						</GameLogicActionButton>
					</Row>
				) }
			</Column>
		</ModalDialog>
	);
}

export function RoomSpaceGlobalSettingsDialog({ globalState, close }: {
	globalState: AssetFrameworkGlobalState;
	close: () => void;
}): ReactElement {
	const [roomSettingsUpdate, setRoomSettingsUpdate] = useState<Partial<Immutable<GameLogicRoomSettings>> | null>(null);

	const getSettingDriver = useMemo((): RoomSettingsTabProps['getSettingDriver'] => {
		return (function <const Setting extends keyof GameLogicRoomSettings>(setting: Setting): SettingDriver<Immutable<GameLogicRoomSettings>[Setting]> {
			const settings: Partial<Immutable<GameLogicRoomSettings>> = roomSettingsUpdate ?? globalState.space.globalRoomSettings;
			const currentValue: Immutable<GameLogicRoomSettings>[Setting] | undefined = settings[setting];

			return {
				currentValue,
				defaultValue: GAME_LOGIC_ROOM_SETTINGS_DEFAULT[setting],
				onChange(newValue) {
					setRoomSettingsUpdate({
						...settings,
						[setting]: newValue,
					});
				},
				onReset() {
					setRoomSettingsUpdate(produce(settings, (d) => {
						delete d[setting];
					}));
				},
			};
		});
	}, [globalState.space, roomSettingsUpdate]);

	const updateAction = useMemo((): AppearanceAction | null => {
		if (roomSettingsUpdate == null)
			return null;

		return {
			type: 'spaceConfigure',
			globalRoomSettings: CloneDeepMutable(roomSettingsUpdate),
		};
	}, [roomSettingsUpdate]);

	const tabProps: RoomSettingsTabProps = {
		roomId: null,
		globalState,
		getSettingDriver,
	};

	return (
		<ModalDialog priority={ 1 } position='top' className='max-size'>
			<Column className='fill'>
				<h2>Default room settings</h2>
				<span>You are changing settings that all rooms in space will use by default. Individual rooms can define their own settings.</span>
				<RoomSettingsDialogContent
					{ ...tabProps }
				/>
				<hr className='fill-x' />
				{ updateAction == null ? (
					<Row alignX='center'>
						<Button onClick={ close }>
							Close
						</Button>
					</Row>
				) : (
					<Row alignX='space-between'>
						<Button onClick={ close }>
							Discard changes
						</Button>
						<GameLogicActionButton action={ updateAction } onExecute={ close }>
							Apply settings
						</GameLogicActionButton>
					</Row>
				) }
			</Column>
		</ModalDialog>
	);
}

function RoomSettingsDialogContent(props: RoomSettingsTabProps): ReactElement {

	return (
		<div
			className='spaceConfigurationScreen flex-1'
		>
			<TabContainer className='flex-1' allowWrap>
				<Tab name='Features'>
					<RoomSettingsTab { ...props } element={ RoomSettingsFeatures } />
				</Tab>
			</TabContainer>
		</div>
	);
}

type RoomSettingsTabProps = {
	roomId: RoomId | null;
	globalState: AssetFrameworkGlobalState;
	getSettingDriver: <const Setting extends keyof GameLogicRoomSettings>(setting: Setting) => SettingDriver<Immutable<GameLogicRoomSettings>[Setting]>;
};

function RoomSettingsTab({ element: Element, ...props }: RoomSettingsTabProps & { element: (props: RoomSettingsTabProps) => ReactElement | null; }): ReactElement {
	return (
		<div className='tab-wrapper'>
			<Column className='flex-1' alignX='center'>
				<Column className='flex-grow-1' alignY='center' padding='large' gap='large'>
					<Element { ...props } />
				</Column>
			</Column>
		</div>
	);
}

function RoomSettingsFeatures({
	roomId,
	getSettingDriver,
}: RoomSettingsTabProps): ReactElement {
	return (
		<fieldset>
			<legend>Chat</legend>
			<Column>
				<Column gap='tiny'>
					<ToggleSettingInput
						driver={ getSettingDriver('itemActionMessages') }
						label={ <>Show an action message when an item is spawned, deleted, equipped or unequipped</> }
					>
						<ContextHelpButton>
							<p>
								This affects if an action message is shown in the following cases:
							</p>
							<ul>
								<li>An item is spawned or deleted</li>
								<li>A body part is changed for another</li>
								<li>An item is equipped on or unequipped from a character</li>
								<li>An item is stored or removed from a storage on a character</li>
								<li>An item is attached or detached from another item (e.g. a lock put into a lock slot)</li>
								<li>A room device is deployed or stowed</li>
							</ul>
						</ContextHelpButton>
					</ToggleSettingInput>
					<GlobalSettingNotice roomId={ roomId } driver={ getSettingDriver('itemActionMessages') } />
				</Column>
				<Column gap='tiny'>
					<ToggleSettingInput
						driver={ getSettingDriver('lockActionMessages') }
						label={ <>Show an action message when a lock is interacted with</> }
					>
						<ContextHelpButton>
							<p>
								This affects if an action message is shown in the following cases:
							</p>
							<ul>
								<li>A lock is locked or unlocked</li>
								<li>An important lock setting is changed (e.g. registered fingerprints for fingerprint lock)</li>
							</ul>
						</ContextHelpButton>
					</ToggleSettingInput>
					<GlobalSettingNotice roomId={ roomId } driver={ getSettingDriver('lockActionMessages') } />
				</Column>
			</Column>
		</fieldset>
	);
}

function GlobalSettingNotice<T>({ roomId, driver }: {
	roomId: RoomId | null;
	driver: Readonly<SettingDriver<T>>;
}): ReactNode | null {
	if (roomId == null)
		return null;

	return (
		<span className={ classNames('fontSize-s text-dim', driver.currentValue !== undefined ? 'invisible' : null) }>
			This setting is using value from this space's "Default room settings"
		</span>
	);
}
