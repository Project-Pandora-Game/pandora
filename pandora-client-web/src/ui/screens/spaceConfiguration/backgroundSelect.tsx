import { Immutable, produce } from 'immer';
import { uniq } from 'lodash-es';
import {
	AssetManager,
	CharacterSize,
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
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
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
						selected={ selectedBackground.type === '3dBox' }
						active={ current.type === '3dBox' }
					>
						<Button
							className='fill'
							onClick={ () => {
								setSelectedBackground({
									type: '3dBox',
									floorArea: [6000, 1500],
									ceiling: 2000,
									cameraFov: 80,
									cameraHeight: 1200,
									graphics: {
										type: '3dBox',
										floor: '#880000',
										wallBack: '#505050',
										wallLeft: '#404040',
										wallRight: '#404040',
										ceiling: '#808080',
									},
								});
							} }
						>
							<Column
								alignX='center'
								alignY='center'
								className='details fill'
							>
								<div className='name'>[ Custom 3D box ]</div>
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
				{
					selectedBackground.type === '3dBox' ? (
						<Column className='solidBackgroundOptions' padding='medium'>
							<Row alignY='center' gap='medium'>
								<span className='flex-1'>Room width</span>
								<NumberInput
									className='flex-6 zero-width'
									rangeSlider
									aria-label='Room width'
									min={ CharacterSize.WIDTH }
									max={ 10_000 }
									step={ 1 }
									value={ selectedBackground.floorArea[0] }
									onChange={ (newValue) => setSelectedBackground(produce(selectedBackground, (d) => {
										d.floorArea[0] = newValue;
									})) }
								/>
								<NumberInput
									className='flex-grow-1 value'
									aria-label='Room width'
									min={ CharacterSize.WIDTH }
									max={ 10_000 }
									step={ 1 }
									value={ selectedBackground.floorArea[0] }
									onChange={ (newValue) => setSelectedBackground(produce(selectedBackground, (d) => {
										d.floorArea[0] = newValue;
									})) }
								/>
							</Row>
							<Row alignY='center' gap='medium'>
								<span className='flex-1'>Room depth</span>
								<NumberInput
									className='flex-6 zero-width'
									rangeSlider
									aria-label='Room depth'
									min={ 0 }
									max={ 10_000 }
									step={ 1 }
									value={ selectedBackground.floorArea[1] }
									onChange={ (newValue) => setSelectedBackground(produce(selectedBackground, (d) => {
										d.floorArea[1] = newValue;
									})) }
								/>
								<NumberInput
									className='flex-grow-1 value'
									aria-label='Room depth'
									min={ 0 }
									max={ 10_000 }
									step={ 1 }
									value={ selectedBackground.floorArea[1] }
									onChange={ (newValue) => setSelectedBackground(produce(selectedBackground, (d) => {
										d.floorArea[1] = newValue;
									})) }
								/>
							</Row>
							<Row alignY='center' gap='medium'>
								<span className='flex-1'>Room height</span>
								<NumberInput
									className='flex-6 zero-width'
									rangeSlider
									aria-label='Room height'
									min={ CharacterSize.HEIGHT }
									max={ 10_000 }
									step={ 1 }
									value={ selectedBackground.ceiling }
									onChange={ (newValue) => setSelectedBackground(produce(selectedBackground, (d) => {
										d.ceiling = newValue;
									})) }
								/>
								<NumberInput
									className='flex-grow-1 value'
									aria-label='Room height'
									min={ CharacterSize.HEIGHT }
									max={ 10_000 }
									step={ 1 }
									value={ selectedBackground.ceiling }
									onChange={ (newValue) => setSelectedBackground(produce(selectedBackground, (d) => {
										d.ceiling = newValue;
									})) }
								/>
							</Row>
							<Row alignY='center' gap='medium'>
								<span className='flex-1'>Camera FOV</span>
								<NumberInput
									className='flex-6 zero-width'
									rangeSlider
									aria-label='Camera FOV'
									min={ 1 }
									max={ 135 }
									step={ 1 }
									value={ selectedBackground.cameraFov }
									onChange={ (newValue) => setSelectedBackground(produce(selectedBackground, (d) => {
										d.cameraFov = newValue;
									})) }
								/>
								<NumberInput
									className='flex-grow-1 value'
									aria-label='Camera FOV'
									min={ 1 }
									max={ 135 }
									step={ 1 }
									value={ selectedBackground.cameraFov }
									onChange={ (newValue) => setSelectedBackground(produce(selectedBackground, (d) => {
										d.cameraFov = newValue;
									})) }
								/>
							</Row>
							<Row alignY='center' gap='medium'>
								<span className='flex-1'>Camera height</span>
								<NumberInput
									className='flex-6 zero-width'
									rangeSlider
									aria-label='Camera height'
									min={ 0 }
									max={ 10_000 }
									step={ 1 }
									value={ selectedBackground.cameraHeight }
									onChange={ (newValue) => setSelectedBackground(produce(selectedBackground, (d) => {
										d.cameraHeight = newValue;
									})) }
								/>
								<NumberInput
									className='flex-grow-1 value'
									aria-label='Camera height'
									min={ 0 }
									max={ 10_000 }
									step={ 1 }
									value={ selectedBackground.cameraHeight }
									onChange={ (newValue) => setSelectedBackground(produce(selectedBackground, (d) => {
										d.cameraHeight = newValue;
									})) }
								/>
							</Row>
							<Row alignY='center'>
								<span className='flex-1'>Floor</span>
								<ColorInput
									initialValue={ selectedBackground.graphics.floor }
									onChange={ (color) => setSelectedBackground(produce(selectedBackground, (d) => {
										d.graphics.floor = color;
									})) }
									title='Background floor color'
									classNameTextInput='flex-2'
								/>
							</Row>
							<Row alignY='center'>
								<span className='flex-1'>Back wall</span>
								<ColorInput
									initialValue={ selectedBackground.graphics.wallBack }
									onChange={ (color) => setSelectedBackground(produce(selectedBackground, (d) => {
										d.graphics.wallBack = color;
									})) }
									title='Background back wall color'
									classNameTextInput='flex-2'
								/>
							</Row>
							<Row alignY='center'>
								<span className='flex-1'>Left wall</span>
								<Checkbox
									checked={ selectedBackground.graphics.wallLeft != null }
									onChange={ (checked) => {
										setSelectedBackground(produce(selectedBackground, (d) => {
											d.graphics.wallLeft = checked ? '#000000' : null;
										}));
									} }
								/>
								<ColorInput
									initialValue={ selectedBackground.graphics.wallLeft ?? '#000000' }
									disabled={ selectedBackground.graphics.wallLeft == null }
									onChange={ (color) => setSelectedBackground(produce(selectedBackground, (d) => {
										d.graphics.wallLeft = color;
									})) }
									title='Background left wall color'
									classNameTextInput='flex-2'
								/>
							</Row>
							<Row alignY='center'>
								<span className='flex-1'>Right wall</span>
								<Checkbox
									checked={ selectedBackground.graphics.wallRight != null }
									onChange={ (checked) => {
										setSelectedBackground(produce(selectedBackground, (d) => {
											d.graphics.wallRight = checked ? '#000000' : null;
										}));
									} }
								/>
								<ColorInput
									initialValue={ selectedBackground.graphics.wallRight ?? '#000000' }
									disabled={ selectedBackground.graphics.wallRight == null }
									onChange={ (color) => setSelectedBackground(produce(selectedBackground, (d) => {
										d.graphics.wallRight = color;
									})) }
									title='Background right wall color'
									classNameTextInput='flex-2'
								/>
							</Row>
							<Row alignY='center'>
								<span className='flex-1'>Ceiling</span>
								<Checkbox
									checked={ selectedBackground.graphics.ceiling != null }
									onChange={ (checked) => {
										setSelectedBackground(produce(selectedBackground, (d) => {
											d.graphics.ceiling = checked ? '#000000' : null;
										}));
									} }
								/>
								<ColorInput
									initialValue={ selectedBackground.graphics.ceiling ?? '#000000' }
									disabled={ selectedBackground.graphics.ceiling == null }
									onChange={ (color) => setSelectedBackground(produce(selectedBackground, (d) => {
										d.graphics.ceiling = color;
									})) }
									title='Background ceiling color'
									classNameTextInput='flex-2'
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
