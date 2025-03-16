import classNames from 'classnames';
import { Assert, AssertNotNullable, Asset, AssetId, Item } from 'pandora-common';
import React, { ReactElement, useCallback, useState, useSyncExternalStore } from 'react';
import { useForm, Validate } from 'react-hook-form';
import { toast } from 'react-toastify';
import { FormInput } from '../../../common/userInteraction/input/formInput.tsx';
import { Select } from '../../../common/userInteraction/select/select.tsx';
import { Button } from '../../../components/common/button/button.tsx';
import { ColorInput } from '../../../components/common/colorInput/colorInput.tsx';
import { Row } from '../../../components/common/container/container.tsx';
import { Form, FormField, FormFieldError } from '../../../components/common/form/form.tsx';
import { ModalDialog } from '../../../components/dialog/dialog.tsx';
import { ContextHelpButton } from '../../../components/help/contextHelpButton.tsx';
import { StripAssetIdPrefix } from '../../../graphics/utility.ts';
import { IObservableClass, ObservableClass, ObservableProperty, useNullableObservable, useObservable, useObservableProperty } from '../../../observable.ts';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast.ts';
import { ASSET_ID_PART_REGEX, AssetManagerEditor, AssetTreeViewCategory, useAssetManagerEditor } from '../../assets/assetManager.ts';
import { useLayerName } from '../../assets/editorAssetCalculationHelpers.ts';
import type { EditorAssetGraphicsLayer } from '../../assets/editorAssetGraphicsLayer.ts';
import { EditorAssetGraphicsManager } from '../../assets/editorAssetGraphicsManager.ts';
import { EDITOR_ALPHA_ICONS, useEditorLayerTint, useEditorTabContext } from '../../editor.tsx';
import { useEditor } from '../../editorContextProvider.tsx';
import { useEditorCharacterState } from '../../graphics/character/appearanceEditor.ts';
import { PreviewCutter } from '../previewCutter/previewCutter.tsx';
import './assets.scss';

export function AssetsUI(): ReactElement {
	const editorCharacterState = useEditorCharacterState();
	const view = useAssetManagerEditor().assetTreeView;
	const editorAssets = useObservable(EditorAssetGraphicsManager.editedAssetGraphics);

	return (
		<div className='editor-setupui asset-ui'>
			<h3>
				Equipped
				<ContextHelpButton>
					<p>
						This section lists all items that are currently equipped on the editor character.<br />
						The editor character can be seen in the "Preview" and "Setup" tabs.
					</p>
					<p>
						You can equip a new item by pressing the "+"-Button next to an asset in either the "Edited assets"<br />
						or "All assets" section. Unequipping an item works by pressing the "-" button next to it.<br />
						The "pen"-Button lets you edit the asset that is the basis of the equipped item.
					</p>
					<p>
						You can also expand each item with the leftmost "[+]"-Link, which displays all the layers of that item.<br />
						For every layer, the tint (color) of that layer can be set via the rectangle area.<br />
						The button with the "square"-icon lets you cycle an item or individual layers of<br />
						an item between solid, half-transparent, and invisible on the editor character.
					</p>
				</ContextHelpButton>
			</h3>
			<ul>
				{ editorCharacterState.items.map((item) => <ItemElement key={ item.id } item={ item } />) }
			</ul>
			<h3>
				Edited assets
				<ContextHelpButton>
					The section "Edited assets" shows all assets you have started editing in this editor session.<br />
					The "pen"-Button selects the asset for editing and switches to the asset tab for this.<br />
					If you have multiple items you are editing, the "pen"-Button switches between them.
				</ContextHelpButton>
			</h3>
			<ul>
				{ Array.from(editorAssets.values()).map((asset) => <EditedAssetElement key={ asset.id } assetId={ asset.id } />) }
			</ul>
			<h3>
				All assets
				<ContextHelpButton>
					<p>
						The section "All assets" shows all assets in the currently loaded version of Pandora, grouped by their category.<br />
						Pressing the left-most "[+]"-Link expands the category of assets so that you can see all assets in it.<br />
					</p>
					<p>
						You can equip or edit any of them. Equipping some clothing or restraint items can help you to see the new asset<br />
						you are making together with other items on the editor character.
					</p>
					<p>
						The "Create a new asset"-button opens a new dialogue. First, choose a fitting category for your asset.<br />
						You also need to give it an identifier that should be similar to the name but with "_" instead of space characters, e.g.<br />
						"jeans_shorts". In this example, the visible asset name would then be "Jeans Shorts".
					</p>
					<p>
						Only in case the asset is a body part (e.g. eyes or hair), you must select something in the corresponding<br />
						drop-down dialogue.<br />
						After proceeding, you will be prompted to download a "*.zip" file with your asset so that you can save its contents in<br />
						the pandora-asset repository for committing it when it is ready. This file consists of a minimal<br />
						"*.asset.ts" file for you to build upon and a placeholder version of the "graphics.json".
					</p>
					<p>
						The tab view will immediately switch to the asset-tab with your new item loaded, automatically equipping it on the<br />
						editor character, too.<br />
						Please be aware that your asset is not saved in the editor, as the editor resets when it reloads or refreshes. Please<br />
						make sure to export the asset you are making regularly and overwrite the "graphics.json" of the new asset with<br />
						the one from the exported package [autosaving not yet implemented].
					</p>
				</ContextHelpButton>
			</h3>
			<AssetCreatePrompt />
			<PreviewCutter />
			<ul>
				{ view.categories.map((category) => <AssetCategoryElement key={ category.name } category={ category } />) }
			</ul>
		</div>
	);
}

function AssetCategoryElement({ category }: { category: AssetTreeViewCategory; }): ReactElement {
	return (
		<ToggleLi name={ category.name } state={ category }>
			<ul>
				{ category.assets.map((asset) => <AssetElement key={ asset.id } asset={ asset } category={ category.name } />) }
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
	const tabContext = useEditorTabContext();

	function add() {
		if (!editor.character.getAppearance().addItem(asset)) {
			toast('Failed to add item', TOAST_OPTIONS_ERROR);
		}
	}

	return (
		<li>
			<span>{ StripAssetIdAndCategory(asset.id, category) }</span>
			<div className='controls'>
				<Button onClick={ () => {
					editor.startEditAsset(asset.id);
					if (!tabContext.activeTabs.includes('Asset')) {
						tabContext.setTab('Asset');
					}
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
	const tabContext = useEditorTabContext();
	const asset = useAssetManagerEditor().getAssetById(assetId);
	AssertNotNullable(asset);

	function add() {
		AssertNotNullable(asset);
		if (!editor.character.getAppearance().addItem(asset)) {
			toast('Failed to add item', TOAST_OPTIONS_ERROR);
		}
	}

	return (
		<li>
			<span>{ StripAssetIdPrefix(assetId) }</span>
			<div className='controls'>
				<Button onClick={ () => {
					editor.startEditAsset(assetId);
					if (!tabContext.activeTabs.includes('Asset')) {
						tabContext.setTab('Asset');
					}
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
	const tabContext = useEditorTabContext();
	const appearance = editor.character.getAppearance();

	let toggleState = itemOpenState.get(item);
	if (!toggleState) {
		toggleState = new ToggleLiState(false);
		itemOpenState.set(item, toggleState);
	}

	const asset = item.asset;
	const editorAssetGraphics = useObservable(EditorAssetGraphicsManager.editedAssetGraphics).get(asset.id);
	const layers = useNullableObservable(editorAssetGraphics?.layers) ?? [];

	const alphaIndex = useSyncExternalStore<number>(editor.getSubscriber('layerOverrideChange'), () => editor.getLayersAlphaOverrideIndex(...layers));

	const toggleAlpha = (event: React.MouseEvent<HTMLElement>) => {
		event.stopPropagation();
		if (editorAssetGraphics) {
			editor.setLayerAlphaOverride(layers, alphaIndex + 1);
		}
	};

	return (
		<ToggleLi name={ StripAssetIdPrefix(asset.id) } state={ toggleState } nameExtra={
			<div className='controls'>
				{ /* TODO: Button to move down */ }
				{ appearance.moveItem(item.id, -1, { dryRun: true }) &&
				<Button onClick={ () => {
					appearance.moveItem(item.id, -1);
				} } title='Move item one up' style={ { fontSize: 'x-small' } } >
					🠉
				</Button> }
				<Button onClick={ () => appearance.removeItem(item.id) } title='Unequip item'>-</Button>
				<Button className='slim' onClick={ toggleAlpha } title="Cycle asset's opacity">{ EDITOR_ALPHA_ICONS[alphaIndex] }</Button>
				<Button onClick={ () => {
					editor.startEditAsset(asset.id);
					if (!tabContext.activeTabs.includes('Asset')) {
						tabContext.setTab('Asset');
					}
				} } title="Edit this item's asset">
					🖌
				</Button>
			</div>
		}>
			<ul>
				{ layers.map((layer, index) => <AssetLayerElement key={ index } layer={ layer } />) }
			</ul>
		</ToggleLi>
	);
}

function AssetLayerElement({ layer }: { layer: EditorAssetGraphicsLayer; }): ReactElement {
	const editor = useEditor();
	const alphaIndex = useSyncExternalStore<number>((changed) => {
		return editor.on('layerOverrideChange', (changedLayer) => {
			if (changedLayer === layer) {
				changed();
			}
		});
	}, () => editor.getLayersAlphaOverrideIndex(layer));

	const tint = useEditorLayerTint(layer);
	const visibleName = useLayerName(layer);

	const toggleAlpha = (event: React.MouseEvent<HTMLElement>) => {
		event.stopPropagation();
		editor.setLayerAlphaOverride([layer], alphaIndex + 1);
	};

	return (
		<li>
			<span>{ visibleName }</span>
			<div className='controls'>
				<ColorInput
					hideTextInput
					title={ `Layer '${visibleName}' tint` }
					initialValue={ `#${tint.toString(16).padStart(6, '0')}` }
					onChange={ (newValue) => {
						editor.setLayerTint(layer, Number.parseInt(newValue.replace(/^#/, ''), 16));
					} }
				/>
				<Button className='slim' onClick={ toggleAlpha } title="Cycle layers's opacity">{ EDITOR_ALPHA_ICONS[alphaIndex] }</Button>
			</div>
		</li>
	);
}

export class ToggleLiState extends ObservableClass<{ open: boolean; }> {
	@ObservableProperty
	public accessor open: boolean;

	constructor(initialState: boolean) {
		super();
		this.open = initialState;
	}
}

type ToggleLiProps<T extends { open: boolean; }> = React.DetailedHTMLProps<React.LiHTMLAttributes<HTMLLIElement>, HTMLLIElement> & {
	state: IObservableClass<T>;
	name: string;
	className?: string;
	nameExtra?: ReactElement;
};
function ToggleLi<T extends { open: boolean; }>({ state, name, nameExtra, children, className, ...props }: ToggleLiProps<T>): ReactElement {
	const open = useObservableProperty(state, 'open');
	const spanClass = !children ? undefined : open ? 'opened' : 'closed';

	const onClick = (event: React.MouseEvent<HTMLElement>) => {
		event.stopPropagation();
		state.open = !open;
	};

	return (
		<li className={ classNames('toggle-li', className) } { ...props }>
			<span onClick={ onClick } className={ spanClass }>{ name }</span>
			{ nameExtra }
			{ open && children }
		</li>
	);
}

function AssetCreatePrompt(): ReactElement {
	const [dialogOpen, setDialogOpen] = useState(false);

	return (
		<>
			<Button
				className='slim'
				onClick={ () => setDialogOpen(true) }
			>
				Create a new asset
			</Button>
			{ dialogOpen ? <AssetCreateDialog closeDialog={ () => setDialogOpen(false) } /> : null }
		</>
	);
}

type AssetCreateDialogData = {
	category: string;
	id: string;
	name: string;
	bodypart: string;
};

function AssetCreateDialog({ closeDialog }: { closeDialog: () => void; }): ReactElement {
	const editor = useEditor();
	const tabContext = useEditorTabContext();
	const assetManager = useAssetManagerEditor();
	const view = assetManager.assetTreeView;

	const {
		formState: { errors },
		handleSubmit,
		register,
		getValues,
	} = useForm<AssetCreateDialogData>({ shouldUseNativeValidation: true, progressive: true });

	const validateId = useCallback<Validate<string, AssetCreateDialogData>>((id) => {
		const category = getValues('category');

		if (!view.categories.some((c) => c.name === category)) {
			return 'Invalid category';
		}

		if (!ASSET_ID_PART_REGEX.test(id)) {
			return 'ID must consist of lowercase letters, numbers and underscores only';
		}

		const resultId: AssetId = `a/${category}/${id}`;

		if (assetManager.getAssetById(resultId)) {
			return 'Asset with this ID already exists';
		}

		return true;
	}, [view, assetManager, getValues]);

	const onSubmit = handleSubmit(async ({ category, id, name, bodypart }) => {
		Assert(view.categories.some((c) => c.name === category));

		const resultId: AssetId = `a/${category}/${id}`;
		Assert(!assetManager.getAssetById(resultId));

		await AssetManagerEditor.createNewAsset(category, id, name, bodypart);
		editor.startEditAsset(resultId);

		closeDialog();
		if (!tabContext.activeTabs.includes('Asset')) {
			tabContext.setTab('Asset');
		}
	});

	return (
		<ModalDialog>
			<Form dirty onSubmit={ onSubmit }>
				<h3>Create a new asset</h3>
				<FormField>
					ID:
					<Row padding='medium' alignY='center' gap='none'>
						a/
						<Select
							{ ...register('category', { deps: 'id' }) }
						>
							<option value=''>[ Select category ]</option>
							{ view.categories.map((c) => <option key={ c.name } value={ c.name }>{ c.name }</option>) }
						</Select>
						/
						<FormInput type='text'
							register={ register }
							name='id'
							options={ { required: 'ID is required', validate: validateId } }
							placeholder='Enter identifier of the asset'
						/>
					</Row>
					<FormFieldError error={ errors.id } />
				</FormField>
				<FormField>
					Name:
					<FormInput type='text'
						register={ register }
						name='name'
						options={ {
							required: 'Name is required',
						} }
						placeholder='Visible name of your asset'
					/>
					<FormFieldError error={ errors.name } />
				</FormField>
				<FormField>
					Bodypart:
					<Select
						{ ...register('bodypart') }
					>
						<option value=''>[ Not a bodypart ]</option>
						{ assetManager.bodyparts.map((b) => <option key={ b.name } value={ b.name }>{ b.name }</option>) }
					</Select>
					<FormFieldError error={ errors.bodypart } />
				</FormField>
				<Row padding='medium' alignX='space-between' className='fill-x'>
					<Button onClick={ closeDialog }>Cancel</Button>
					<Button type='submit'>Create</Button>
				</Row>
			</Form>
		</ModalDialog>
	);
}
