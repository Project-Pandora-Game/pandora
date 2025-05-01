import { Immutable } from 'immer';
import { uniq } from 'lodash-es';
import {
	AssetManager,
	CloneDeepMutable,
	DEFAULT_PLAIN_BACKGROUND,
	EMPTY_ARRAY,
	RoomBackgroundInfo,
	RoomBackgroundTagDefinition,
	type AppearanceAction,
	type RoomGeometryConfig,
} from 'pandora-common';
import React, { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GetAssetsSourceUrl, useAssetManager } from '../../../assets/assetManager.tsx';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { useInputAutofocus } from '../../../common/userInteraction/inputAutofocus.ts';
import { Button } from '../../../components/common/button/button.tsx';
import { ColorInput } from '../../../components/common/colorInput/colorInput.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { SelectionIndicator } from '../../../components/common/selectionIndicator/selectionIndicator.tsx';
import { ModalDialog } from '../../../components/dialog/dialog.tsx';
import { GameLogicActionButton } from '../../../components/wardrobe/wardrobeComponents.tsx';
import './backgroundSelect.scss';

export function BackgroundSelectDialog({ hide, current }: {
	hide: () => void;
	current: Immutable<RoomGeometryConfig>;
}): ReactElement | null {
	const assetManager = useAssetManager();
	const [selectedBackground, setSelectedBackground] = useState<Immutable<RoomGeometryConfig>>(current);

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

	const nameFilterInput = useRef<TextInput>(null);
	useInputAutofocus(nameFilterInput);

	const updateBackgroundAction = useMemo((): AppearanceAction => ({
		type: 'roomConfigure',
		roomGeometry: CloneDeepMutable(selectedBackground),
	}), [selectedBackground]);

	return (
		<ModalDialog position='top'>
			<div className='backgroundSelect'>
				<div className='header'>
					<div className='header-filter'>
						<span>Select a background for the room</span>
						<TextInput ref={ nameFilterInput }
							className='input-filter'
							placeholder='Background name…'
							value={ nameFilter }
							onChange={ setNameFilter }
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
				<div className='backgrounds'>
					{ backgroundsToShow
						.map((b) => (
							<SelectionIndicator key={ b.id }
								padding='tiny'
								selected={ selectedBackground.type === 'premade' && selectedBackground.id === b.id }
								active={ current.type === 'premade' && current.id === b.id }
							>
								<Button
									className='fill'
									onClick={ () => {
										setSelectedBackground({
											type: 'premade',
											id: b.id,
										});
									} }
								>
									<Column
										alignX='center'
										alignY='center'
										className='details fill'
									>
										<div className='preview'>
											<img src={ GetAssetsSourceUrl() + b.preview } />
										</div>
										<div className='name'>{ b.name }</div>
									</Column>
								</Button>
							</SelectionIndicator>
						)) }
					<SelectionIndicator
						padding='tiny'
						selected={ selectedBackground.type === 'plain' }
						active={ current.type === 'plain' }
					>
						<Button
							className='fill'
							onClick={ () => {
								setSelectedBackground(DEFAULT_PLAIN_BACKGROUND);
							} }
						>
							<Column
								alignX='center'
								alignY='center'
								className='details fill'
							>
								<div className='name'>[ Solid-color background ]</div>
							</Column>
						</Button>
					</SelectionIndicator>
					<SelectionIndicator
						padding='tiny'
						selected={ selectedBackground.type === 'defaultPublicSpace' }
						active={ current.type === 'defaultPublicSpace' }
					>
						<Button
							className='fill'
							onClick={ () => {
								setSelectedBackground({ type: 'defaultPublicSpace' });
							} }
						>
							<Column
								alignX='center'
								alignY='center'
								className='details fill'
							>
								<div className='name'>[ Default background for new spaces ]</div>
							</Column>
						</Button>
					</SelectionIndicator>
					<SelectionIndicator
						padding='tiny'
						selected={ selectedBackground.type === 'defaultPersonalSpace' }
						active={ current.type === 'defaultPersonalSpace' }
					>
						<Button
							className='fill'
							onClick={ () => {
								setSelectedBackground({ type: 'defaultPersonalSpace' });
							} }
						>
							<Column
								alignX='center'
								alignY='center'
								className='details fill'
							>
								<div className='name'>[ Default background for personal space ]</div>
							</Column>
						</Button>
					</SelectionIndicator>
				</div>
				{
					selectedBackground.type === 'plain' ? (
						<Column className='solidBackgroundOptions' padding='medium'>
							<label>Background color</label>
							<Row alignY='center'>
								<ColorInput
									initialValue={ selectedBackground.image }
									onChange={ (color) => setSelectedBackground({ ...selectedBackground, image: color }) }
									title='Background color'
									classNameTextInput='flex-1'
								/>
							</Row>
						</Column>
					) : null
				}
				<Row className='footer' alignX='space-between' wrap>
					<Button onClick={ hide }>Cancel</Button>
					<GameLogicActionButton
						action={ updateBackgroundAction }
						onExecute={ hide }
					>
						Update room background
					</GameLogicActionButton>
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
