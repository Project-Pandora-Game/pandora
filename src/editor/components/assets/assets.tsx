import classNames from 'classnames';
import { AssetId, AssetState } from 'pandora-common';
import React, { ReactElement, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/common/Button/Button';
import { GetLayerState, SetLayerState } from '../../../graphics/graphicsLayer';
import { IObservableClass, useObservableProperty } from '../../../observable';
import { AssetDefinitionEditor, AssetTreeViewCategory, GetAssetManagerEditor } from '../../assets/assetManager';
import { EditorCharacter } from '../../graphics/editorScene';
import { ObservableLayer } from '../../graphics/observable';
import { SelectedAsset } from '../layers';
import './assets.scss';

export function AssetUI(): ReactElement {
	const view = GetAssetManagerEditor().assetTreeView;

	return (
		<div className='asset-ui'>
			<h3>Assets</h3>
			<ul>
				{view.categories.map((category) => <AssetCategoryElement key={ category.name } category={ category } />)}
			</ul>
		</div>
	);
}

function AssetCategoryElement({ category }: { category: AssetTreeViewCategory; }): ReactElement {
	return (
		<ToggleLi name={ category.name } state={ category }>
			<ul>
				{category.assets.map((asset) => <AssetElement key={ asset.id } asset={ asset } />)}
			</ul>
		</ToggleLi>
	);
}

function useAssetState(id: AssetId) {
	return useSyncExternalStore((changed) => EditorCharacter.on('update', (data) => {
		if (data.assets) changed();
	}), () => EditorCharacter.data.assets.find((asset) => asset.id === id));
}

function AssetElement({ asset }: { asset: AssetDefinitionEditor; }): ReactElement {
	const state = useAssetState(asset.id);
	const navigate = useNavigate();

	function beforeEdit() {
		SelectedAsset.value = asset;
	}

	function toggleAdded() {
		if (state) {
			EditorCharacter.update({
				assets: EditorCharacter.data.assets.filter((a) => a.id !== state.id),
			});
		} else {
			EditorCharacter.update({
				assets: [...EditorCharacter.data.assets, { id: asset.id }],
			});
		}
	}

	return (
		<ToggleLi name={ asset.name } state={ asset }>
			<div className='controls'>
				<Button onClick={ () => {
					beforeEdit();
					navigate('/layers');
				} }>
					E
				</Button>
				<button type='button' onClick={ toggleAdded }>{ state ? ' - ' : ' + ' }</button>
			</div>
			<ul>
				{asset.layers.map((layer, index) => <AssetLayerElement key={ index } layer={ layer } index={ index } state={ state } />)}
			</ul>
		</ToggleLi>
	);
}

const APLHAS = [1.0, 0.8, 0.6, 0.4, 0.2, 0.0];
function AssetLayerElement({ layer, index, state }: { layer: ObservableLayer; index: number; state?: AssetState }): ReactElement {
	const selected = useObservableProperty(layer, 'selected');

	const toggleSelected = (event: React.MouseEvent<HTMLElement>) => {
		event.stopPropagation();
		layer.selected = !layer.selected;
	};

	const toggleAplha = (event: React.MouseEvent<HTMLElement>) => {
		event.stopPropagation();
		if (!state) return;

		const alpha = GetLayerState(state?.layers, index)?.[1] ?? 1;
		const newAlpha = alpha === 0 ? 1 : APLHAS.find((a) => a < alpha) ?? 0;
		const assets = [...EditorCharacter.data.assets];
		for (const asset of assets) {
			if (asset.id === state.id) {
				asset.layers = SetLayerState(asset.layers, index, [undefined, newAlpha]);
				break;
			}
		}

		EditorCharacter.update({ assets });
	};

	return (
		<ToggleLi name={ index.toString() } state={ layer }>
			<div className='controls'>
				<button type='button' onClick={ toggleSelected } disabled={ !state }> { selected ? 'U' : 'S' } </button>
				<button type='button' onClick={ toggleAplha } disabled={ !state }> A </button>
			</div>
		</ToggleLi>
	);
}

type ToggleLiProps<T extends { open: boolean; }> = React.DetailedHTMLProps<React.LiHTMLAttributes<HTMLLIElement>, HTMLLIElement> & {
	state: IObservableClass<T>;
	name: string,
	className?: string;
};
function ToggleLi<T extends { open: boolean; }>({ state, name, children, className, ...props }: ToggleLiProps<T>): ReactElement {
	const open = useObservableProperty(state as unknown as IObservableClass<{ open: boolean; }>, 'open');
	const spanClass = !children ? undefined : open ? 'opened' : 'closed';

	const onClick = (event: React.MouseEvent<HTMLElement>) => {
		event.stopPropagation();
		state.open = !open;
	};

	return (
		<li className={ classNames('toggle-li', className) } { ...props }>
			<span onClick={ onClick } className={ spanClass }>{name}</span>
			{open && children}
		</li>
	);
}
