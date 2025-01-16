import classNames from 'classnames';
import {
	Asset,
	CHARACTER_MODIFIER_TYPE_DEFINITION,
	ItemContainerPath,
	KnownObject,
	type CharacterModifierTypeDefinition,
} from 'pandora-common';
import React, { ReactElement, ReactNode, useMemo, useRef, useState } from 'react';
import { TextInput } from '../../../common/userInteraction/input/textInput';
import { useInputAutofocus } from '../../../common/userInteraction/inputAutofocus';

export interface WardrobeAssetListItemProps {
	asset: Asset;
	container: ItemContainerPath;
}

export function WardrobeCharacterModifierTypeView({ title, children }: {
	title: string;
	children?: ReactNode;
	itemSortIgnorePreferenceOrdering?: boolean;
}): ReactElement | null {
	const [filter, setFilter] = useState('');

	const flt = filter.toLowerCase().trim().split(/\s+/);
	const filteredModifierTypes = useMemo((): CharacterModifierTypeDefinition[] => (
		KnownObject.values(CHARACTER_MODIFIER_TYPE_DEFINITION)
			.filter((modifierType) => flt.every((f) => {
				return modifierType.visibleName.toLowerCase().includes(f);
			}))
	), [flt]);

	const sortedModifierTypes = filteredModifierTypes; // TODO

	const filterInput = useRef<TextInput>(null);
	useInputAutofocus(filterInput);

	return (
		<div className='inventoryView wardrobeAssetList'>
			<div className='toolbar'>
				<span>{ title }</span>
				<div className='filter'>
					<TextInput ref={ filterInput }
						placeholder='Filter by name'
						value={ filter }
						onChange={ setFilter }
					/>
				</div>
			</div>
			{ children }
			<div className='listContainer'>
				<div className='Scrollbar'>
					<div className={ 'list' }>
						{
							sortedModifierTypes.map((m) => (
								<ModifierTypesListItem
									key={ m.typeId }
									modifier={ m }
								/>
							))
						}
					</div>
				</div>
			</div>
		</div>
	);
}

function ModifierTypesListItem({ modifier }: {
	modifier: CharacterModifierTypeDefinition;
}): ReactElement {
	// TODO: const preference = useAssetPreference(asset);

	return (
		<div
			className={ classNames(
				'inventoryViewItem',
				'listMode',
				'small',
				'allowed',
				// `pref-${preference}`,
			) }
			tabIndex={ 0 }
			onClick={ () => {
				// TODO
			} }>
			<span className='itemName'>{ modifier.visibleName }</span>
		</div>
	);
}
