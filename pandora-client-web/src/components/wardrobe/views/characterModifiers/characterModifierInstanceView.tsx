import classNames from 'classnames';
import {
	CHARACTER_MODIFIER_TYPE_DEFINITION,
	type CharacterModifierEffectData,
	type CharacterModifierInstanceClientData,
} from 'pandora-common';
import React, { ReactElement, ReactNode } from 'react';
import { DivContainer } from '../../../common/container/container';

export function WardrobeCharacterModifierFullInstanceView({ children, modifiers }: {
	children?: ReactNode;
	modifiers: readonly CharacterModifierInstanceClientData[];
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

function ModifierFullInstanceListItem({ modifier }: {
	modifier: CharacterModifierInstanceClientData;
}): ReactElement {
	const definition = CHARACTER_MODIFIER_TYPE_DEFINITION[modifier.type];
	// TODO: const preference = useAssetPreference(asset);

	return (
		<div
			className={ classNames(
				'inventoryViewItem',
				'listMode',
				'allowed',
				// `pref-${preference}`,
			) }
			tabIndex={ 0 }
			onClick={ () => {
				// TODO
			} }>
			<span className='itemName'>{ definition.visibleName }</span>
		</div>
	);
}

export function WardrobeCharacterModifierEffectiveInstanceView({ effectiveInstances, children }: {
	effectiveInstances: readonly CharacterModifierEffectData[];
	children?: ReactNode;
}): ReactElement | null {

	return (
		<div className='inventoryView wardrobeModifierEffectiveInstanceList'>
			{ children }
			<div className='listContainer'>
				{
					effectiveInstances.length > 0 ? (
						<div className='Scrollbar'>
							<div className={ 'list' }>
								{
									effectiveInstances.map((m) => (
										<ModifierEffectiveInstanceListItem
											key={ m.id }
											modifier={ m }
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

function ModifierEffectiveInstanceListItem({ modifier }: {
	modifier: CharacterModifierEffectData;
}): ReactElement {
	const definition = CHARACTER_MODIFIER_TYPE_DEFINITION[modifier.type];
	// TODO: const preference = useAssetPreference(asset);

	return (
		<div
			className={ classNames(
				'inventoryViewItem',
				'listMode',
				'allowed',
				// `pref-${preference}`,
			) }
			tabIndex={ 0 }
			onClick={ () => {
				// TODO
			} }>
			<span className='itemName'>{ definition.visibleName }</span>
		</div>
	);
}
