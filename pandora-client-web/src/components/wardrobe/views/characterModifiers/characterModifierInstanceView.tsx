import classNames from 'classnames';
import {
	CHARACTER_MODIFIER_TYPE_DEFINITION,
	type CharacterModifierEffectData,
	type CharacterModifierId,
	type GameLogicModifierInstanceClient,
} from 'pandora-common';
import { ReactElement, ReactNode, useState } from 'react';
import importIcon from '../../../../assets/icons/import.svg';
import type { ICharacter } from '../../../../character/character.ts';
import { useAccountSettings } from '../../../../services/accountLogic/accountManagerHooks.ts';
import { Button } from '../../../common/button/button.tsx';
import { DivContainer, Row } from '../../../common/container/container.tsx';
import { ResolveItemDisplayNameType } from '../../itemDetail/wardrobeItemName.tsx';
import { CharacterModifierImportDialog } from './characterModifierImport.tsx';
import './characterModifierInstanceView.scss';

export function WardrobeCharacterModifierFullInstanceView({ character, modifiers, modifierEffects, currentlyFocusedModifier, focusModifierInstance }: {
	character: ICharacter;
	modifiers: readonly GameLogicModifierInstanceClient[];
	modifierEffects: readonly CharacterModifierEffectData[];
	currentlyFocusedModifier: CharacterModifierId | null;
	focusModifierInstance: (id: CharacterModifierId | null) => void;
}): ReactElement | null {
	const [showImport, setShowImport] = useState(false);

	return (
		<div className='inventoryView wardrobeModifierFullInstanceList'>
			<Row className='toolbar' alignY='center' alignX='end'>
				<Button
					onClick={ () => setShowImport(true) }
				>
					<img src={ importIcon } alt='Import' crossOrigin='anonymous' /> Import
				</Button>
			</Row>
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
			{
				showImport ? (
					<CharacterModifierImportDialog
						character={ character }
						close={ () => setShowImport(false) }
						focusModifierInstance={ (id) => {
							setShowImport(false);
							focusModifierInstance(id);
						} }
					/>
				) : null
			}
		</div>
	);
}

function ModifierFullInstanceListItem({ modifier, selected = false, onClick, active }: {
	modifier: GameLogicModifierInstanceClient;
	selected?: boolean;
	onClick?: () => void;
	active: boolean;
}): ReactElement {
	const definition = CHARACTER_MODIFIER_TYPE_DEFINITION[modifier.type];
	const { wardrobeItemDisplayNameType } = useAccountSettings();

	const hasCustomName = wardrobeItemDisplayNameType === 'custom' && !!modifier.name && modifier.name !== definition.visibleName;
	return (
		<div
			className={ classNames(
				'inventoryViewItem',
				'listMode',
				selected ? 'selected' : null,
				'allowed',
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
			<span className={ classNames('itemName', hasCustomName ? 'custom' : null) }>
				{ ResolveItemDisplayNameType(definition.visibleName, modifier.name || null, wardrobeItemDisplayNameType) }
			</span>
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

	return (
		<div
			className={ classNames(
				'inventoryViewItem',
				'listMode',
				selected ? 'selected' : null,
				'allowed',
			) }
			tabIndex={ 0 }
			onClick={ onClick }
		>
			<span className='itemName'>{ definition.visibleName }</span>
		</div>
	);
}
