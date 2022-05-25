import { BoneState } from 'pandora-common';
import React, { ReactElement } from 'react';
import { AppearanceContainer, useCharacterAppearancePose } from '../../../character/character';
import { Button } from '../../../components/common/Button/Button';
import { FieldsetToggle } from '../../../components/common/fieldsetToggle';
import './bones.scss';

export function BoneUI({ character }: { character: AppearanceContainer }): ReactElement {
	const bones = useCharacterAppearancePose(character);

	return (
		<div className='bone-ui'>
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
