import classNames from 'classnames';
import { nanoid } from 'nanoid';
import { Asset, Item } from 'pandora-common';
import React, { ReactElement, useMemo, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { AssetGraphicsLayer } from '../../../assets/assetGraphics';
import { useCharacterAppearanceItems } from '../../../character/character';
import { Button } from '../../../components/common/Button/Button';
import { LayerStateOverrides } from '../../../graphics/def';
import { IObservableClass, observable, ObservableClass, useObservableProperty } from '../../../observable';
import { AssetTreeViewCategory, GetAssetManagerEditor } from '../../assets/assetManager';
import { Editor } from '../../editor';
import './assets.scss';

export function AssetsUI({ editor }: { editor: Editor; }): ReactElement {
	const view = GetAssetManagerEditor().assetTreeView;
	const items = useCharacterAppearanceItems(editor.character);

	return (
		<div className='asset-ui'>
			<h3>Assets</h3>
			<ul>
				{view.categories.map((category) => <AssetCategoryElement key={ category.name } category={ category } editor={ editor } />)}
			</ul>
			<h3>Equipped</h3>
			<ul>
				{items.map((item) => <ItemElement key={ item.id } item={ item } editor={ editor } />)}
			</ul>
		</div>
	);
}

function AssetCategoryElement({ category, editor }: { category: AssetTreeViewCategory; editor: Editor; }): ReactElement {
	return (
		<ToggleLi name={ category.name } state={ category }>
			<ul>
				{category.assets.map((asset) => <AssetElement key={ asset.id } asset={ asset } editor={ editor } />)}
			</ul>
		</ToggleLi>
	);
}

function AssetElement({ asset, editor }: { asset: Asset; editor: Editor; }): ReactElement {
	const navigate = useNavigate();

	function add() {
		editor.character.appearance.createItem(`i/editor/${nanoid()}`, asset);
	}

	return (
		<li>
			<span>{asset.definition.name}</span>
			<div className='controls'>
				<Button onClick={ () => {
					navigate('/layers');
				} }>
					E
				</Button>
				<Button onClick={ add }>
					+
				</Button>
			</div>
		</li>
	);
}

function ItemElement({ item, editor }: { item: Item; editor: Editor; }): ReactElement {
	const toggleState = useMemo(() => new ToggleLiState(true), []);

	const asset = item.asset;
	const graphics = asset.definition.hasGraphics ? editor.manager.getAssetGraphicsById(asset.id) : undefined;

	function remove() {
		editor.character.appearance.removeItem(item.id);
	}

	return (
		<ToggleLi name={ asset.definition.name } state={ toggleState } nameExtra={
			<div className='controls'>
				<Button onClick={ remove }>-</Button>
			</div>
		}>
			<ul>
				{graphics && graphics.allLayers.map((layer, index) => <AssetLayerElement key={ index } layer={ layer } editor={ editor } />)}
			</ul>
		</ToggleLi>
	);
}

const ALPHAS = [1, 0.6, 0];
const ALPHA_ICONS = ['🌕', '🌓', '🌑'];
function AssetLayerElement({ layer, editor }: { layer: AssetGraphicsLayer; editor: Editor }): ReactElement {
	const stateOverrides = useSyncExternalStore<LayerStateOverrides | undefined>((changed) => {
		return editor.on('layerOverrideChange', (changedLayer) => {
			if (changedLayer === layer) {
				changed();
			}
		});
	}, () => editor.getLayerStateOverride(layer));

	let alphaIndex = ALPHAS.indexOf(stateOverrides?.alpha ?? 1);
	if (alphaIndex < 0) {
		alphaIndex = 0;
	}

	const toggleAlpha = (event: React.MouseEvent<HTMLElement>) => {
		event.stopPropagation();

		const newAlpha = ALPHAS[(alphaIndex + 1) % ALPHAS.length] ?? 1;
		editor.setLayerStateOverride(layer, {
			...stateOverrides,
			alpha: newAlpha,
		});
	};

	return (
		<li>
			<span>{layer.name}</span>
			<div className='controls'>
				<button type='button' onClick={ toggleAlpha }>{ALPHA_ICONS[alphaIndex]}</button>
			</div>
		</li>
	);
}

export class ToggleLiState extends ObservableClass<{ open: boolean; }> {
	@observable
	public open: boolean;

	constructor(initialState: boolean) {
		super();
		this.open = initialState;
	}
}

type ToggleLiProps<T extends { open: boolean; }> = React.DetailedHTMLProps<React.LiHTMLAttributes<HTMLLIElement>, HTMLLIElement> & {
	state: IObservableClass<T>;
	name: string,
	className?: string;
	nameExtra?: ReactElement;
};
function ToggleLi<T extends { open: boolean; }>({ state, name, nameExtra, children, className, ...props }: ToggleLiProps<T>): ReactElement {
	const open = useObservableProperty(state as unknown as IObservableClass<{ open: boolean; }>, 'open');
	const spanClass = !children ? undefined : open ? 'opened' : 'closed';

	const onClick = (event: React.MouseEvent<HTMLElement>) => {
		event.stopPropagation();
		state.open = !open;
	};

	return (
		<li className={ classNames('toggle-li', className) } { ...props }>
			<span onClick={ onClick } className={ spanClass }>{name}</span>
			{ nameExtra }
			{open && children}
		</li>
	);
}
