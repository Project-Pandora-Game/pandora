import { Immutable } from 'immer';
import { noop } from 'lodash-es';
import { AssetDefinition, AssetModuleDefinition, EFFECTS_DEFAULT, ModuleType, type EffectsDefinition } from 'pandora-common';
import { IModuleConfigCommon } from 'pandora-common/assets/modules/common';
import { IModuleConfigTyped, IModuleTypedOption } from 'pandora-common/assets/modules/typed';
import { ReactElement, useId, useMemo } from 'react';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { Row } from '../../../components/common/container/container.tsx';
import { FieldsetToggle } from '../../../components/common/fieldsetToggle/index.tsx';
import { StripAssetIdPrefix } from '../../../graphics/utility.ts';
import { useObservable } from '../../../observable.ts';
import { useAssetManagerEditor } from '../../assets/assetManager.ts';
import type { EditorAssetGraphics } from '../../assets/graphics/editorAssetGraphics.ts';
import { useEditor } from '../../editorContextProvider.tsx';

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
	const asset = useAssetManagerEditor().getAssetById(graphics.id);

	if (asset == null || !asset.isType('bodypart') && !asset.isType('personal'))
		return null;

	const definition = asset.definition;

	return (
		<div className='editor-setupui'>
			<h3>Asset: { StripAssetIdPrefix(asset.id) }</h3>
			<Row alignY='center'>
				<label htmlFor='id'>ID: </label>
				<TextInput id='id' value={ definition.id } readOnly />
			</Row>
			<Row alignY='center'>
				<label htmlFor='name'>Name: </label>
				<TextInput id='name' value={ definition.name } readOnly />
			</Row>
			{
				asset.isType('bodypart') ? (
					<Row alignY='center'>
						<label htmlFor='bodypart'>Body part: </label>
						<TextInput id='bodypart' value={ asset.definition.bodypart } readOnly />
					</Row>
				) : null
			}
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
					<TextInput id={ `color-${key}-name` } value={ color.name ?? '' } readOnly />
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
						<Checkbox id={ `${id}-${key}` } checked={ value } onChange={ noop } disabled />
					) : typeof value === 'number' ? (
						<NumberInput id={ `${id}-${key}` } value={ value } readOnly />
					) : (
						<TextInput id={ `${id}-${key}` } value={ value } readOnly />
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
				<TextInput id={ `module-${name}` } value={ name } readOnly />
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
				<TextInput id={ `module-type-${id}-id` } value={ options.id } readOnly />
			</div>
			<div>
				<label htmlFor={ `module-type-${id}-name` }>Name: </label>
				<TextInput id={ `module-type-${id}-name` } value={ options.name } readOnly />
			</div>
			<div>
				<label htmlFor={ `module-type-${id}-default` }>Default: </label>
				<Checkbox id={ `module-type-${id}-default` } checked={ options.default ?? false } onChange={ noop } disabled />
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
				<TextInput id={ `module-${id}-type` } value={ module.type } readOnly />
			</div>
			<div>
				<label htmlFor={ `module-${id}-name` }>Name: </label>
				<TextInput id={ `module-${id}-name` } value={ module.name } readOnly />
			</div>
			<div>
				<label htmlFor={ `module-${id}-expression` }>Expression: </label>
				<TextInput id={ `module-${id}-expression` } value={ module.expression ?? '' } readOnly />
			</div>
		</>
	);
}
