/* eslint-disable react/forbid-elements */
import { Immutable } from 'immer';
import { AssetDefinition, AssetModuleDefinition, ModuleType } from 'pandora-common';
import { EFFECTS_DEFAULT, EffectsDefinition } from 'pandora-common/dist/assets/effects.js';
import { IModuleConfigCommon } from 'pandora-common/dist/assets/modules/common.js';
import { IModuleConfigTyped, IModuleTypedOption } from 'pandora-common/dist/assets/modules/typed.js';
import { ReactElement, useId, useMemo } from 'react';
import { useGraphicsAsset } from '../../../assets/assetGraphicsCalculations.ts';
import { Row } from '../../../components/common/container/container.tsx';
import { FieldsetToggle } from '../../../components/common/fieldsetToggle/index.tsx';
import { StripAssetIdPrefix } from '../../../graphics/utility.ts';
import { useObservable } from '../../../observable.ts';
import { useEditor } from '../../editorContextProvider.tsx';
import { EditorAssetGraphics } from '../../graphics/character/appearanceEditor.ts';

export function AssetInfoUI(): ReactElement {
	const editor = useEditor();
	const graphics = useObservable(editor.targetAsset);

	if (!graphics) {
		return (
			<div className='editor-setupui'>
				<h3>Select an asset to display</h3>
			</div>
		);
	}

	return <AssetInfoUIImpl graphics={ graphics } />;
}

function AssetInfoUIImpl({ graphics }: { graphics: EditorAssetGraphics; }): ReactElement | null {
	const asset = useGraphicsAsset(graphics);

	if (!asset.isType('bodypart') && !asset.isType('personal'))
		return null;

	const definition = asset.definition;

	return (
		<div className='editor-setupui'>
			<h3>Asset: { StripAssetIdPrefix(asset.id) }</h3>
			<Row alignY='center'>
				<label htmlFor='id'>ID: </label>
				<input id='id' type='text' value={ definition.id } readOnly />
			</Row>
			<Row alignY='center'>
				<label htmlFor='name'>Name: </label>
				<input id='name' type='text' value={ definition.name } readOnly />
			</Row>
			{
				asset.isType('bodypart') ? (
					<Row alignY='center'>
						<label htmlFor='bodypart'>Body part: </label>
						<input id='bodypart' type='text' value={ asset.definition.bodypart } readOnly />
					</Row>
				) : null
			}
			<Row alignY='center'>
				<label htmlFor='graphics'>Has graphics: </label>
				<input id='graphics' type='checkbox' checked={ definition.hasGraphics } disabled />
			</Row>
			<Colorization colorization={ definition.colorization } />
			<Effects effects={ definition.effects } />
			<Modules modules={ definition.modules } />
		</div>
	);
}

function Colorization({ colorization }: { colorization: Immutable<AssetDefinition<'bodypart' | 'personal'>['colorization']>; }): ReactElement | null {
	if (!colorization) {
		return null;
	}

	return (
		<FieldsetToggle legend='Colorization'>
			{ Object.entries(colorization).map(([key, color]) => (
				<div key={ key }>
					<label htmlFor={ `color-${key}-name` }>{ key }: </label>
					<input id={ `color-${key}-name` } type='text' value={ color.name ?? '' } readOnly />
					<input id={ `color-${key}-color` } type='color' value={ color.default } readOnly />
				</div>
			)) }
		</FieldsetToggle>
	);
}

function Effects({ effects, id = '' }: { effects: AssetDefinition<'bodypart' | 'personal'>['effects']; id?: string; }): ReactElement {
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

function Modules({ modules }: { modules: Immutable<AssetDefinition<'bodypart' | 'personal'>>['modules']; }): ReactElement | null {
	if (!modules) {
		return null;
	}

	return (
		<FieldsetToggle legend='Modules' className='slim-padding-inner'>
			{ Object.entries(modules).map(([name, module]) => (
				// @ts-expect-error: Generalized module data (and I don't care as this is just Editor anyway)
				<Module key={ name } name={ name } module={ module } />
			)) }
		</FieldsetToggle>
	);
}

function Module({ name, module }: { name: string; module: Immutable<AssetModuleDefinition<unknown, unknown>>; }): ReactElement {
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

function UnknownModule({ module }: { module: Immutable<IModuleConfigCommon<ModuleType>>; }): ReactElement {
	return (
		<div>
			Unknown module type: { String(module.type) }
		</div>
	);
}

function TypedModule({ module }: { module: Immutable<IModuleConfigTyped<unknown, unknown>>; }): ReactElement {
	return (
		<FieldsetToggle legend='Variants' className='slim-padding-inner'>
			{ module.variants.map((variant, index) => (
				<TypedModuleOptions key={ index } options={ variant } />
			)) }
		</FieldsetToggle>
	);
}

function TypedModuleOptions({ options }: { options: Immutable<IModuleTypedOption<unknown>>; }): ReactElement {
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
		</div>
	);
}

function ModuleCommon({ module }: { module: IModuleConfigCommon<ModuleType>; }): ReactElement {
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
