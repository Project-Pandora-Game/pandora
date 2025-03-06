import { produce } from 'immer';
import {
	CHARACTER_MODIFIER_TYPE_DEFINITION,
	CharacterModifierTemplateSchema,
	type CharacterModifierId,
	type CharacterModifierTemplate,
	type ModifierConfigurationBase,
	type ModifierConfigurationEntryDefinition,
} from 'pandora-common';
import { ReactElement, useState } from 'react';
import type { ICharacter } from '../../../../character/character';
import { Button } from '../../../common/button/button';
import { Column, Row } from '../../../common/container/container';
import { FieldsetToggle } from '../../../common/fieldsetToggle';
import { ModalDialog } from '../../../dialog/dialog';
import { ImportDialog } from '../../../exportImport/importDialog';
import { ModifierInstanceNameInput } from './characterModifierInstanceDetailsView';
import './characterModifierInstanceView.scss';
import { WardrobeCharacterModifierAddButton, WardrobeCharacterModifierTypeDescription } from './characterModifierTypeDetailsView';
import { CharacterModifierConditionList } from './conditions/characterModifierConditionList';
import { WardrobeCharacterModifierConfig } from './configuration/_index';

export function CharacterModifierImportDialog({ character, close, focusModifierInstance }: {
	character: ICharacter;
	close: () => void;
	focusModifierInstance: (id: CharacterModifierId) => void;
}): ReactElement {
	const [data, setData] = useState<CharacterModifierTemplate | null>(null);

	if (data == null) {
		return (
			<ImportDialog
				expectedType='CharacterModifier'
				expectedVersion={ 1 }
				dataSchema={ CharacterModifierTemplateSchema }
				closeDialog={ () => {
					close();
				} }
				onImport={ (importData) => {
					setData(importData);
				} }
			/>
		);
	}

	return (
		<CharacterModifierImportTemplateDialog
			character={ character }
			template={ data }
			updateTemplate={ (newTemplate) => setData(newTemplate) }
			close={ () => setData(null) }
			focusModifierInstance={ focusModifierInstance }
		/>
	);
}

function CharacterModifierImportTemplateDialog({ character, template, updateTemplate, close, focusModifierInstance }: {
	character: ICharacter;
	template: CharacterModifierTemplate;
	updateTemplate: (newTemplate: CharacterModifierTemplate) => void;
	close: () => void;
	focusModifierInstance: (id: CharacterModifierId) => void;
}): ReactElement {
	const typeDefinition = CHARACTER_MODIFIER_TYPE_DEFINITION[template.type];

	const parsedConfig = typeDefinition.configSchema.safeParse(template.config);

	if (!parsedConfig.success) {
		return (
			<ModalDialog>
				<span>Error loading modifier config from template</span>
				<Row alignX='center'>
					<Button
						onClick={ close }
					>
						◄ Back
					</Button>
				</Row>
			</ModalDialog>
		);
	}

	return (
		<ModalDialog priority={ -1 /* Lowered priority so conditions editing works nicely */ }>
			<Column>
				<Row alignX='start'>
					<Button
						onClick={ close }
					>
						◄ Back
					</Button>
				</Row>
				<span>Modifier "{ typeDefinition.visibleName }"</span>
				<FieldsetToggle legend='Modifier type description' className='wardrobeModifierTypeDescriptionContainer' open={ false }>
					<WardrobeCharacterModifierTypeDescription type={ template.type } />
				</FieldsetToggle>
				<ModifierInstanceNameInput
					modifierTypeVisibleName={ typeDefinition.visibleName }
					value={ template.name }
					onChange={ (newValue) => {
						updateTemplate(produce(template, (d) => {
							d.name = newValue;
						}));
					} }
					instantChange
				/>
				{
					Array.from(Object.entries(typeDefinition.configDefinition))
						.map(([option, optionDefinition]: [string, ModifierConfigurationEntryDefinition]) => (
							<WardrobeCharacterModifierConfig
								key={ option }
								definition={ optionDefinition }
								value={ (parsedConfig.data as ModifierConfigurationBase)[option] }
								onChange={ (newValue) => {
									updateTemplate(produce(template, (d) => {
										d.config[option] = newValue;
									}));
								} }
							/>
						))
				}
				<CharacterModifierConditionList
					character={ character }
					conditions={ template.conditions }
					onChange={ (newValue) => updateTemplate({
						...template,
						conditions: newValue,
					}) }
				/>
				<WardrobeCharacterModifierAddButton
					character={ character }
					modifier={ template }
					onSuccess={ (id) => {
						close();
						focusModifierInstance(id);
					} }
				/>
			</Column>
		</ModalDialog>
	);
}
