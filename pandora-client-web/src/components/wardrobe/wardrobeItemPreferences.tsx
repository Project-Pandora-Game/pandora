import classNames from 'classnames';
import { Immutable } from 'immer';
import { noop } from 'lodash-es';
import { AssertNever, Asset, AssetAttributeDefinition, AssetId, AssetPreference, AssetPreferenceType, AssetPreferenceTypeSchema, AttributePreferenceType, AttributePreferenceTypeSchema, CloneDeepMutable, EMPTY_ARRAY, KnownObject, ResolveAssetPreference } from 'pandora-common';
import { ReactElement, createContext, useCallback, useContext, useId, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import * as z from 'zod';
import { useAssetManager } from '../../assets/assetManager.tsx';
import { useBrowserStorage } from '../../browserStorage.ts';
import { Checkbox } from '../../common/userInteraction/checkbox.tsx';
import { TextInput } from '../../common/userInteraction/input/textInput.tsx';
import { useInputAutofocus } from '../../common/userInteraction/inputAutofocus.ts';
import { Select, type SelectProps } from '../../common/userInteraction/select/select.tsx';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast.ts';
import { Column, Row } from '../common/container/container.tsx';
import { Scrollable } from '../common/scrollbar/scrollbar.tsx';
import { Tab, TabContainer } from '../common/tabs/tabs.tsx';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider.tsx';
import { WardrobeAssetList, useAssetPreference, useAssetPreferenceResolver, useAssetPreferences } from './views/wardrobeAssetView.tsx';
import { InventoryAssetPreview, InventoryAttributePreview } from './wardrobeComponents.tsx';

type ItemPreferencesFocus = {
	type: 'none';
} | {
	type: 'attribute';
	attribute: string;
} | {
	type: 'asset';
	asset: AssetId;
};

const WardrobeItemPreferencesFocusContext = createContext<{
	focus: ItemPreferencesFocus;
	setFocus: (newFocus: ItemPreferencesFocus) => void;
}>({ focus: { type: 'none' }, setFocus: noop });

export function WardrobeItemPreferences(): ReactElement {
	const [focus, setFocus] = useState<ItemPreferencesFocus>({ type: 'none' });

	return (
		<WardrobeItemPreferencesFocusContext.Provider value={
			useMemo(() => ({
				focus,
				setFocus,
			}), [focus])
		}>
			<div className='wardrobe-ui'>
				<TabContainer className='flex-1'>
					<Tab name='Attributes'>
						<WardrobePreferencesAttributePicker
							title='Choose attribute'
						/>
					</Tab>
					<Tab name='Items'>
						<WardrobePreferencesItemPicker />
					</Tab>
				</TabContainer>
				<WardrobePreferencesConfiguration focus={ focus } />
			</div>
		</WardrobeItemPreferencesFocusContext.Provider>
	);
}

export function WardrobePreferencesItemPicker(): ReactElement | null {
	const assetManager = useAssetManager();
	const assetList = assetManager.assetList;

	const attributesFilterOptions = useMemo<string[]>(() => ([...assetManager.attributes.entries()]
		.filter((a) => a[1].useAsWardrobeFilter != null)
		.map((a) => a[0])
	), [assetManager]);

	return (
		<WardrobeAssetList
			assets={ assetList.filter((asset) => {
				return !asset.isType('roomDevice') && !asset.isType('roomDeviceWearablePart');
			}) }
			container={ EMPTY_ARRAY }
			attributesFilterOptions={ attributesFilterOptions }
			itemSortIgnorePreferenceOrdering
			ListItemComponent={ WardrobePreferencesItemPickerItem }
		/>
	);
}

function WardrobePreferencesItemPickerItem({ asset, listMode }: {
	asset: Asset;
	listMode: boolean;
}): ReactElement {
	const { focus, setFocus } = useContext(WardrobeItemPreferencesFocusContext);
	const isFocused = focus.type === 'asset' && focus.asset === asset.id;
	const preference = useAssetPreference(asset);

	return (
		<div
			className={ classNames(
				'inventoryViewItem',
				listMode ? 'listMode' : 'gridMode',
				'small',
				isFocused ? 'selected' : null,
				'allowed',
				`pref-${preference}`,
			) }
			tabIndex={ 0 }
			onClick={ () => {
				if (isFocused) {
					setFocus({
						type: 'none',
					});
				} else {
					setFocus({
						type: 'asset',
						asset: asset.id,
					});
				}
			} }>
			<InventoryAssetPreview asset={ asset } small={ listMode } />
			<span className='itemName'>{ asset.definition.name }</span>
		</div>
	);
}

export function WardrobePreferencesAttributePicker({ title }: {
	title: string;
}): ReactElement | null {
	const assetManager = useAssetManager();

	const [filter, setFilter] = useState('');

	const flt = filter.toLowerCase().trim().split(/\s+/);
	const finalAttributes = useMemo(() => (
		[...assetManager.attributes.entries()]
			.filter(([_attribute, definition]) => (definition.useAsAssetPreference ?? true))
			.filter(([_attribute, definition]) => flt.every((f) => {
				return definition.name.toLowerCase().includes(f);
			}))
	), [assetManager, flt]);

	const filterInput = useRef<TextInput>(null);
	useInputAutofocus(filterInput);

	return (
		<div className='inventoryView'>
			<div className='toolbar'>
				<span>{ title }</span>
				<div className='filter'>
					<TextInput ref={ filterInput }
						placeholder='Filter by name'
						value={ filter }
						onChange={ setFilter }
					/>
				</div>
			</div>
			<div className='listContainer'>
				<div className='Scrollbar'>
					<div className='list'>
						{
							finalAttributes.map(([attribute, definition]) => (
								<WardrobePreferencesAttributePickerItem
									key={ attribute }
									attribute={ attribute }
									definition={ definition }
								/>
							))
						}
					</div>
				</div>
			</div>
		</div>
	);
}

function WardrobePreferencesAttributePickerItem({ attribute, definition }: {
	attribute: string;
	definition: Immutable<AssetAttributeDefinition>;
}): ReactElement {
	const { focus, setFocus } = useContext(WardrobeItemPreferencesFocusContext);
	const isFocused = focus.type === 'attribute' && focus.attribute === attribute;
	const preference: AssetPreferenceType = useAssetPreferences().attributes[attribute]?.base ?? 'normal';

	return (
		<div
			className={ classNames(
				'inventoryViewItem',
				'listMode',
				'small',
				isFocused ? 'selected' : null,
				'allowed',
				`pref-${preference}`,
			) }
			tabIndex={ 0 }
			onClick={ () => {
				if (isFocused) {
					setFocus({
						type: 'none',
					});
				} else {
					setFocus({
						type: 'attribute',
						attribute,
					});
				}
			} }>
			<InventoryAttributePreview attribute={ attribute } />
			<span className='itemName'>{ definition.name }</span>
		</div>
	);
}

function WardrobePreferencesConfiguration({ focus }: {
	focus: ItemPreferencesFocus;
}): ReactElement {
	const assetManager = useAssetManager();

	if (focus.type === 'none') {
		return (
			<div className='inventoryView'>
				<div className='center-flex flex-1'>
					Select an attribute or an item to change its settings
				</div>
			</div>
		);
	}

	if (focus.type === 'asset') {
		const asset = assetManager.getAssetById(focus.asset);
		if (asset == null) {
			return (
				<div className='inventoryView'>
					<div className='center-flex flex-1'>
						[ ERROR: ASSET NOT FOUND ]
					</div>
				</div>
			);
		}

		return (
			<WardrobePreferenceAssetConfiguration
				asset={ asset }
			/>
		);
	}

	if (focus.type === 'attribute') {
		const attributeDefinition = assetManager.getAttributeDefinition(focus.attribute);
		if (attributeDefinition == null) {
			return (
				<div className='inventoryView'>
					<div className='center-flex flex-1'>
						[ ERROR: ATTRIBUTE NOT FOUND ]
					</div>
				</div>
			);
		}

		return (
			<WardrobePreferenceAttributeConfiguration
				attribute={ focus.attribute }
				definition={ attributeDefinition }
			/>
		);
	}

	AssertNever(focus);
}

const ASSET_PREFERENCE_DESCRIPTIONS: Immutable<Record<AssetPreferenceType, { name: string; description: string; }>> = {
	favorite: {
		name: 'Favorite',
		description: 'Show this item at the top of the list.',
	},
	normal: {
		name: 'Normal',
		description: 'Normal priority.',
	},
	maybe: {
		name: 'Maybe',
		description: 'Show this item at the bottom of the list.',
	},
	prevent: {
		name: 'Prevent',
		description: 'Prevent this item from being used.',
	},
	doNotRender: {
		name: 'Do not render',
		description: 'Do not render this item.',
	},
} as const;

function WardrobePreferenceAssetConfiguration({ asset }: {
	asset: Asset;
}): ReactElement {
	const idBase = useId();

	const [showNonFilterableAttributes, setShowNonFilterableAttributes] = useBrowserStorage<boolean>('wardrobe.itemPreferences.showNonFilterableAttributes', false, z.boolean());

	const { setFocus } = useContext(WardrobeItemPreferencesFocusContext);
	const assetManager = useAssetManager();
	const shardConnector = useShardConnector();
	const currentPreferences = useAssetPreferences();
	const currentAssetPreference: AssetPreference | null = currentPreferences.assets[asset.id] ?? null;
	// Get the attribute preference resolution - ignoring asset-specific value
	const attributeBasedPreference = useMemo(() => {
		return ResolveAssetPreference({
			attributes: currentPreferences.attributes,
			assets: {},
		}, asset);
	}, [asset, currentPreferences]);

	const onChange = useCallback<NonNullable<SelectProps['onChange']>>((ev) => {
		const value: AssetPreferenceType | null = ev.target.value ? AssetPreferenceTypeSchema.parse(ev.target.value) : null;
		if (value === (currentAssetPreference?.base ?? null))
			return;

		const updated = CloneDeepMutable(currentPreferences.assets);

		if (value != null) {
			updated[asset.id] = {
				base: value,
			};
		} else {
			delete updated[asset.id];
		}

		shardConnector?.awaitResponse('updateAssetPreferences', {
			assets: updated,
		}).then(({ result }) => {
			if (result !== 'ok')
				toast('Asset not be worn before setting "do not render"', TOAST_OPTIONS_ERROR);
		}).catch((err) => {
			if (err instanceof Error)
				toast(`Failed to update asset preference: ${err.message}`, TOAST_OPTIONS_ERROR);
		});
	}, [shardConnector, asset, currentPreferences, currentAssetPreference]);

	return (
		<div className='inventoryView assetPreference'>
			<div className='toolbar'>
				<InventoryAssetPreview asset={ asset } small={ false } />
				<span className='flex-1'>{ asset.definition.name }</span>
			</div>
			<Scrollable>
				<Column padding='large'>
					<label htmlFor={ `${idBase}-select` }>Item preference:</label>
					<Select id={ `${idBase}-select` } onChange={ onChange } value={ currentAssetPreference?.base ?? '' } noScrollChange>
						<option value='' title='Select the preference for the item based on the most limited attribute'>
							Based on attributes ({ ASSET_PREFERENCE_DESCRIPTIONS[attributeBasedPreference.preference].name })
						</option>
						{
							KnownObject.entries(ASSET_PREFERENCE_DESCRIPTIONS).map(([key, { name, description }]) => (
								<option key={ key } value={ key } title={ description }>
									{ name }
								</option>
							))
						}
					</Select>
				</Column>

				<fieldset>
					<legend>Attributes this item has (in at least one configuration)</legend>
					<Row>
						<Checkbox
							id={ `${idBase}-allAttributesToggle` }
							checked={ showNonFilterableAttributes }
							onChange={ setShowNonFilterableAttributes }
						/>
						<label htmlFor={ `${idBase}-allAttributesToggle` }>Show attributes that cannot be used for limits</label>
					</Row>
					<div className='list'>
						{
							[...assetManager.attributes.entries()]
								.filter(([_attribute, definition]) => (showNonFilterableAttributes || (definition.useAsAssetPreference ?? true)))
								.filter(([attribute, _definition]) => asset.staticAttributes.has(attribute))
								.map(([attribute, definition]) => {
									const attributePreference: AssetPreferenceType = currentPreferences.attributes[attribute]?.base ?? 'normal';

									return (
										<div key={ attribute }
											className={ classNames(
												'inventoryViewItem',
												'listMode',
												'allowed',
												'small',
												`pref-${attributePreference}`,
											) }
											title={ definition.description }
											onClick={ () => {
												setFocus({ type: 'attribute', attribute });
											} }
										>
											<InventoryAttributePreview attribute={ attribute } />
											<span className='itemName'>{ definition.name }</span>
										</div>
									);
								})
						}
					</div>
				</fieldset>
			</Scrollable>
		</div>
	);
}

const ATTRIBUTE_PREFERENCE_DESCRIPTIONS: Immutable<Record<AttributePreferenceType, { name: string; description: string; }>> = {
	normal: {
		name: 'Normal',
		description: 'Normal priority.',
	},
	maybe: {
		name: 'Maybe',
		description: 'Show items with this attribute at the bottom of the list.',
	},
	prevent: {
		name: 'Prevent',
		description: 'Prevent items with this attribute from being used.',
	},
	doNotRender: {
		name: 'Do not render',
		description: 'Do not render items with this attribute.',
	},
} as const;

function WardrobePreferenceAttributeConfiguration({ attribute, definition }: {
	attribute: string;
	definition: Immutable<AssetAttributeDefinition>;
}): ReactElement {
	const idBase = useId();

	const { setFocus } = useContext(WardrobeItemPreferencesFocusContext);
	const assetList = useAssetManager().assetList;
	const shardConnector = useShardConnector();
	const resolvePreference = useAssetPreferenceResolver();
	const currentPreferences = useAssetPreferences();
	const currentAttributePreference: AssetPreference | null = currentPreferences.attributes[attribute] ?? null;

	const isConfigurable = definition.useAsAssetPreference ?? true;

	const onChange = useCallback<NonNullable<SelectProps['onChange']>>((ev) => {
		const value: AssetPreferenceType = AttributePreferenceTypeSchema.parse(ev.target.value);
		if (value === (currentAttributePreference?.base ?? 'normal') || !isConfigurable)
			return;

		const updated = CloneDeepMutable(currentPreferences.attributes);

		if (value !== 'normal') {
			updated[attribute] = {
				base: value,
			};
		} else {
			delete updated[attribute];
		}

		shardConnector?.awaitResponse('updateAssetPreferences', {
			attributes: updated,
		}).then(({ result }) => {
			if (result !== 'ok')
				toast('Asset not be worn before setting "do not render"', TOAST_OPTIONS_ERROR);
		}).catch((err) => {
			if (err instanceof Error)
				toast(`Failed to update asset preference: ${err.message}`, TOAST_OPTIONS_ERROR);
		});
	}, [shardConnector, isConfigurable, attribute, currentPreferences, currentAttributePreference]);

	return (
		<div className='inventoryView assetPreference'>
			<div className='toolbar'>
				<InventoryAttributePreview attribute={ attribute } />
				<span className='flex-1'>{ definition.name }</span>
			</div>
			<Scrollable>
				<Column padding='large'>
					<label htmlFor={ `${idBase}-select` }>Attribute preference:</label>
					<Select id={ `${idBase}-select` } onChange={ onChange } value={ currentAttributePreference?.base ?? 'normal' } noScrollChange disabled={ !isConfigurable }>
						{
							KnownObject.entries(ATTRIBUTE_PREFERENCE_DESCRIPTIONS).map(([key, { name, description }]) => (
								<option key={ key } value={ key } title={ description }>
									{ name }
								</option>
							))
						}
					</Select>
				</Column>
				<Column padding='large'>
					<span>Description:</span>
					<span>{ definition.description }</span>
				</Column>
				<fieldset>
					<legend>Items that have this attribute (in at least one configuration)</legend>
					<div className='list'>
						{
							assetList
								.filter((a) => !a.isType('roomDevice') && !a.isType('roomDeviceWearablePart'))
								.filter((a) => a.staticAttributes.has(attribute))
								.map((a) => {
									const assetPreference: AssetPreferenceType = resolvePreference(a);

									return (
										<div key={ a.id }
											className={ classNames(
												'inventoryViewItem',
												'listMode',
												'allowed',
												'small',
												`pref-${assetPreference}`,
											) }
											onClick={ () => {
												setFocus({ type: 'asset', asset: a.id });
											} }
										>
											<InventoryAssetPreview asset={ a } small />
											<span className='itemName'>{ a.definition.name }</span>
										</div>
									);
								})
						}
					</div>
				</fieldset>
			</Scrollable>
		</div>
	);
}
