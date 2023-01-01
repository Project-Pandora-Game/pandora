import { ArmPose, AssetDefinition, AssetModuleDefinition } from 'pandora-common';
import { EffectsDefinition, EFFECTS_DEFAULT } from 'pandora-common/dist/assets/effects';
import { IModuleConfigCommon } from 'pandora-common/dist/assets/modules/common';
import { IModuleConfigTyped, IModuleTypedOption } from 'pandora-common/dist/assets/modules/typed';
import React, { ReactElement, useId, useMemo } from 'react';
import { FieldsetToggle } from '../../../components/common/fieldsetToggle';
import { Scrollbar } from '../../../components/common/scrollbar/scrollbar';
import { GetVisibleBoneName } from '../../../components/wardrobe/wardrobe';
import { StripAssetIdPrefix } from '../../../graphics/utility';
import { useObservable } from '../../../observable';
import { useEditor } from '../../editorContextProvider';

export function AssetInfoUI(): ReactElement {
	const editor = useEditor();
	const graphics = useObservable(editor.targetAsset);
	const asset = graphics?.asset;

	if (!asset) {
		return (
			<div className='editor-setupui'>
				<h3>Select an asset to display</h3>
			</div>
		);
	}

	const definition = asset.definition;

	return (
		<Scrollbar color='lighter' className='editor-setupui slim'>
			<h3>Asset: { StripAssetIdPrefix(asset.id) }</h3>
			<div>
				<label htmlFor='id'>ID: </label>
				<input id='id' type='text' value={ definition.id } readOnly />
			</div>
			<div>
				<label htmlFor='name'>Name: </label>
				<input id='name' type='text' value={ definition.name } readOnly />
			</div>
			<div>
				<label htmlFor='bodypart'>Body part: </label>
				<input id='bodypart' type='text' value={ definition.bodypart } readOnly />
			</div>
			<div>
				<label htmlFor='graphics'>Has graphics: </label>
				<input id='graphics' type='checkbox' checked={ definition.hasGraphics } disabled />
			</div>
			<Colorization colorization={ definition.colorization } />
			<PoseLimits poseLimits={ definition.poseLimits } />
			<Effects effects={ definition.effects } />
			<Modules modules={ definition.modules } />
		</Scrollbar>
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

function ForceArmsToString(forceArms?: ArmPose | [ArmPose | null, ArmPose | null]): string {
	if (forceArms == null) return 'Any - Any';
	if (typeof forceArms === 'number') return forceArms === ArmPose.FRONT ? 'Front - Front' : 'Back - Back';
	return forceArms
		.map((arm) => arm == null ? 'Any' : (arm === ArmPose.FRONT ? 'Front' : 'Back'))
		.join(' - ');
}

function PoseLimits({ poseLimits, id = '' }: { poseLimits: AssetDefinition['poseLimits']; id?: string }): ReactElement | null {
	if (!poseLimits) {
		return null;
	}

	return (
		<FieldsetToggle legend='Pose limits'>
			<div>
				<label htmlFor={ `${id}force-arms` }>Force arms (left - right): </label>
				<input id={ `${id}force-arms` } type='text' value={ ForceArmsToString(poseLimits.forceArms) } readOnly />
			</div>
			<hr />
			<div>
				{ Object.entries(poseLimits.forcePose ?? {}).map(([key, value]) => (
					<div key={ key }>
						<label htmlFor={ `${id}force-pose-${key}` }>{ GetVisibleBoneName(key) }: </label>
						<input id={ `${id}force-pose-${key}` } type='text' value={
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

function Effects({ effects, id = '' }: { effects: AssetDefinition['effects']; id?: string }): ReactElement {
	const allEffects: EffectsDefinition = { ...EFFECTS_DEFAULT, ...effects };
	id += 'effect';

	return (
		<FieldsetToggle legend='Effects' className='slim-padding-inner'>
			{ Object.entries(allEffects).map(([key, value]) => (
				<div key={ key }>
					<label htmlFor={ `${id}-${key}` }>{ key }: </label>
					{ typeof value === 'boolean' ? (
						<input id={ `${id}-${key}` } type='checkbox' checked={ value } disabled />
					) : typeof value === 'number' ? (
						<input id={ `${id}-${key}` } type='number' value={ value } readOnly />
					) : (
						<input id={ `${id}-${key}` } type='text' value={ value } readOnly />
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
		<FieldsetToggle legend='Modules' className='slim-padding-inner'>
			{ Object.entries(modules).map(([name, module]) => (
				<Module key={ name } name={ name } module={ module } />
			)) }
		</FieldsetToggle>
	);
}

function Module({ name, module }: { name: string; module: AssetModuleDefinition }): ReactElement {
	const moduleInfo = useMemo(() => {
		switch (module.type) {
			case 'typed':
				return <TypedModule module={ module } />;
			default:
				return <UnknownModule module={ module } />;
		}
	}, [module]);
	return (
		<div>
			<div>
				<label htmlFor={ `module-${name}` }>Key: </label>
				<input id={ `module-${name}` } type='text' value={ name } readOnly />
			</div>
			<ModuleCommon module={ module } />
			{ moduleInfo }
		</div>
	);
}

function UnknownModule({ module }: { module: AssetModuleDefinition }): ReactElement {
	return (
		<div>
			Unknown module type: { String(module.type) }
		</div>
	);
}

function TypedModule({ module }: { module: IModuleConfigTyped }): ReactElement {
	return (
		<FieldsetToggle legend='Variants' className='slim-padding-inner'>
			{ module.variants.map((variant, index) => (
				<TypedModuleOptions key={ index } options={ variant } />
			)) }
		</FieldsetToggle>
	);
}

function TypedModuleOptions({ options }: { options: IModuleTypedOption }): ReactElement {
	const id = useId();
	return (
		<div>
			<div>
				<label htmlFor={ `module-type-${id}-id` }>Id: </label>
				<input id={ `module-type-${id}-id` } type='text' value={ options.id } readOnly />
			</div>
			<div>
				<label htmlFor={ `module-type-${id}-name` }>Name: </label>
				<input id={ `module-type-${id}-name` } type='text' value={ options.name } readOnly />
			</div>
			<div>
				<label htmlFor={ `module-type-${id}-default` }>Default: </label>
				<input id={ `module-type-${id}-default` } type='checkbox' checked={ options.default } disabled />
			</div>
			<PoseLimits poseLimits={ options.poseLimits } id={ `module-type-${id}-` } />
			<Effects effects={ options.effects } id={ `module-type-${id}-` } />
		</div>
	);
}

function ModuleCommon({ module }: { module: IModuleConfigCommon<string> }): ReactElement {
	const id = useId();
	return (
		<>
			<div>
				<label htmlFor={ `module-${id}-type` }>Type: </label>
				<input id={ `module-${id}-type` } type='text' value={ module.type } readOnly />
			</div>
			<div>
				<label htmlFor={ `module-${id}-name` }>Name: </label>
				<input id={ `module-${id}-name` } type='text' value={ module.name } readOnly />
			</div>
			<div>
				<label htmlFor={ `module-${id}-expression` }>Expression: </label>
				<input id={ `module-${id}-expression` } type='text' value={ module.expression ?? '' } readOnly />
			</div>
		</>
	);
}
