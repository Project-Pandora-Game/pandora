import { ArmsPose, CharacterView } from 'pandora-common';
import React, { ReactElement, useEffect, useState, useSyncExternalStore } from 'react';
import { useCharacterAppearancePose } from '../../../character/character';
import { FieldsetToggle } from '../../../components/common/fieldsetToggle';
import { SlimScrollbar } from '../../../components/common/slimScrollbar/slimScrollbar';
import { BoneRowElement, WardrobePoseCategories } from '../../../components/wardrobe/wardrobe';
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

	const [unlocked, setUnlocked] = useState(!character.appearance.enforce);
	useEffect(() => {
		character.appearance.enforce = !unlocked;
	}, [character.appearance, unlocked]);

	return (
		<SlimScrollbar color='lighter' className='bone-ui extraSlim'>
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
			<div>
				<label htmlFor='unlocked-toggle'>Ignore bone limits from items</label>
				<input
					id='unlocked-toggle'
					type='checkbox'
					checked={ unlocked }
					onChange={ (e) => {
						setUnlocked(e.target.checked);
					} }
				/>
			</div>
			<FieldsetToggle legend='Pose presets' persistent={ 'bone-ui-poses' } open={ false }>
				<WardrobePoseCategories appearance={ character.appearance } bones={ bones } armsPose={ armsPose } setPose={ (pose) => {
					if (pose.armsPose !== undefined) {
						character.appearance.setArmsPose(pose.armsPose);
					}
					for (const [name, value] of Object.entries(pose.pose)) {
						if (value) {
							character.appearance.setPose(name, value);
						}
					}
				} } />
			</FieldsetToggle>
			<hr />
			<h4>Pose bones</h4>
			{
				bones
					.filter((bone) => bone.definition.type === 'pose')
					.map((bone) => <BoneRowElement key={ bone.definition.name } bone={ bone } onChange={ (value) => character.appearance.setPose(bone.definition.name, value) } unlocked={ unlocked } />)
			}
			<hr />
			<h4>Body bones</h4>
			{
				bones
					.filter((bone) => bone.definition.type === 'body')
					.map((bone) => <BoneRowElement key={ bone.definition.name } bone={ bone } onChange={ (value) => character.appearance.setPose(bone.definition.name, value) } unlocked={ unlocked } />)
			}
		</SlimScrollbar>
	);
}
