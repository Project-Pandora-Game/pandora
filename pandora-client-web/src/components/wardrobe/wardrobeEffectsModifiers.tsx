import classNames from 'classnames';
import {
	AssetFrameworkCharacterState,
} from 'pandora-common';
import React, { ReactElement } from 'react';
import { ICharacter } from '../../character/character';
import { WardrobeCharacterModifierTypeView } from './views/characterModifierTypeView';

export function WardrobeEffectsModifiers({ className, character, characterState }: {
	className?: string;
	character: ICharacter;
	characterState: AssetFrameworkCharacterState;
}): ReactElement {

	return (
		<div className={ classNames('wardrobe-ui', className) }>
			<div className='inventoryView'>
				<div className='toolbar'>
					<span>Current modifiers</span>
				</div>
			</div>
			<WardrobeCharacterModifierTypeView title='Possible modifiers' />
			{ /* {
				WardrobeFocusesItem(currentFocus) &&
				<div className='flex-col flex-1'>
					<WardrobeItemConfigMenu key={ currentFocus.itemId } item={ currentFocus } />
				</div>
			} */ }
		</div>
	);
}
