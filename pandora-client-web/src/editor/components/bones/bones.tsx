import { ArmsPose, CharacterView } from 'pandora-common';
import React, { ReactElement, useSyncExternalStore } from 'react';
import { useCharacterAppearancePose } from '../../../character/character';
import { BoneRowElement } from '../../../components/wardrobe/wardrobe';
import { useObservable } from '../../../observable';
import { useEditor } from '../../editorContextProvider';

export function BoneUI(): ReactElement {
	const editor = useEditor();
	const character = editor.character;

	const bones = useCharacterAppearancePose(character);
	const armsPose = useSyncExternalStore((onChange) => character.on('appearanceUpdate', (change) => {
		if (change.includes('pose')) {
			onChange();
		}
	}), () => character.appearance.getArmsPose());
	const view = useSyncExternalStore((onChange) => character.on('appearanceUpdate', (change) => {
		if (change.includes('pose')) {
			onChange();
		}
	}), () => character.appearance.getView());
	const showBones = useObservable(editor.showBones);

	return (
		<div className='bone-ui'>
			<div>
				<label htmlFor='show-bones-toggle'>Show bone points</label>
				<input
					id='show-bones-toggle'
					type='checkbox'
					checked={ showBones }
					onChange={ (e) => {
						editor.showBones.value = e.target.checked;
					} }
				/>
			</div>
			<div>
				<label htmlFor='arms-front-toggle'>Arms are in front of the body</label>
				<input
					id='arms-front-toggle'
					type='checkbox'
					checked={ armsPose === ArmsPose.FRONT }
					onChange={ (e) => {
						character.appearance.setArmsPose(e.target.checked ? ArmsPose.FRONT : ArmsPose.BACK);
					} }
				/>
			</div>
			<div>
				<label htmlFor='back-view-toggle'>Show back view</label>
				<input
					id='back-view-toggle'
					type='checkbox'
					checked={ view === CharacterView.BACK }
					onChange={ (e) => {
						character.appearance.setView(e.target.checked ? CharacterView.BACK : CharacterView.FRONT);
					} }
				/>
			</div>
			<h3>Bones</h3>
			{bones.map((bone) => <BoneRowElement key={ bone.definition.name } bone={ bone } onChange={ (value) => character.appearance.setPose(bone.definition.name, value) } />)}
		</div>
	);
}
