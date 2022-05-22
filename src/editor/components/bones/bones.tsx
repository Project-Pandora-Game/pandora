import classNames from 'classnames';
import React, { useMemo, useReducer } from 'react';
import { Button } from '../../../components/common/Button/Button';
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
	const [open, toggleOpen] = useReducer((state) => !state, true);
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
		<fieldset className='bone-row'>
			<legend className='bone-name' onClick={ toggleOpen }>{open ? '▼' : '▶'} {name}</legend>
			<div className={ classNames('bone-rotation', !open && 'closed') } >
				<input type='range' min='-180' max='180' step='.1' value={ rotation } onChange={ onInput } />
				<input type='number' min='-180' max='180' step='.1' value={ rotation } onChange={ onInput } />
				<Button type='button' onClick={ () => bone.rotation = 0 }>Reset</Button>
			</div>
		</fieldset>
	);
}
