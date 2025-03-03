import classNames from 'classnames';
import {
	CHARACTER_MODIFIER_TYPE_DEFINITION,
	KnownObject,
	type CharacterModifierType,
	type CharacterModifierTypeDefinition,
} from 'pandora-common';
import { ReactElement, ReactNode, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import wikiIcon from '../../../../assets/icons/wiki.svg';
import { TextInput } from '../../../../common/userInteraction/input/textInput';
import { useInputAutofocus } from '../../../../common/userInteraction/inputAutofocus';
import { Row } from '../../../common/container/container';

export function WardrobeCharacterModifierTypeView({ title, currentlyFocusedModifier, focusModifier, children }: {
	title: string;
	currentlyFocusedModifier: CharacterModifierType | null;
	focusModifier: (type: CharacterModifierType | null) => void;
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
		<div className='inventoryView wardrobeModifierTypeList'>
			<div className='toolbar'>
				<Row alignY='center' className='flex-1'>
					<span>{ title }</span>
					<Link title='Get help in the wiki' to='/wiki/characters#CH_Character_modifiers' className='flex-row'>
						<img className='help-image' src={ wikiIcon } width='26' height='26' alt='Wiki' />
					</Link>
				</Row>
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
									selected={ currentlyFocusedModifier === m.typeId }
									onClick={ () => focusModifier(currentlyFocusedModifier === m.typeId ? null : m.typeId) }
								/>
							))
						}
					</div>
				</div>
			</div>
		</div>
	);
}

function ModifierTypesListItem({ modifier, selected, onClick }: {
	modifier: CharacterModifierTypeDefinition;
	selected: boolean;
	onClick: () => void;
}): ReactElement {
	// TODO: const preference = useAssetPreference(asset);

	return (
		<div
			className={ classNames(
				'inventoryViewItem',
				'listMode',
				'small',
				selected ? 'selected' : null,
				'allowed',
				// `pref-${preference}`,
			) }
			tabIndex={ 0 }
			onClick={ onClick }>
			<span className='itemName'>{ modifier.visibleName }</span>
		</div>
	);
}
