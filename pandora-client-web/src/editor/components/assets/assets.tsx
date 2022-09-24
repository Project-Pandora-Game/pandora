import classNames from 'classnames';
import { nanoid } from 'nanoid';
import { Asset, AssetId, Item } from 'pandora-common';
import React, { ReactElement, useSyncExternalStore } from 'react';
import { AssetGraphicsLayer } from '../../../assets/assetGraphics';
import { useCharacterAppearanceItems } from '../../../character/character';
import { Button } from '../../../components/common/Button/Button';
import { StripAssetIdPrefix } from '../../../graphics/utility';
import { IObservableClass, observable, ObservableClass, useObservableProperty } from '../../../observable';
import { AssetTreeViewCategory, GetAssetManagerEditor } from '../../assets/assetManager';
import { EDITOR_ALPHA_ICONS } from '../../editor';
import { useEditor } from '../../editorContextProvider';
import './assets.scss';

export function AssetsUI(): ReactElement {
	const editor = useEditor();
	const view = GetAssetManagerEditor().assetTreeView;
	const items = useCharacterAppearanceItems(editor.character);
	const editorAssets = useSyncExternalStore((change) => editor.on('modifiedAssetsChange', change), () => editor.getModifiedAssetsList());

	return (
		<div className='editor-setupui asset-ui'>
			<h3>Equipped</h3>
			<ul>
				{items.map((item) => <ItemElement key={ item.id } item={ item } />)}
			</ul>
			<h3>Edited assets</h3>
			<ul>
				{ editorAssets.map((assetId) => <EditedAssetElement key={ assetId } assetId={ assetId } />) }
			</ul>
			<h3>All assets</h3>
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
				{category.assets.map((asset) => <AssetElement key={ asset.id } asset={ asset } category={ category.name } />)}
			</ul>
		</ToggleLi>
	);
}

function StripAssetIdAndCategory(id: AssetId, category: string) {
	const str = StripAssetIdPrefix(id);
	if (str.startsWith(category)) {
		return str.replace(category, '.');
	}
	return str;
}

function AssetElement({ asset, category }: { asset: Asset; category: string; }): ReactElement {
	const editor = useEditor();

	function add() {
		editor.character.appearance.addItem(
			editor.character.appearance.spawnItem(`i/editor/${nanoid()}` as const, asset),
			{},
		);
	}

	return (
		<li>
			<span>{StripAssetIdAndCategory(asset.id, category)}</span>
			<div className='controls'>
				<Button onClick={ () => {
					editor.startEditAsset(asset.id);
				} } title='Edit this asset'>
					🖌
				</Button>
				<Button onClick={ add } title='Equip'>
					+
				</Button>
			</div>
		</li>
	);
}

function EditedAssetElement({ assetId }: { assetId: AssetId; }): ReactElement {
	const editor = useEditor();

	function add() {
		alert('Not yet implemented');
	}

	return (
		<li>
			<span>{StripAssetIdPrefix(assetId)}</span>
			<div className='controls'>
				<Button onClick={ () => {
					editor.startEditAsset(assetId);
				} } title='Edit this asset'>
					🖌
				</Button>
				<Button onClick={ add } title='Equip'>
					+
				</Button>
			</div>
		</li>
	);
}

const itemOpenState = new WeakMap<Item, ToggleLiState>();
function ItemElement({ item }: { item: Item; }): ReactElement {
	const editor = useEditor();
	const appearance = editor.character.appearance;

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

	return (
		<ToggleLi name={ StripAssetIdPrefix(asset.id) } state={ toggleState } nameExtra={
			<div className='controls'>
				{ /* TODO: Button to move down */ }
				{ appearance.moveItem(item.id, -1, { dryRun: true }) &&
				<Button onClick={ () => {
					appearance.moveItem(item.id, -1, {});
				} } title='Move item one up' style={ { fontSize: 'x-small' } } >
					🠉
				</Button>}
				<Button onClick={ () => appearance.removeItem(item.id, {}) } title='Unequip item'>-</Button>
				<Button className='slim' onClick={ toggleAlpha } title="Cycle asset's opacity">{EDITOR_ALPHA_ICONS[alphaIndex]}</Button>
				<Button onClick={ () => {
					editor.startEditAsset(asset.id);
				} } title="Edit this item's asset">
					🖌
				</Button>
			</div>
		}>
			<ul>
				{graphics && graphics.allLayers.map((layer, index) => <AssetLayerElement key={ index } layer={ layer } />)}
			</ul>
		</ToggleLi>
	);
}

function AssetLayerElement({ layer }: { layer: AssetGraphicsLayer; }): ReactElement {
	const editor = useEditor();
	const alphaIndex = useSyncExternalStore<number>((changed) => {
		return editor.on('layerOverrideChange', (changedLayer) => {
			if (changedLayer === layer) {
				changed();
			}
		});
	}, () => editor.getLayersAlphaOverrideIndex(layer));

	const tint = useSyncExternalStore<number>((changed) => {
		return editor.on('layerOverrideChange', (changedLayer) => {
			if (changedLayer === layer) {
				changed();
			}
		});
	}, () => editor.getLayerTint(layer));

	const toggleAlpha = (event: React.MouseEvent<HTMLElement>) => {
		event.stopPropagation();
		editor.setLayerAlphaOverride([layer], alphaIndex+1);
	};

	return (
		<li>
			<span>{layer.name}</span>
			<div className='controls'>
				<input
					type='color'
					value={ '#' + tint.toString(16).padStart(6, '0') }
					onChange={ (event) => {
						editor.setLayerTint(layer, Number.parseInt(event.target.value.replace(/^#/, ''), 16));
					} }
				/>
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
