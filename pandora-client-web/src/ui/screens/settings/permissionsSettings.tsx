import type { Immutable } from 'immer';
import {
	ASSET_PREFERENCES_PERMISSIONS,
	AssetPreferenceType,
	CHARACTER_MODIFIER_TYPE_DEFINITION,
	CharacterId,
	CharacterIdSchema,
	CompareCharacterIds,
	IInteractionConfig,
	INTERACTION_CONFIG,
	INTERACTION_IDS,
	InteractionId,
	KnownObject,
	MakePermissionConfigFromDefault,
	PermissionGroup,
	PermissionType,
	PermissionTypeSchema,
} from 'pandora-common';
import { ReactElement, useCallback, useMemo, useState } from 'react';
import { useKeyDownEvent } from '../../../common/useKeyDownEvent.ts';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { Button } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { GridContainer } from '../../../components/common/container/gridContainer.tsx';
import { FieldsetToggle } from '../../../components/common/fieldsetToggle/fieldsetToggle.tsx';
import { SelectionIndicator } from '../../../components/common/selectionIndicator/selectionIndicator.tsx';
import { ButtonConfirm, DialogHeader, ModalDialog } from '../../../components/dialog/dialog.tsx';
import { usePlayer } from '../../../components/gameContext/playerContextProvider.tsx';
import { useResolveCharacterName, useSpaceCharacters } from '../../../services/gameLogic/gameStateHooks.ts';
import { usePermissionConfigDriverSetter, usePermissionGetConfig } from '../../../services/gameLogic/permissionSettingsDriver.ts';
import { WikiButton } from '../../components/help/wikiButton.tsx';
import { PermissionSettingConfigurationRow } from '../../components/settings/permissionConfig.tsx';
import { GetPermissionIcon } from '../../components/settings/permissionIcons.tsx';
import './permissionsSettings.scss';

export function PermissionsSettings(): ReactElement | null {
	const player = usePlayer();

	if (!player)
		return <>No character selected</>;

	return (
		<>
			<InteractionPermissions />
			<ItemLimitsPermissions />
			<PerCharacterPermissionsSection />
		</>
	);
}

function InteractionPermissions(): ReactElement {

	return (
		<fieldset>
			<legend>Interaction permissions</legend>
			<Row alignX='space-between' alignY='center' className='flex-1'>
				<i>Allow other characters to...</i>
				<WikiButton link='/wiki/characters#CH_Character_permissions' />
			</Row>
			<Column gap='none' className='permission-list'>
				{
					INTERACTION_IDS.map((id) => (
						<InteractionSettings key={ id } id={ id } />
					))
				}
			</Column>
		</fieldset>
	);
}

function InteractionSettings({ id }: { id: InteractionId; }): ReactElement {
	const config: Immutable<IInteractionConfig> = INTERACTION_CONFIG[id];

	return (
		<PermissionSettingConfigurationRow
			visibleName={ config.visibleName }
			icon={ config.icon }
			permissionGroup='interaction'
			permissionId={ id }
		/>
	);
}

function ItemLimitsPermissions(): ReactElement {
	return (
		<fieldset>
			<legend>Item limits</legend>
			<i>Allow other characters to interact with worn items and to add new items that are marked in the item limits as...</i>
			<Column gap='none' className='permission-list'>
				{
					KnownObject.keys(ASSET_PREFERENCES_PERMISSIONS).map((group) => (
						<ItemLimitsSettings key={ group } group={ group } />
					))
				}
			</Column>
		</fieldset>
	);
}

function ItemLimitsSettings({ group }: { group: AssetPreferenceType; }): ReactElement | null {
	const config = ASSET_PREFERENCES_PERMISSIONS[group];

	if (config == null)
		return null;

	return (
		<PermissionSettingConfigurationRow
			visibleName={ config.visibleName }
			icon={ config.icon }
			permissionGroup='assetPreferences'
			permissionId={ group }
		/>
	);
}

function ResolvedNamePreview({ characterId }: { characterId: CharacterId | null; }): ReactElement {
	const resolvedName = useResolveCharacterName(characterId);

	return <span>{ characterId == null ? '...' : (resolvedName ?? '[unknown]') }</span>;
}

function PerCharacterPermissionsSection(): ReactElement {
	const [selectedCharacter, setSelectedCharacter] = useState<CharacterId | null>(null);

	const rawCharacters = useSpaceCharacters();
	const spaceCharacters = useMemo(() =>
		rawCharacters
			.filter((c) => !c.isPlayer())
			.sort((a, b) => {
				return a.name.localeCompare(b.name) ||
					CompareCharacterIds(a.id, b.id);
			}),
	[rawCharacters]);

	const [inputValue, setInputValue] = useState('');
	const parsedInput = useMemo(() => {
		const r = CharacterIdSchema.safeParse(/^[0-9]+$/.test(inputValue) ? `c${inputValue}` : inputValue);
		return r.success ? r.data : null;
	}, [inputValue]);

	return (
		<fieldset>
			<legend>Permission overview for a specific character</legend>
			<span><i>Check and adjust every permission for the character selected by their ID below:</i></span>
			<Column padding='small' gap='large'>
				<Column alignX='start'>
					<GridContainer templateColumns='auto auto' templateRows='auto auto' alignItemsY='center'>
						<label>Name:</label>
						<ResolvedNamePreview characterId={ parsedInput } />
						<label>Character ID:</label>
						<Row alignY='center'>
							<TextInput
								value={ inputValue }
								onChange={ setInputValue }
							/>
							<Button
								slim
								disabled={ parsedInput == null }
								onClick={ () => {
									if (parsedInput != null) {
										setSelectedCharacter(parsedInput);
										setInputValue('');
									}
								} }
							>
								Select
							</Button>
						</Row>
					</GridContainer>
				</Column>
				<fieldset>
					<legend>Quick selection</legend>
					<Column alignX='start'>
						{ spaceCharacters.map((c) => (
							<Button
								key={ c.id }
								slim
								onClick={ () => {
									setInputValue('');
									setSelectedCharacter(c.id);
								} }
							>
								{ c.name } ({ c.id })
							</Button>
						)) }
					</Column>
				</fieldset>
			</Column>
			{ selectedCharacter != null && (
				<PerCharacterPermissionsDialog
					characterId={ selectedCharacter }
					hide={ () => setSelectedCharacter(null) }
				/>
			) }
		</fieldset>
	);
}

function PerCharacterPermissionsDialog({
	characterId,
	hide,
}: {
	characterId: CharacterId;
	hide: () => void;
}): ReactElement {
	const resolvedName = useResolveCharacterName(characterId);
	const setConfig = usePermissionConfigDriverSetter();

	// Set non-default value for a single permission
	const setOverride = useCallback((group: PermissionGroup, id: string, value: PermissionType | null) => {
		setConfig(group, id, characterId, value);
	}, [setConfig, characterId]);

	// Reset all permissions for this character
	const resetAll = useCallback(() => {
		for (const id of INTERACTION_IDS) {
			setConfig('interaction', id, characterId, null);
		}
		for (const group of KnownObject.keys(ASSET_PREFERENCES_PERMISSIONS)) {
			setConfig('assetPreferences', group, characterId, null);
		}
		for (const typeId of KnownObject.keys(CHARACTER_MODIFIER_TYPE_DEFINITION)) {
			setConfig('characterModifierType', typeId, characterId, null);
		}
	}, [setConfig, characterId]);

	return (
		<ModalDialog rawContent className='PerCharacterPermissionsDialog'>
			<DialogHeader
				title={ `Permissions for ${ resolvedName ?? '[unknown]' } (${ characterId })` }
				close={ hide }
			/>
			<div className='dialog-content overflow-auto' >
				<Column alignX='start' padding='medium'>
					<ButtonConfirm
						theme='danger'
						onClick={ resetAll }
						title='Reset all to default'
						content={ `Reset every permission granted to ${resolvedName ?? characterId} to the default value?` }
					>
						Reset all to default
					</ButtonConfirm>
				</Column>

				<PermissionConfigDialogEscaper hide={ hide } />
				<Column padding='medium' gap='large'>

					<FieldsetToggle legend='Interaction permissions'>
						<Column gap='none' className='permission-list'>
							{ INTERACTION_IDS.map((id) => (
								<PerCharacterPermissionRow
									key={ id }
									visibleName={ INTERACTION_CONFIG[id].visibleName }
									icon={ INTERACTION_CONFIG[id].icon }
									permissionGroup='interaction'
									permissionId={ id }
									characterId={ characterId }
									setOverride={ setOverride }
								/>
							)) }
						</Column>
					</FieldsetToggle>

					<FieldsetToggle legend='Item limits'>
						<Column gap='none' className='permission-list'>
							{ KnownObject.entries(ASSET_PREFERENCES_PERMISSIONS).map(([group, config]) => {
								if (config == null) return null;
								return (
									<PerCharacterPermissionRow
										key={ group }
										visibleName={ config.visibleName }
										icon={ config.icon }
										permissionGroup='assetPreferences'
										permissionId={ group }
										characterId={ characterId }
										setOverride={ setOverride }
									/>
								);
							}) }
						</Column>
					</FieldsetToggle>

					<FieldsetToggle legend='Character modifier permissions'>
						<Column gap='none' className='permission-list'>
							{ KnownObject.keys(CHARACTER_MODIFIER_TYPE_DEFINITION).map((typeId) => (
								<PerCharacterPermissionRow
									key={ typeId }
									visibleName={ CHARACTER_MODIFIER_TYPE_DEFINITION[typeId].visibleName }
									icon=''
									permissionGroup='characterModifierType'
									permissionId={ typeId }
									characterId={ characterId }
									setOverride={ setOverride }
								/>
							)) }
						</Column>
					</FieldsetToggle>
				</Column>
			</div>
		</ModalDialog>
	);
}

function PermissionConfigDialogEscaper({ hide }: { hide: () => void; }): null {
	useKeyDownEvent(useCallback(() => {
		hide();
		return true;
	}, [hide]), 'Escape');

	return null;
}

function PerCharacterPermissionRow({
	visibleName,
	icon,
	permissionGroup,
	permissionId,
	characterId,
	setOverride,
}: {
	visibleName: string;
	icon: string;
	permissionGroup: PermissionGroup;
	permissionId: string;
	characterId: CharacterId;
	setOverride: (group: PermissionGroup, id: string, value: PermissionType | null) => void;
}): ReactElement {
	const permissionData = usePermissionGetConfig(permissionGroup, permissionId);

	if (permissionData == null) {
		return (
			<Row alignY='center' padding='small'>
				{ icon ? <img src={ GetPermissionIcon(icon) } width='28' height='28' alt='permission icon' /> : null }
				<span className='flex-1'>{ visibleName }</span>
				<span>Loading…</span>
			</Row>
		);
	}

	if (permissionData.result !== 'ok') {
		return (
			<Row alignY='center' padding='small'>
				{ icon ? <img src={ GetPermissionIcon(icon) } width='28' height='28' alt='permission icon' /> : null }
				<span className='flex-1'>{ visibleName }</span>
				<span>Error: { permissionData.result }</span>
			</Row>
		);
	}

	const { permissionSetup, permissionConfig } = permissionData;
	const defaultConfig = MakePermissionConfigFromDefault(permissionSetup.defaultConfig);
	const defaultPermission: PermissionType = permissionConfig?.allowOthers ?? defaultConfig.allowOthers;
	const characterOverride: PermissionType | undefined = permissionConfig?.characterOverrides[characterId];

	return (
		<Row alignY='center' padding='small' gap='small'>
			{ icon ? <img src={ GetPermissionIcon(icon) } width='28' height='28' alt='permission icon' /> : null }

			<span className='flex-1'>{ visibleName } </span>

			{ PermissionTypeSchema.options.map((type) => {
				const isBase = type === defaultPermission;
				return (
					<SelectionIndicator key={ type } padding='tiny' selected={ characterOverride === type } active={ characterOverride == null && isBase }>
						<Button
							slim
							className={ isBase ? 'permission-base-highlight' : undefined }
							onClick={ () => {
								if (type === defaultPermission) {
									setOverride(permissionGroup, permissionId, null);
								} else {
									setOverride(permissionGroup, permissionId, type);
								}
							} }
						>
							{ type }
						</Button>
					</SelectionIndicator>
				);
			}) }

			<Button
				slim
				style={ characterOverride != null ? undefined : { visibility: 'hidden' } }
				title={ `Remove non-default permission and change it back to '${defaultPermission}'` }
				onClick={ () => setOverride(permissionGroup, permissionId, null) }
			>
				↩ reset
			</Button>
		</Row>
	);
}
