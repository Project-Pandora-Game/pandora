import classNames from 'classnames';
import {
	AppearanceActionProcessingContext,
	CHARACTER_MODIFIER_TYPE_DEFINITION,
	CharacterModifierActionCheckAdd,
	KnownObject,
	type CharacterModifierType,
	type CharacterModifierTypeDefinition,
} from 'pandora-common';
import { ReactElement, ReactNode, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import wikiIcon from '../../../../assets/icons/wiki.svg';
import type { ICharacter } from '../../../../character/character.ts';
import { TextInput } from '../../../../common/userInteraction/input/textInput.tsx';
import { useInputAutofocus } from '../../../../common/userInteraction/inputAutofocus.ts';
import { Row } from '../../../common/container/container.tsx';
import { useCheckAddPermissions } from '../../../gameContext/permissionCheckProvider.tsx';
import { ShowEffectiveAllowOthers } from '../../../settings/permissionsSettings.tsx';
import { useWardrobeActionContext } from '../../wardrobeActionContext.tsx';
import { CheckResultToClassName } from '../../wardrobeComponents.tsx';

export function WardrobeCharacterModifierTypeView({ title, character, currentlyFocusedModifier, focusModifier, children }: {
	title: string;
	character: ICharacter;
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

	const sortedModifierTypes = useMemo(() => filteredModifierTypes.sort((a, b) => a.visibleName.localeCompare(b.visibleName)), [filteredModifierTypes]);

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
									character={ character }
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

function ModifierTypesListItem({ modifier, selected, character, onClick }: {
	modifier: CharacterModifierTypeDefinition;
	selected: boolean;
	character: ICharacter;
	onClick: () => void;
}): ReactElement {
	const { actions, globalState } = useWardrobeActionContext();

	// Resolve if the modifier can actually be added to this character
	const checkInitial = useMemo(() => {
		const processingContext = new AppearanceActionProcessingContext(actions, globalState);
		return CharacterModifierActionCheckAdd(processingContext, character.id, modifier.typeId);
	}, [actions, globalState, character, modifier]);
	const check = useCheckAddPermissions(checkInitial);

	return (
		<div
			className={ classNames(
				'inventoryViewItem',
				'listMode',
				'sidePadding',
				'small',
				selected ? 'selected' : null,
				CheckResultToClassName(check, false),
			) }
			tabIndex={ 0 }
			onClick={ onClick }>
			<span className='itemName'>{ modifier.visibleName }</span>
			{
				character.isPlayer() ? (
					<ShowEffectiveAllowOthers permissionGroup='characterModifierType' permissionId={ modifier.typeId } />
				) : null
			}
		</div>
	);
}
