import { BoneState, ArmsPose } from 'pandora-common';
import React, { ReactElement, useSyncExternalStore } from 'react';
import { useCharacterAppearancePose } from '../../../character/character';
import { Button } from '../../../components/common/Button/Button';
import { FieldsetToggle } from '../../../components/common/fieldsetToggle';
import { useObservable } from '../../../observable';
import { Editor } from '../../editor';
import './bones.scss';

export function BoneUI({ editor }: { editor: Editor }): ReactElement {
	const character = editor.character;

	const bones = useCharacterAppearancePose(character);
	const armsPose = useSyncExternalStore((onChange) => character.on('appearanceUpdate', (change) => {
		if (change.includes('pose')) {
			onChange();
		}
	}), () => character.appearance.getArmsPose());
	const showBones = useObservable(editor.showBones);

	return (
		<div className='bone-ui'>
			<div>
				<label>Show bone points</label>
				<input
					type='checkbox'
					checked={ showBones }
					onChange={ (e) => {
						editor.showBones.value = e.target.checked;
					} }
				/>
			</div>
			<div>
				<label>Arms are in front of the body</label>
				<input
					type='checkbox'
					checked={ armsPose === ArmsPose.FRONT }
					onChange={ (e) => {
						character.appearance.setArmsPose(e.target.checked ? ArmsPose.FRONT : ArmsPose.BACK);
					} }
				/>
			</div>
			<h3>Bones</h3>
			{bones.map((bone) => <BoneRowElement key={ bone.definition.name } bone={ bone } onChange={ (value) => character.appearance.setPose(bone.definition.name, value) } />)}
		</div>
	);
}

function BoneRowElement({ bone, onChange }: { bone: BoneState; onChange: (value: number) => void }) {
	const name = bone.definition.name
		.replace(/^\w/, (c) => c.toUpperCase())
		.replace(/_r$/, () => ' Right')
		.replace(/_l$/, () => ' Left')
		.replace(/_\w/g, (c) => ' ' + c.charAt(1).toUpperCase());

	const onInput = (event: React.ChangeEvent<HTMLInputElement>) => {
		const value = Math.round(parseFloat(event.target.value));
		if (Number.isInteger(value)) {
			onChange(value);
		}
	};

	return (
		<FieldsetToggle legend={ name } persistent={ 'bone-ui-' + bone.definition.name }>
			<div className='bone-rotation'>
				<input type='range' min='-180' max='180' step='1' value={ bone.rotation } onChange={ onInput } />
				<input type='number' min='-180' max='180' step='1' value={ bone.rotation } onChange={ onInput } />
				<Button className='slim' onClick={ () => onChange(0) }>↺</Button>
			</div>
		</FieldsetToggle>
	);
}
