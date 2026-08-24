import { capitalize } from 'lodash-es';
import {
	CharacterId,
	EMPTY,
	KnownObject,
	MakePermissionConfigFromDefault,
	PERMISSION_MAX_CHARACTER_OVERRIDES,
	PermissionConfigChangeSelector,
	PermissionConfigChangeType,
	PermissionGroup,
	PermissionSetup,
	PermissionType,
	PermissionTypeSchema,
} from 'pandora-common';
import { ReactElement, useCallback, useMemo, useState } from 'react';
import { useFunctionBind } from '../../../common/useFunctionBind.ts';
import { useKeyDownEvent } from '../../../common/useKeyDownEvent.ts';
import { Button } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { SelectionIndicator } from '../../../components/common/selectionIndicator/selectionIndicator.tsx';
import { UsageMeter } from '../../../components/common/usageMeter/usageMeter.tsx';
import { ButtonConfirm, ModalDialog } from '../../../components/dialog/dialog.tsx';
import { useShardConnector } from '../../../components/gameContext/shardConnectorContextProvider.tsx';
import { usePermissionConfigDriverSetter, usePermissionGetConfig } from '../../../services/gameLogic/permissionSettingsDriver.ts';
import { CharacterListInputActions } from '..//characterListInput/characterListInput.tsx';
import { PermissionEffectiveAllowOthersIcon } from './permissionAllowOthers.tsx';
import { GetPermissionIcon } from './permissionIcons.tsx';

export function PermissionSettingConfigurationRow({ visibleName, icon, permissionGroup, permissionId }: {
	visibleName: string;
	icon: string;
	permissionGroup: PermissionGroup;
	permissionId: string;
}): ReactElement {
	const [showConfig, setShowConfig] = useState(false);

	return (
		<Row alignY='center' padding='small'>
			{
				icon ? (
					<img src={ GetPermissionIcon(icon) } width='28' height='28' alt='permission icon' />
				) : null
			}
			<label className='flex-1'>
				{ visibleName }
			</label>
			<PermissionEffectiveAllowOthersIcon permissionGroup={ permissionGroup } permissionId={ permissionId } />
			<Button
				className='slim'
				onClick={ () => setShowConfig(true) }
			>
				Edit
			</Button>
			{ showConfig && (
				<PermissionConfigDialog
					hide={ () => setShowConfig(false) }
					permissionGroup={ permissionGroup }
					permissionId={ permissionId }
				/>
			) }
		</Row>
	);
}

function PermissionConfigDialog({ permissionGroup, permissionId, hide }: {
	permissionGroup: PermissionGroup;
	permissionId: string;
	hide: () => void;
}): ReactElement {
	const shardConnector = useShardConnector();
	const permissionData = usePermissionGetConfig(permissionGroup, permissionId);

	const setConfig = usePermissionConfigDriverSetter();
	const setDefault = useFunctionBind(setConfig, permissionGroup, permissionId, 'default');
	const setAny = useFunctionBind(setConfig, permissionGroup, permissionId);

	if (shardConnector == null) {
		return (
			<Row className='flex-1' alignX='center' alignY='center'>
				Error: Not connected
			</Row>
		);
	}
	if (permissionData == null) {
		return (
			<Row className='flex-1' alignX='center' alignY='center'>
				Loading...
			</Row>
		);
	}

	if (permissionData.result !== 'ok') {
		return (
			<Row className='flex-1' alignX='center' alignY='center'>
				Error loading permission: { permissionData.result }
			</Row>
		);
	}

	const {
		permissionSetup,
		permissionConfig,
	} = permissionData;

	const effectiveConfig = permissionConfig ?? MakePermissionConfigFromDefault(permissionSetup.defaultConfig);

	return (
		<ModalDialog>
			<PermissionConfigDialogEscaper hide={ hide } />
			<Row alignX='center'>
				<h2>Editing permission</h2>
			</Row>
			<span>
				Allow other characters to <b>{ permissionSetup.displayName }</b>
			</span>
			<Column padding='large'>
				<Row alignX='space-between' alignY='center'>
					<span>Allow others:</span>
					<Row>
						{ PermissionTypeSchema.options.map((type) => (
							<PermissionAllowOthersSelector key={ type }
								type={ type }
								setConfig={ setDefault }
								effectiveConfig={ effectiveConfig }
								permissionSetup={ permissionSetup }
							/>
						)) }
					</Row>
				</Row>
			</Column>
			<Row padding='medium' alignX='space-between' alignY='center'>
				<Button slim onClick={ () => setDefault(null) }>Reset defaults</Button>
				<Button onClick={ hide }>Close</Button>
			</Row>
			<PermissionConfigOverrides
				overrides={ permissionConfig?.characterOverrides ?? EMPTY }
				limit={ permissionSetup.maxCharacterOverrides ?? PERMISSION_MAX_CHARACTER_OVERRIDES }
				setConfig={ setAny }
			/>
		</ModalDialog>
	);
}

function PermissionConfigOverrides({ overrides, limit, setConfig }: { overrides: Partial<Record<CharacterId, PermissionType>>; limit: number; setConfig: (selector: PermissionConfigChangeSelector, allowOthers: PermissionConfigChangeType) => void; }): ReactElement | null {
	const values = useMemo(() => {
		const result: { allow: CharacterId[]; deny: CharacterId[]; prompt: CharacterId[]; } = { allow: [], deny: [], prompt: [] };
		for (const [characterId, allowOthers] of KnownObject.entries(overrides)) {
			switch (allowOthers) {
				case 'yes':
					result.allow.push(characterId);
					break;
				case 'no':
					result.deny.push(characterId);
					break;
				case 'prompt':
					result.prompt.push(characterId);
					break;
			}
		}
		return {
			allow: result.allow.sort(),
			deny: result.deny.sort(),
			prompt: result.prompt.sort(),
		};
	}, [overrides]);

	return (
		<Column padding='large'>
			<h4>Character based overrides</h4>
			<UsageMeter title='Used' used={ Object.keys(overrides).length } limit={ limit } />
			<br />
			<PermissionConfigOverrideType type='yes' content={ values.allow } setConfig={ setConfig } />
			<br />
			<PermissionConfigOverrideType type='no' content={ values.deny } setConfig={ setConfig } />
			<br />
			<PermissionConfigOverrideType type='prompt' content={ values.prompt } setConfig={ setConfig } />
		</Column>
	);
}

function PermissionConfigOverrideType({ type, content, setConfig }: {
	type: PermissionType;
	content: CharacterId[];
	setConfig: (selector: PermissionConfigChangeSelector, allowOthers: PermissionType | null) => void;
}): ReactElement {
	const onAdd = useCallback((c: CharacterId) => {
		setConfig(c, type);
	}, [setConfig, type]);

	const onRemove = useCallback((c: CharacterId) => {
		setConfig(c, null);
	}, [setConfig]);

	return (
		<>
			<Row>
				<span className='flex-1'>{ capitalize(type) }:</span>
				<ButtonConfirm slim onClick={ () => setConfig('clearOverridesWith', type) }
					title='Clear all overrides'
					content={ `Are you sure you want to clear all overrides with ${type}?` }
				>
					Clear All
				</ButtonConfirm>
			</Row>
			<CharacterListInputActions
				value={ content }
				onAdd={ onAdd }
				onRemove={ onRemove }
				noLimitHeight
				allowSelf='otherCharacter'
			/>
		</>
	);
}

function PermissionAllowOthersSelector({ type, setConfig, effectiveConfig, permissionSetup }: {
	type: PermissionType;
	setConfig: (allowOthers: PermissionType) => void;
	effectiveConfig: { allowOthers: PermissionType; };
	permissionSetup: PermissionSetup;
}): ReactElement {
	const disabled = permissionSetup.forbidDefaultAllowOthers ? permissionSetup.forbidDefaultAllowOthers.includes(type) : false;
	const onClick = useCallback(() => {
		if (disabled)
			return;

		setConfig(type);
	}, [disabled, setConfig, type]);

	return (
		<SelectionIndicator padding='tiny' selected={ effectiveConfig.allowOthers === type }>
			<Button slim className='hideDisabled' onClick={ onClick } disabled={ disabled }>{ type }</Button>
		</SelectionIndicator>
	);
}

function PermissionConfigDialogEscaper({ hide }: { hide: () => void; }): null {
	useKeyDownEvent(useCallback(() => {
		hide();
		return true;
	}, [hide]), 'Escape');

	return null;
}
