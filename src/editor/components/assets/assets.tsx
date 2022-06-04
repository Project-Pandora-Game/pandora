import classNames from 'classnames';
import { nanoid } from 'nanoid';
import { Asset, AssetId, Item } from 'pandora-common';
import React, { ReactElement, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { AssetGraphicsLayer } from '../../../assets/assetGraphics';
import { useCharacterAppearanceItems } from '../../../character/character';
import { Button } from '../../../components/common/Button/Button';
import { StripAssetIdPrefix } from '../../../graphics/utility';
import { IObservableClass, observable, ObservableClass, useObservableProperty } from '../../../observable';
import { AssetTreeViewCategory, GetAssetManagerEditor } from '../../assets/assetManager';
import { Editor, EDITOR_ALPHA_ICONS } from '../../editor';
import './assets.scss';

export function AssetsUI({ editor }: { editor: Editor; }): ReactElement {
	const view = GetAssetManagerEditor().assetTreeView;
	const items = useCharacterAppearanceItems(editor.character);
	const editorAssets = useSyncExternalStore((change) => editor.on('modifiedAssetsChange', change), () => editor.getModifiedAssetsList());

	return (
		<div className='asset-ui'>
			<h3>Equipped</h3>
			<ul>
				{items.map((item) => <ItemElement key={ item.id } item={ item } editor={ editor } />)}
			</ul>
			<h3>Edited assets</h3>
			<ul>
				{ editorAssets.map((assetId) => <EditedAssetElement key={ assetId } editor={ editor } assetId={ assetId } />) }
			</ul>
			<h3>All assets</h3>
			<ul>
				{view.categories.map((category) => <AssetCategoryElement key={ category.name } category={ category } editor={ editor } />)}
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
			<span>{StripAssetIdPrefix(asset.id)}</span>
			<div className='controls'>
				<Button onClick={ () => {
					editor.startEditAsset(asset.id);
					navigate('/asset');
				} } title='Edit this asset'>
					E
				</Button>
				<Button onClick={ add } title='Equip'>
					+
				</Button>
			</div>
		</li>
	);
}

function EditedAssetElement({ assetId, editor }: { assetId: AssetId; editor: Editor; }): ReactElement {
	const navigate = useNavigate();

	function add() {
		alert('Not yet implemented');
	}

	return (
		<li>
			<span>{StripAssetIdPrefix(assetId)}</span>
			<div className='controls'>
				<Button onClick={ () => {
					editor.startEditAsset(assetId);
					navigate('/asset');
				} } title='Edit this asset'>
					E
				</Button>
				<Button onClick={ add } title='Equip'>
					+
				</Button>
			</div>
		</li>
	);
}

const itemOpenState = new WeakMap<Item, ToggleLiState>();
function ItemElement({ item, editor }: { item: Item; editor: Editor; }): ReactElement {
	const navigate = useNavigate();

	let toggleState = itemOpenState.get(item);
	if (!toggleState) {
		toggleState = new ToggleLiState(false);
		itemOpenState.set(item, toggleState);
	}

	const asset = item.asset;
	const graphics = editor.getAssetGraphicsById(asset.id);

	const alphaIndex = useSyncExternalStore<number>(editor.getSubscriber('layerOverrideChange'), () => editor.getLayersAlphaOverrideIndex(...(graphics?.allLayers ?? [])));

	const toggleAlpha = (event: React.MouseEvent<HTMLElement>) => {
		event.stopPropagation();
		if (graphics) {
			editor.setLayerAlphaOverride(graphics.allLayers, alphaIndex+1);
		}
	};

	function remove() {
		editor.character.appearance.removeItem(item.id);
	}

	return (
		<ToggleLi name={ StripAssetIdPrefix(asset.id) } state={ toggleState } nameExtra={
			<div className='controls'>
				<Button onClick={ () => {
					editor.startEditAsset(asset.id);
					navigate('/asset');
				} } title="Edit this item's asset">
					E
				</Button>
				<Button onClick={ remove } title='Unequip item'>-</Button>
				<Button className='slim' onClick={ toggleAlpha } title="Cycle asset's opacity">{EDITOR_ALPHA_ICONS[alphaIndex]}</Button>
			</div>
		}>
			<ul>
				{graphics && graphics.allLayers.map((layer, index) => <AssetLayerElement key={ index } layer={ layer } editor={ editor } />)}
			</ul>
		</ToggleLi>
	);
}

function AssetLayerElement({ layer, editor }: { layer: AssetGraphicsLayer; editor: Editor }): ReactElement {
	const alphaIndex = useSyncExternalStore<number>((changed) => {
		return editor.on('layerOverrideChange', (changedLayer) => {
			if (changedLayer === layer) {
				changed();
			}
		});
	}, () => editor.getLayersAlphaOverrideIndex(layer));

	const toggleAlpha = (event: React.MouseEvent<HTMLElement>) => {
		event.stopPropagation();
		editor.setLayerAlphaOverride([layer], alphaIndex+1);
	};

	return (
		<li>
			<span>{layer.name}</span>
			<div className='controls'>
				<Button className='slim' onClick={ toggleAlpha } title="Cycle layers's opacity">{EDITOR_ALPHA_ICONS[alphaIndex]}</Button>
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
