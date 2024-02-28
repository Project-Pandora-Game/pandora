import { Immutable } from 'immer';
import { uniq } from 'lodash';
import {
	AssetManager,
	CloneDeepMutable,
	DEFAULT_BACKGROUND,
	EMPTY_ARRAY,
	IsObject,
	RoomBackgroundConfig,
	RoomBackgroundInfo,
	RoomBackgroundTagDefinition,
} from 'pandora-common';
import React, { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GetAssetsSourceUrl, useAssetManager } from '../../../assets/assetManager';
import { useInputAutofocus } from '../../../common/userInteraction/inputAutofocus';
import { Button } from '../../../components/common/button/button';
import { ColorInput } from '../../../components/common/colorInput/colorInput';
import { Column, Row } from '../../../components/common/container/container';
import { FieldsetToggle } from '../../../components/common/fieldsetToggle';
import { Scrollbar } from '../../../components/common/scrollbar/scrollbar';
import { SelectionIndicator } from '../../../components/common/selectionIndicator/selectionIndicator';
import { ModalDialog } from '../../../components/dialog/dialog';
import './spaceConfiguration.scss';

export function BackgroundSelector({ value, onChange, disabled = false }: {
	value: Immutable<RoomBackgroundConfig> | null;
	onChange?: (background: Immutable<RoomBackgroundConfig>) => void;
	disabled?: boolean;
}): ReactElement {
	const assetManager = useAssetManager();
	const [showBackgrounds, setShowBackgrounds] = useState(false);

	const defaultBackground = assetManager.getBackgrounds()[0]?.id ?? DEFAULT_BACKGROUND;
	const actualValue = value ?? defaultBackground;

	return (
		<FieldsetToggle legend='Background'>
			{ showBackgrounds && !disabled && <BackgroundSelectDialog
				hide={ () => setShowBackgrounds(false) }
				current={ actualValue }
				select={ (background) => onChange?.(background) }
			/> }
			{
				typeof actualValue === 'string' ? (
					<Column>
						<BackgroundInfo background={ actualValue } />
						<Button
							onClick={ () => setShowBackgrounds(true) }
							disabled={ disabled }
							className='fadeDisabled'
						>
							Select a background
						</Button>
					</Column>
				) : (
					<>
						<div className='input-container'>
							<label>Background color</label>
							<div className='row-first'>
								<ColorInput
									initialValue={ actualValue.image.startsWith('#') ? actualValue.image : '#FFFFFF' }
									onChange={ (color) => onChange?.({ ...actualValue, image: color }) }
									disabled={ disabled }
								/>
							</div>
						</div>
						<br />
						<Button
							onClick={ () => setShowBackgrounds(true) }
							disabled={ disabled }
							className='fadeDisabled'
						>
							Select a background
						</Button>
					</>
				)
			}
		</FieldsetToggle>
	);
}

function BackgroundInfo({ background }: { background: string; }): ReactElement {
	const assetManager = useAssetManager();
	const backgroundInfo = useMemo(() => assetManager.getBackgrounds().find((b) => b.id === background), [assetManager, background]);

	if (backgroundInfo == null) {
		return (
			<Column className='backgroundInfo'>
				[ ERROR: Unknown background "{ background }" ]
			</Column>
		);
	}

	return (
		<Column className='backgroundInfo'>
			<span className='name'>{ backgroundInfo.name }</span>
			<div className='preview'>
				<img src={ GetAssetsSourceUrl() + backgroundInfo.image } />
			</div>
		</Column>
	);
}

function BackgroundSelectDialog({ hide, current, select }: {
	hide: () => void;
	current: Immutable<RoomBackgroundConfig>;
	select: (background: Immutable<RoomBackgroundConfig>) => void;
}): ReactElement | null {
	const assetManager = useAssetManager();
	const [selectedBackground, setSelectedBackground] = useState(current);

	useEffect(() => {
		setSelectedBackground(current);
	}, [current]);

	const [nameFilter, setNameFilter] = useState('');
	const [selection, setSelection] = useState(() => BackgroundSelectionStateClass.create(assetManager));

	/** Comparator for sorting backgrounds */
	const backgroundSortOrder = useCallback((a: Readonly<RoomBackgroundInfo>, b: Readonly<RoomBackgroundInfo>): number => {
		return a.name.localeCompare(b.name);
	}, []);

	const backgroundsToShow = useMemo(() => {
		const filterParts = nameFilter.toLowerCase().trim().split(/\s+/);
		return selection.backgrounds
			.filter((b) => filterParts.every((f) => b.name.toLowerCase().includes(f)))
			.sort(backgroundSortOrder);
	}, [selection, nameFilter, backgroundSortOrder]);

	const nameFilterInput = useRef<HTMLInputElement>(null);
	useInputAutofocus(nameFilterInput);

	return (
		<ModalDialog position='top'>
			<div className='backgroundSelect'>
				<div className='header'>
					<div className='header-filter'>
						<span>Select a background for the room</span>
						<input ref={ nameFilterInput }
							className='input-filter'
							placeholder='Background name…'
							value={ nameFilter }
							onChange={ (e) => setNameFilter(e.target.value) }
						/>
					</div>
					<div className='header-tags'>
						{
							selection.knownCategories.map((category) => (
								<TagCategoryButton
									key={ category }
									category={ category }
									selection={ selection }
									setSelection={ setSelection }
								/>
							))
						}
					</div>
				</div>
				<Scrollbar className='backgrounds' color='lighter'>
					{ backgroundsToShow
						.map((b) => (
							<a key={ b.id }
								onClick={ () => {
									setSelectedBackground(b.id);
								} }
							>
								<SelectionIndicator
									direction='column'
									align='center'
									justify='center'
									padding='small'
									selected={ b.id === selectedBackground }
									active={ b.id === current }
									className='details'
								>
									<div className='preview'>
										<img src={ GetAssetsSourceUrl() + b.preview } />
									</div>
									<div className='name'>{ b.name }</div>
								</SelectionIndicator>
							</a>
						)) }
				</Scrollbar>
				<Row className='footer' alignX='space-between'>
					<Button onClick={ hide }>Cancel</Button>
					<Button
						disabled={ IsObject(current) }
						className='hideDisabled'
						onClick={ () => {
							select(CloneDeepMutable(DEFAULT_BACKGROUND));
							hide();
						} }>
						Solid-color background
					</Button>
					<Button
						onClick={ () => {
							select(selectedBackground);
							hide();
						} }
					>
						Confirm
					</Button>
				</Row>
			</div>
		</ModalDialog>
	);
}

type BackgroundTag = Readonly<RoomBackgroundTagDefinition & { id: string; }>;

function TagCategoryButton({ category, selection, setSelection }: {
	category: string;
	selection: BackgroundSelectionStateClass;
	setSelection: (selection: BackgroundSelectionStateClass) => void;
}): ReactElement {
	const selected = selection.isSelectedCategory(category);
	const onClick = useCallback((ev: React.MouseEvent) => {
		ev.preventDefault();
		ev.stopPropagation();
		setSelection(selection.toggleCategory(category));
	}, [category, selection, setSelection]);
	return (
		<div className='dropdown'>
			<Button className='slim dropdown-button' onClick={ onClick }>
				{ category }
				<span>{ selected ? '✓' : ' ' }</span>
			</Button>
			<div className='dropdown-content'>
				{ selection.getTagsByCategory(category).map((tag) => (
					<TagButton key={ tag.id } id={ tag.id } name={ tag.name } selection={ selection } setSelection={ setSelection } />
				)) }
			</div>
		</div>
	);
}

function TagButton({ id, name, selection, setSelection }: {
	id: string;
	name: string;
	selection: BackgroundSelectionStateClass;
	setSelection: (selection: BackgroundSelectionStateClass) => void;
}): ReactElement {
	const selected = selection.isSelectedTag(id);
	const onClick = useCallback((ev: React.MouseEvent) => {
		ev.preventDefault();
		ev.stopPropagation();
		setSelection(selection.toggleTag(id));
	}, [id, selection, setSelection]);
	const onDoubleClick = useCallback((ev: React.MouseEvent) => {
		ev.preventDefault();
		ev.stopPropagation();
		setSelection(selection.fullToggleTag(id));
	}, [id, selection, setSelection]);
	return (
		<a onClick={ onClick } onDoubleClick={ onDoubleClick }>
			<span>{ selected ? '✓' : ' ' }</span>
			{ name }
		</a>
	);
}

interface BackgroundSelectionState {
	readonly availableBackgrounds: readonly Readonly<RoomBackgroundInfo>[];
	readonly availableTags: ReadonlyMap<string, readonly BackgroundTag[]>;
	readonly backgroundTags: ReadonlyMap<string, Readonly<RoomBackgroundTagDefinition>>;
	readonly tagToCategory: ReadonlyMap<string, string>;
	readonly categories: readonly string[];
	readonly selectedCategories: Set<string>;
	readonly selectedTags: ReadonlyMap<string, Set<string>>;
}

class BackgroundSelectionStateClass {
	private readonly state: BackgroundSelectionState;
	public readonly backgrounds: readonly Readonly<RoomBackgroundInfo>[];
	public readonly categories: ReadonlySet<string>;

	public get knownCategories(): readonly string[] {
		return this.state.categories;
	}

	private constructor(state: BackgroundSelectionState) {
		this.state = state;
		this.backgrounds = state.availableBackgrounds.filter((b) => BackgroundSelectionStateClass.isSelected(state, b));
		this.categories = this.state.selectedCategories;
	}

	public static create(assetManager: AssetManager): BackgroundSelectionStateClass {
		const availableBackgrounds = assetManager.getBackgrounds();
		const backgroundTags = assetManager.backgroundTags;
		const categories = uniq([...backgroundTags.values()].map((tag) => tag.category));
		const tagToCategory = new Map<string, string>();
		for (const [id, tag] of backgroundTags.entries()) {
			tagToCategory.set(id, tag.category);
		}
		const availableTags = new Map<string, readonly BackgroundTag[]>();
		const selectedTags = new Map<string, Set<string>>();
		for (const category of categories) {
			selectedTags.set(category, new Set<string>());
			const tags: BackgroundTag[] = [];
			for (const [id, tag] of backgroundTags.entries()) {
				if (tag.category === category) {
					tags.push({ ...tag, id });
				}
			}
			availableTags.set(category, tags);
		}
		return new BackgroundSelectionStateClass({
			availableBackgrounds,
			availableTags,
			backgroundTags,
			tagToCategory,
			categories,
			selectedCategories: new Set<string>(),
			selectedTags,
		});
	}

	public isSelectedCategory(category: string): boolean {
		return this.state.selectedCategories.has(category);
	}

	public isSelectedTag(tag: string): boolean {
		const category = this.state.tagToCategory.get(tag);
		if (!category) {
			return false;
		}
		const tags = this.state.selectedTags.get(category);
		return tags != null && tags.has(tag);
	}

	public toggleTag(tag: string): BackgroundSelectionStateClass {
		const category = this.state.tagToCategory.get(tag);
		if (!category) {
			return this;
		}
		const selected = this.state.selectedTags.get(category);
		if (!selected) {
			return this;
		}
		if (!selected.delete(tag)) {
			selected.add(tag);
			this.state.selectedCategories.add(category);

		} else if (selected.size === 0) {
			this.state.selectedCategories.delete(category);
		}
		return new BackgroundSelectionStateClass(this.state);
	}

	public fullToggleTag(tag: string): BackgroundSelectionStateClass {
		const category = this.state.tagToCategory.get(tag);
		if (!category) {
			return this;
		}
		const selected = this.state.selectedTags.get(category);
		if (!selected) {
			return this;
		}
		this.state.selectedCategories.add(category);
		if (!selected.has(tag)) {
			selected.clear();
			selected.add(tag);
		} else {
			const tags = this.state.availableTags.get(category)!;
			selected.clear();
			for (const t of tags) {
				if (t.id !== tag) {
					selected.add(t.id);
				}
			}
		}
		return new BackgroundSelectionStateClass(this.state);
	}

	public toggleCategory(category: string): BackgroundSelectionStateClass {
		const selected = this.state.selectedTags.get(category);
		if (!selected) {
			return this;
		}
		if (!this.state.selectedCategories.delete(category)) {
			this.state.selectedCategories.add(category);
			const tags = this.state.availableTags.get(category)!;
			for (const t of tags) {
				selected.add(t.id);
			}
		} else {
			selected.clear();
		}
		return new BackgroundSelectionStateClass(this.state);
	}

	public getTagsByCategory(category: string): readonly BackgroundTag[] {
		return this.state.availableTags.get(category) ?? EMPTY_ARRAY;
	}

	private static isSelected(state: BackgroundSelectionState, info: Readonly<RoomBackgroundInfo>): boolean {
		if (state.selectedCategories.size === 0) {
			return true;
		}
		for (const category of state.selectedCategories) {
			const tags = state.selectedTags.get(category);
			if (!tags || !info.tags.some((tag) => tags.has(tag))) {
				return false;
			}
		}
		return true;
	}
}
