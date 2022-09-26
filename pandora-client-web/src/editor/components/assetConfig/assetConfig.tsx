import { AssetDefinition, AssetModuleDefinition } from 'pandora-common';
import { EffectsDefinition, EFFECTS_DEFAULT } from 'pandora-common/dist/assets/effects';
import React, { ReactElement } from 'react';
import { FieldsetToggle } from '../../../components/common/fieldsetToggle';
import { GetVisibleBoneName } from '../../../components/wardrobe/wardrobe';
import { StripAssetIdPrefix } from '../../../graphics/utility';
import { useObservable } from '../../../observable';
import { useEditor } from '../../editorContextProvider';

export function AssetConfigUI(): ReactElement {
	const editor = useEditor();
	const graphics = useObservable(editor.targetAsset);
	const asset = graphics?.asset;

	if (!asset) {
		return (
			<div className='editor-setupui'>
				<h3>Select an asset</h3>
			</div>
		);
	}

	const definition = asset.definition;

	return (
		<div className='editor-setupui'>
			<h3>WIP: this page is readonly</h3>
			<hr />
			<h3>Editing: { StripAssetIdPrefix(asset.id) }</h3>
			<div>
				<label htmlFor='id'>ID: </label>
				<input id='id' type='text' value={ definition.id } readOnly />
			</div>
			<div>
				<label htmlFor='name'>Name: </label>
				<input id='name' type='text' value={ definition.name } readOnly />
			</div>
			<div>
				<label htmlFor='item-add'>Item add: </label>
				<textarea id='item-add' value={ definition.actionMessages?.itemAdd } readOnly />
			</div>
			<div>
				<label htmlFor='item-remove'>Item remove: </label>
				<textarea id='item-remove' value={ definition.actionMessages?.itemRemove } readOnly />
			</div>
			<div>
				<label htmlFor='bodypart'>Body part: </label>
				<input id='bodypart' type='text' value={ definition.bodypart } readOnly />
			</div>
			<div>
				<label htmlFor='graphics'>Has graphics: </label>
				<input id='graphics' type='checkbox' checked={ definition.hasGraphics } readOnly />
			</div>
			<div>
				<label htmlFor='allow-self-equip'>Allow self equip: </label>
				<input id='allow-self-equip' type='checkbox' checked={ definition.allowSelfEquip ?? false } readOnly />
			</div>
			<Colorization colorization={ definition.colorization } />
			<PoseLimits poseLimits={ definition.poseLimits } />
			<Effects effects={ definition.effects } />
			<Modules modules={ definition.modules } />
		</div>
	);
}

function Colorization({ colorization }: { colorization: AssetDefinition['colorization'] }): ReactElement | null {
	if (!colorization) {
		return null;
	}

	return (
		<FieldsetToggle legend='Colorization'>
			{ colorization.map((color, index) => (
				<div key={ index }>
					<input id={ `color-${index}-name` } type='text' value={ color.name ?? '' } readOnly />
					<input id={ `color-${index}-color` } type='color' value={ color.default } readOnly />
				</div>
			)) }
		</FieldsetToggle>
	);
}

function PoseLimits({ poseLimits }: { poseLimits: AssetDefinition['poseLimits'] }): ReactElement | null {
	if (!poseLimits) {
		return null;
	}

	return (
		<FieldsetToggle legend='Pose limits'>
			<div>
				<label htmlFor='force-arms'>Force arms: </label>
				<input id='force-arms' type='text' value={ poseLimits.forceArms ?? '' } readOnly />
			</div>
			<hr />
			<div>
				{ Object.entries(poseLimits.forcePose ?? {}).map(([key, value]) => (
					<div key={ key }>
						<label htmlFor={ `force-pose-${key}` }>{ GetVisibleBoneName(key) }: </label>
						<input id={ `force-pose-${key}` } type='text' value={
							value === undefined ? '' :
							typeof value === 'number' ? value.toString() :
							`${value[0]} - ${value[1]}`
						} readOnly />
					</div>
				)) }
			</div>
		</FieldsetToggle>
	);
}

function Effects({ effects }: { effects: AssetDefinition['effects'] }): ReactElement {
	const allEffects: EffectsDefinition = { ...EFFECTS_DEFAULT, ...effects };

	return (
		<FieldsetToggle legend='Effects'>
			{ Object.entries(allEffects).map(([key, value]) => (
				<div key={ key }>
					<label htmlFor={ `effect-${key}` }>{ key }: </label>
					{ typeof value === 'boolean' ? (
						<input id={ `effect-${key}` } type='checkbox' checked={ value } readOnly />
					) : typeof value === 'number' ? (
						<input id={ `effect-${key}` } type='number' value={ value } readOnly />
					) : (
						<input id={ `effect-${key}` } type='text' value={ value } readOnly />
					) }
				</div>
			)) }
		</FieldsetToggle>
	);
}

function Modules({ modules }: { modules: AssetDefinition['modules'] }): ReactElement | null {
	if (!modules) {
		return null;
	}

	return (
		<FieldsetToggle legend='Modules'>
			{ Object.entries(modules).map(([name, module], index) => (
				<Module key={ index } name={ name } module={ module } />
			)) }
		</FieldsetToggle>
	);
}

function Module({ name }: { name: string; module: AssetModuleDefinition }): ReactElement {
	return (
		<div>
			<div>
				<label htmlFor={ `module-${name}` }>{ name }: </label>
				<input id={ `module-${name}` } type='text' value={ name } readOnly />
			</div>
			<h4>TODO: implement this</h4>
		</div>
	);
}
