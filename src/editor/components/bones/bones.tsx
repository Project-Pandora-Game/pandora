import React, { useMemo } from 'react';
import { Button } from '../../../components/common/Button/Button';
import { FieldsetToggle } from '../../../components/common/fieldsetToggle';
import { useObservableProperty } from '../../../observable';
import { GetAssetManagerEditor } from '../../assets/assetManager';
import type { ObservableBone } from '../../graphics/observable';
import './bones.scss';

export function BoneUI() {
	const bones = useMemo(() => GetAssetManagerEditor().getAllBones(), []);

	return (
		<div className='bone-ui'>
			<h3>Bones</h3>
			{bones.map((bone) => <BoneRowElement key={ bone.name } bone={ bone } />)}
		</div>
	);
}

function BoneRowElement({ bone }: { bone: ObservableBone; }) {
	const rotation = useObservableProperty(bone, 'rotation');
	const name = bone.name
		.replace(/^\w/, (c) => c.toUpperCase())
		.replace(/_r$/, () => ' Right')
		.replace(/_l$/, () => ' Left')
		.replace(/_\w/g, (c) => ' ' + c.charAt(1).toUpperCase());

	const onInput = (event: React.ChangeEvent<HTMLInputElement>) => {
		const value = parseFloat(event.target.value);
		if (value !== undefined) {
			bone.rotation = value;
		}
	};

	return (
		<FieldsetToggle legend={ name } persistent={ 'bone-ui-' + bone.name }>
			<div className='bone-rotation'>
				<input type='range' min='-180' max='180' step='1' value={ rotation } onChange={ onInput } />
				<input type='number' min='-180' max='180' step='1' value={ rotation } onChange={ onInput } />
				<Button className='slim' onClick={ () => bone.rotation = 0 }>Reset</Button>
			</div>
		</FieldsetToggle>
	);
}
