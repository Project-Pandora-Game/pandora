import classNames from 'classnames';
import {
	CHARACTER_MODIFIER_TYPE_DEFINITION,
	type CharacterModifierEffectData,
	type CharacterModifierId,
	type CharacterModifierInstanceClientData,
} from 'pandora-common';
import { ReactElement, ReactNode } from 'react';
import { DivContainer } from '../../../common/container/container';
import { ResolveItemDisplayNameType } from '../../itemDetail/wardrobeItemName';
import { useWardrobeContext } from '../../wardrobeContext';
import './characterModifierInstanceView.scss';

export function WardrobeCharacterModifierFullInstanceView({ children, modifiers, modifierEffects, currentlyFocusedModifier, focusModifierInstance }: {
	children?: ReactNode;
	modifiers: readonly CharacterModifierInstanceClientData[];
	modifierEffects: readonly CharacterModifierEffectData[];
	currentlyFocusedModifier: CharacterModifierId | null;
	focusModifierInstance: (id: CharacterModifierId | null) => void;
}): ReactElement | null {
	return (
		<div className='inventoryView wardrobeModifierFullInstanceList'>
			{ children }
			<div className='listContainer'>
				{
					modifiers.length > 0 ? (
						<div className='Scrollbar'>
							<div className={ 'list' }>
								{
									modifiers.map((m) => (
										<ModifierFullInstanceListItem
											key={ m.id }
											modifier={ m }
											selected={ currentlyFocusedModifier === m.id }
											onClick={ () => focusModifierInstance(currentlyFocusedModifier === m.id ? null : m.id) }
											active={ modifierEffects.some((e) => e.id === m.id) }
										/>
									))
								}
							</div>
						</div>
					) : (
						<DivContainer align='center' justify='center' className='flex-1'>
							<i>Nothing here yet</i>
						</DivContainer>
					)
				}
			</div>
		</div>
	);
}

function ModifierFullInstanceListItem({ modifier, selected = false, onClick, active }: {
	modifier: CharacterModifierInstanceClientData;
	selected?: boolean;
	onClick?: () => void;
	active: boolean;
}): ReactElement {
	const definition = CHARACTER_MODIFIER_TYPE_DEFINITION[modifier.type];
	const { itemDisplayNameType } = useWardrobeContext();

	// TODO: const preference = useAssetPreference(asset);

	return (
		<div
			className={ classNames(
				'inventoryViewItem',
				'listMode',
				selected ? 'selected' : null,
				'allowed',
				// `pref-${preference}`,
				'characterModifierInstance',
			) }
			tabIndex={ 0 }
			onClick={ onClick }
		>
			<div
				className={ classNames(
					'modifierStatusBar',
					!modifier.enabled ? 'status-disabled' : active ? 'status-active' : 'status-inactive',
				) }
			/>
			<span className='itemName'>{ ResolveItemDisplayNameType(definition.visibleName, modifier.name || null, itemDisplayNameType) }</span>
		</div>
	);
}

export function WardrobeCharacterModifierEffectiveInstanceView({ children, modifierEffects, currentlyFocusedEffect, focusModifierEffect }: {
	children?: ReactNode;
	modifierEffects: readonly CharacterModifierEffectData[];
	currentlyFocusedEffect: CharacterModifierId | null;
	focusModifierEffect: (id: CharacterModifierId | null) => void;
}): ReactElement | null {

	return (
		<div className='inventoryView wardrobeModifierEffectiveInstanceList'>
			{ children }
			<div className='listContainer'>
				{
					modifierEffects.length > 0 ? (
						<div className='Scrollbar'>
							<div className={ 'list' }>
								{
									modifierEffects.map((m) => (
										<ModifierEffectiveInstanceListItem
											key={ m.id }
											modifier={ m }
											selected={ currentlyFocusedEffect === m.id }
											onClick={ () => focusModifierEffect(currentlyFocusedEffect === m.id ? null : m.id) }
										/>
									))
								}
							</div>
						</div>
					) : (
						<DivContainer align='center' justify='center' className='flex-1'>
							<i>Nothing here yet</i>
						</DivContainer>
					)
				}
			</div>
		</div>
	);
}

function ModifierEffectiveInstanceListItem({ modifier, selected = false, onClick }: {
	modifier: CharacterModifierEffectData;
	selected?: boolean;
	onClick?: () => void;
}): ReactElement {
	const definition = CHARACTER_MODIFIER_TYPE_DEFINITION[modifier.type];
	// TODO: const preference = useAssetPreference(asset);

	return (
		<div
			className={ classNames(
				'inventoryViewItem',
				'listMode',
				selected ? 'selected' : null,
				'allowed',
				// `pref-${preference}`,
			) }
			tabIndex={ 0 }
			onClick={ onClick }
		>
			<span className='itemName'>{ definition.visibleName }</span>
		</div>
	);
}
