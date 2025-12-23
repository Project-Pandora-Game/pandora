import classNames from 'classnames';
import { isEqual } from 'lodash-es';
import {
	CHARACTER_MODIFIER_TYPE_DEFINITION,
	CharacterModifierTemplate,
	CloneDeepMutable,
	type CharacterModifierId,
	type CharacterModifierType,
} from 'pandora-common';
import { ReactElement, useMemo, useState } from 'react';
import { useAssetManager } from '../../../../assets/assetManager.tsx';
import type { Character } from '../../../../character/character.ts';
import { Column } from '../../../common/container/container.tsx';
import { PermissionSettingEntry } from '../../../settings/permissionsSettings.tsx';
import { CharacterModifierImportTemplateDialog } from './characterModifierImport.tsx';
import { WardrobeCharacterModifierAddButton, WardrobeCharacterModifierTypeDescription } from './characterModifierTypeComponents.tsx';
import './characterModifierTypeDetailsView.scss';

export function WardrobeCharacterModifierTypeDetailsView({ type, character, focusModifierInstance }: {
	type: CharacterModifierType;
	character: Character;
	focusModifierInstance: (id: CharacterModifierId) => void;
}): ReactElement | null {
	const typeDefinition = CHARACTER_MODIFIER_TYPE_DEFINITION[type];

	const modifier = useMemo((): CharacterModifierTemplate => ({
		type,
		name: '',
		config: {},
		conditions: [],
	}), [type]);

	return (
		<div className='inventoryView wardrobeModifierTypeDetails'>
			<div className='toolbar'>
				<span>Modifier "{ typeDefinition.visibleName }"</span>
			</div>
			<Column padding='large' gap='large' overflowY='auto'>
				<WardrobeCharacterModifierTypeDescription type={ type } />
				<WardrobeCharacterModifierAddButton
					character={ character }
					modifier={ modifier }
					onSuccess={ focusModifierInstance }
				/>
				{
					character.isPlayer() ? (
						<fieldset className='modifierPermission'>
							<legend>Permission</legend>
							<PermissionSettingEntry
								visibleName={ `Allow other characters to add or configure "${ typeDefinition.visibleName }" modifiers` }
								icon=''
								permissionGroup='characterModifierType'
								permissionId={ type }
							/>
						</fieldset>
					) : null
				}
				<WardrobeCharacterModifierTypeInbuiltTemplates
					type={ type }
					character={ character }
					focusModifierInstance={ focusModifierInstance }
				/>
			</Column>
		</div>
	);
}

export function WardrobeCharacterModifierTypeInbuiltTemplates({ type, character, focusModifierInstance }: {
	type: CharacterModifierType;
	character: Character;
	focusModifierInstance: (id: CharacterModifierId) => void;
}): ReactElement | null {
	const [selectedTemplate, setSelectedTemplate] = useState<CharacterModifierTemplate | null>(null);
	const assetManager = useAssetManager();

	const templates = assetManager.characterModifierTemplates[type];

	if (templates == null || templates.length === 0)
		return null;

	return (
		<>
			<fieldset>
				<legend>Preconfigured templates by Pandora</legend>
				<Column>
					{
						templates.map((t, i) => (
							<button
								key={ i }
								className={ classNames(
									'inventoryViewItem',
									'listMode',
									'sidePadding',
									'small',
									isEqual(selectedTemplate, t) ? 'selected' : null,
									'allowed',
								) }
								tabIndex={ 0 }
								onClick={ () => setSelectedTemplate(CloneDeepMutable(t)) }
							>
								<span className='itemName'>{ t.name }</span>
							</button>
						))
					}
				</Column>
			</fieldset>
			{
				selectedTemplate != null ? (
					<CharacterModifierImportTemplateDialog
						character={ character }
						template={ selectedTemplate }
						updateTemplate={ (newTemplate) => setSelectedTemplate(newTemplate) }
						close={ () => setSelectedTemplate(null) }
						focusModifierInstance={ focusModifierInstance }
					/>
				) : null
			}
		</>
	);
}
