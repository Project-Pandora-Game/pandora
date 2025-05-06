import classNames from 'classnames';
import { Immutable, produce } from 'immer';
import { noop, uniq } from 'lodash-es';
import {
	AssertNever,
	AssetManager,
	CharacterSize,
	CloneDeepMutable,
	DEFAULT_PLAIN_BACKGROUND,
	EMPTY_ARRAY,
	ParseNotNullable,
	ResolveBackground,
	RoomBackground3dBoxSideSchema,
	RoomBackgroundInfo,
	RoomBackgroundTagDefinition,
	type AppearanceAction,
	type RoomBackground3dBoxSide,
	type RoomGeometryConfig,
} from 'pandora-common';
import React, { ReactElement, useCallback, useId, useMemo, useRef, useState } from 'react';
import { GetAssetsSourceUrl, useAssetManager } from '../../../assets/assetManager.tsx';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { useInputAutofocus } from '../../../common/userInteraction/inputAutofocus.ts';
import { Select } from '../../../common/userInteraction/select/select.tsx';
import { Button } from '../../../components/common/button/button.tsx';
import { ColorInput } from '../../../components/common/colorInput/colorInput.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { SelectionIndicator } from '../../../components/common/selectionIndicator/selectionIndicator.tsx';
import { ModalDialog } from '../../../components/dialog/dialog.tsx';
import { GameLogicActionButton } from '../../../components/wardrobe/wardrobeComponents.tsx';
import { Container } from '../../../graphics/baseComponents/container.ts';
import { GRAPHICS_BACKGROUND_TILE_SIZE, GraphicsBackground } from '../../../graphics/graphicsBackground.tsx';
import { GraphicsSceneBackgroundRenderer } from '../../../graphics/graphicsSceneRenderer.tsx';
import { serviceManagerContext } from '../../../services/serviceProvider.tsx';
import './backgroundSelect.scss';

const DEFAULT_BACKGROUND_3D_BOX: Extract<Immutable<RoomGeometryConfig>, { type: '3dBox'; }> = {
	type: '3dBox',
	floorArea: [Math.ceil(6000 / GRAPHICS_BACKGROUND_TILE_SIZE) * GRAPHICS_BACKGROUND_TILE_SIZE, Math.ceil(1500 / GRAPHICS_BACKGROUND_TILE_SIZE) * GRAPHICS_BACKGROUND_TILE_SIZE],
	ceiling: Math.ceil(2000 / GRAPHICS_BACKGROUND_TILE_SIZE) * GRAPHICS_BACKGROUND_TILE_SIZE,
	cameraFov: 80,
	cameraHeight: 1200,
	graphics: {
		type: '3dBox',
		floor: {
			texture: '*',
			tint: '#880000',
			rotate: false,
			tileScale: 2,
		},
		wallBack: {
			texture: '*',
			tint: '#808080',
			rotate: false,
			tileScale: 2,
		},
		wallLeft: {
			texture: '*',
			tint: '#707070',
			rotate: false,
			tileScale: 2,
		},
		wallRight: {
			texture: '*',
			tint: '#707070',
			rotate: false,
			tileScale: 2,
		},
		ceiling: {
			texture: '*',
			tint: '#AAAAAA',
			rotate: false,
			tileScale: 2,
		},
	},
};

export function BackgroundSelectDialog({ hide, current }: {
	hide: () => void;
	current: Immutable<RoomGeometryConfig>;
}): ReactElement | null {
	const assetManager = useAssetManager();
	const id = useId();

	const [selectedBackground, setSelectedBackground] = useState<Immutable<RoomGeometryConfig>>(current);

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
					</div>
				</div>
				<Row alignY='center'>
					<label htmlFor={ id + ':background-type' }>Background type:</label>
					<Select
						className='flex-1'
						id={ id + ':background-type' }
						value={ selectedBackground.type }
						onChange={ (e) => {
							const type = e.target.value as RoomGeometryConfig['type'];
							if (selectedBackground.type === type)
								return;

							switch (type) {
								case 'defaultPersonalSpace':
								case 'defaultPublicSpace':
									setSelectedBackground({ type });
									break;
								case 'premade':
									setSelectedBackground({
										type: 'premade',
										id: ParseNotNullable(assetManager.getBackgrounds()[0]).id,
									});
									break;
								case 'plain':
									setSelectedBackground(DEFAULT_PLAIN_BACKGROUND);
									break;
								case '3dBox':
									setSelectedBackground(DEFAULT_BACKGROUND_3D_BOX);
									break;
								default:
									AssertNever(type);
									break;
							}
						} }
					>
						<option value='3dBox'>Custom 3D box</option>
						{
							assetManager.getBackgrounds().length > 0 ? (
								<option value='premade'>Static image background</option>
							) : null
						}
						<option value='plain'>Solid-color background</option>
						<option value='defaultPublicSpace'>Default background for new spaces</option>
						<option value='defaultPersonalSpace'>Default background for personal space</option>
					</Select>
				</Row>
				{
					selectedBackground.type === 'defaultPersonalSpace' ? (
						null
					) :
					selectedBackground.type === 'defaultPublicSpace' ? (
						null
					) :
					selectedBackground.type === 'premade' ? (
						<BackgroundSelectDialogPremade
							current={ current }
							selectedBackground={ selectedBackground }
							setSelectedBackground={ setSelectedBackground }
						/>
					) :
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
					) :
					selectedBackground.type === '3dBox' ? (
						<BackgroundSelectDialog3dBox
							current={ current }
							selectedBackground={ selectedBackground }
							setSelectedBackground={ setSelectedBackground }
						/>
					) :
					AssertNever(selectedBackground.type)
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

function BackgroundSelectDialogPremade({ current, selectedBackground, setSelectedBackground }: {
	current: Immutable<RoomGeometryConfig>;
	selectedBackground: Extract<Immutable<RoomGeometryConfig>, { type: 'premade'; }>;
	setSelectedBackground: (newBackground: Immutable<RoomGeometryConfig>) => void;
}): ReactElement {
	const assetManager = useAssetManager();

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

	return (
		<>
			<div className='header'>
				<div className='header-filter'>
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
			</div>
		</>
	);
}

function BackgroundSelectDialog3dBox({ current, selectedBackground, setSelectedBackground }: {
	current: Immutable<RoomGeometryConfig>;
	selectedBackground: Extract<Immutable<RoomGeometryConfig>, { type: '3dBox'; }>;
	setSelectedBackground: (newBackground: Immutable<RoomGeometryConfig>) => void;
}): ReactElement {
	const assetManager = useAssetManager();
	const resolvedBackground = ResolveBackground(assetManager, selectedBackground);
	const previewSize = 256 * (window.devicePixelRatio || 1);
	const previewScale = resolvedBackground != null ? Math.min(previewSize / resolvedBackground.imageSize[0], previewSize / resolvedBackground.imageSize[1]) : 1;

	return (
		<Column className='solidBackgroundOptions' padding='medium'>
			<Row gap='large'>
				<Column className='flex-1'>
					<Row alignY='center' gap='medium'>
						<span className='flex-1'>Room width</span>
						<NumberInput
							className='flex-6 zero-width'
							rangeSlider
							aria-label='Room width'
							min={ Math.ceil(CharacterSize.WIDTH / GRAPHICS_BACKGROUND_TILE_SIZE) * GRAPHICS_BACKGROUND_TILE_SIZE }
							max={ 128 * GRAPHICS_BACKGROUND_TILE_SIZE }
							step={ GRAPHICS_BACKGROUND_TILE_SIZE }
							value={ selectedBackground.floorArea[0] }
							onChange={ (newValue) => setSelectedBackground(produce(selectedBackground, (d) => {
								d.floorArea[0] = newValue;
							})) }
						/>
						<NumberInput
							className='flex-grow-1 value'
							aria-label='Room width'
							min={ Math.ceil(CharacterSize.WIDTH / GRAPHICS_BACKGROUND_TILE_SIZE) * GRAPHICS_BACKGROUND_TILE_SIZE }
							max={ 128 * GRAPHICS_BACKGROUND_TILE_SIZE }
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
							max={ 128 * GRAPHICS_BACKGROUND_TILE_SIZE }
							step={ GRAPHICS_BACKGROUND_TILE_SIZE }
							value={ selectedBackground.floorArea[1] }
							onChange={ (newValue) => setSelectedBackground(produce(selectedBackground, (d) => {
								d.floorArea[1] = newValue;
							})) }
						/>
						<NumberInput
							className='flex-grow-1 value'
							aria-label='Room depth'
							min={ 0 }
							max={ 128 * GRAPHICS_BACKGROUND_TILE_SIZE }
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
							min={ Math.ceil(CharacterSize.HEIGHT / GRAPHICS_BACKGROUND_TILE_SIZE) * GRAPHICS_BACKGROUND_TILE_SIZE }
							max={ 128 * GRAPHICS_BACKGROUND_TILE_SIZE }
							step={ GRAPHICS_BACKGROUND_TILE_SIZE }
							value={ selectedBackground.ceiling }
							onChange={ (newValue) => setSelectedBackground(produce(selectedBackground, (d) => {
								d.ceiling = newValue;
							})) }
						/>
						<NumberInput
							className='flex-grow-1 value'
							aria-label='Room height'
							min={ Math.ceil(CharacterSize.HEIGHT / GRAPHICS_BACKGROUND_TILE_SIZE) * GRAPHICS_BACKGROUND_TILE_SIZE }
							max={ 128 * GRAPHICS_BACKGROUND_TILE_SIZE }
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
							max={ 128 * GRAPHICS_BACKGROUND_TILE_SIZE }
							step={ 1 }
							value={ selectedBackground.cameraHeight }
							onChange={ (newValue) => setSelectedBackground(produce(selectedBackground, (d) => {
								d.cameraHeight = newValue;
							})) }
						/>
					</Row>
				</Column>
				{
					resolvedBackground != null ? (
						<GraphicsSceneBackgroundRenderer
							renderArea={ { x: 0, y: 0, width: previewSize, height: previewSize } }
							resolution={ 1 }
							backgroundColor={ 0x000000 }
							forwardContexts={ [serviceManagerContext] }
						>
							<Container
								scale={ { x: previewScale, y: previewScale } }
								x={ (previewSize - previewScale * resolvedBackground.imageSize[0]) / 2 }
								y={ (previewSize - previewScale * resolvedBackground.imageSize[1]) / 2 }
							>
								<GraphicsBackground
									background={ resolvedBackground }
								/>
							</Container>
						</GraphicsSceneBackgroundRenderer>
					) : null
				}
			</Row>
			<Row alignY='center'>
				<Checkbox
					checked={ selectedBackground.graphics.ceiling != null }
					onChange={ (checked) => {
						setSelectedBackground(produce(selectedBackground, (d) => {
							d.graphics.ceiling = checked ? DEFAULT_BACKGROUND_3D_BOX.graphics.ceiling : null;
						}));
					} }
				/>
				<BackgroundSelectDialog3dBoxSide
					title='Ceiling'
					current={ current.type === '3dBox' ? current.graphics.ceiling : null }
					value={ selectedBackground.graphics.ceiling }
					onChange={ (newValue) => {
						setSelectedBackground(produce(selectedBackground, (d) => {
							d.graphics.ceiling = newValue;
						}));
					} }
				/>
			</Row>
			<Row alignY='center'>
				<Checkbox checked readOnly onChange={ noop } />
				<BackgroundSelectDialog3dBoxSide
					title='Back wall'
					current={ current.type === '3dBox' ? current.graphics.wallBack : null }
					value={ selectedBackground.graphics.wallBack }
					onChange={ (newValue) => {
						setSelectedBackground(produce(selectedBackground, (d) => {
							d.graphics.wallBack = newValue;
						}));
					} }
				/>
			</Row>
			<Row alignY='center'>
				<Checkbox
					checked={ selectedBackground.graphics.wallLeft != null }
					onChange={ (checked) => {
						setSelectedBackground(produce(selectedBackground, (d) => {
							d.graphics.wallLeft = checked ? DEFAULT_BACKGROUND_3D_BOX.graphics.wallLeft : null;
						}));
					} }
				/>
				<BackgroundSelectDialog3dBoxSide
					title='Left wall'
					current={ current.type === '3dBox' ? current.graphics.wallLeft : null }
					value={ selectedBackground.graphics.wallLeft }
					onChange={ (newValue) => {
						setSelectedBackground(produce(selectedBackground, (d) => {
							d.graphics.wallLeft = newValue;
						}));
					} }
				/>
			</Row>
			<Row alignY='center'>
				<Checkbox
					checked={ selectedBackground.graphics.wallRight != null }
					onChange={ (checked) => {
						setSelectedBackground(produce(selectedBackground, (d) => {
							d.graphics.wallRight = checked ? DEFAULT_BACKGROUND_3D_BOX.graphics.wallRight : null;
						}));
					} }
				/>
				<BackgroundSelectDialog3dBoxSide
					title='Right wall'
					current={ current.type === '3dBox' ? current.graphics.wallRight : null }
					value={ selectedBackground.graphics.wallRight }
					onChange={ (newValue) => {
						setSelectedBackground(produce(selectedBackground, (d) => {
							d.graphics.wallRight = newValue;
						}));
					} }
				/>
			</Row>
			<Row alignY='center'>
				<Checkbox checked readOnly onChange={ noop } />
				<BackgroundSelectDialog3dBoxSide
					title='Floor'
					current={ current.type === '3dBox' ? current.graphics.floor : null }
					value={ selectedBackground.graphics.floor }
					onChange={ (newValue) => {
						setSelectedBackground(produce(selectedBackground, (d) => {
							d.graphics.floor = newValue;
						}));
					} }
				/>
			</Row>
		</Column>
	);
}

function BackgroundSelectDialog3dBoxSide({ current, value, onChange, title }: {
	title: string;
	current: Immutable<RoomBackground3dBoxSide> | null;
	value: Immutable<RoomBackground3dBoxSide> | null;
	onChange: (newValue: Immutable<RoomBackground3dBoxSide>) => void;
}): ReactElement {
	const assetManager = useAssetManager();

	const [showTextureSelectDialog, setShowTextureSelectDialog] = useState(false);

	return (
		<>
			<span className='flex-1'>{ title }: </span>
			<span className='flex-2'>{ value == null ? '[ None ]' : value.texture === '*' ? 'Solid color' : (assetManager.tileTextures.get(value.texture)?.name ?? '[ Unknown ]') }</span>
			<ColorInput
				initialValue={ value?.tint ?? '#000000' }
				disabled={ value == null }
				onChange={ (color) => {
					if (value != null) {
						onChange(produce(value, (d) => {
							d.tint = color;
						}));
					}
				} }
				title={ `Background ${ title.toLowerCase() } color` }
				classNameTextInput='flex-2'
			/>
			<Button
				disabled={ value == null }
				onClick={ () => {
					setShowTextureSelectDialog(true);
				} }
				slim
			>
				Change
			</Button>
			{
				showTextureSelectDialog && value != null ? (
					<BackgroundSelectDialog3dBoxSideDialog
						title={ title }
						current={ current }
						value={ value }
						onChange={ onChange }
						hide={ () => {
							setShowTextureSelectDialog(false);
						} }
					/>
				) : null
			}
		</>
	);
}

function BackgroundSelectDialog3dBoxSideDialog({ current, value, onChange, title, hide }: {
	title: string;
	current: Immutable<RoomBackground3dBoxSide> | null;
	value: Immutable<RoomBackground3dBoxSide>;
	onChange: (newValue: Immutable<RoomBackground3dBoxSide>) => void;
	hide: () => void;
}): ReactElement {
	const id = useId();
	const assetManager = useAssetManager();

	return (
		<ModalDialog position='top'>
			<div className='backgroundSelect'>
				<div className='header'>
					<div className='header-filter'>
						<span>Select a texture for { title.toLowerCase() }</span>
					</div>
				</div>
				<div className='backgrounds'>
					<SelectionIndicator
						padding='tiny'
						selected={ value.texture === '*' }
						active={ current != null && current.texture === '*' }
					>
						<Button
							className='fill'
							onClick={ () => {
								onChange(produce(value, (d) => {
									d.texture = '*';
								}));
							} }
						>
							<Column
								alignX='center'
								alignY='center'
								className='details fill'
							>
								<div className='name'>[ Solid color ]</div>
							</Column>
						</Button>
					</SelectionIndicator>
					{ Array.from(assetManager.tileTextures.values())
						.map((b) => (
							<SelectionIndicator key={ b.id }
								padding='tiny'
								selected={ value.texture === b.id }
								active={ current != null && current.texture === b.id }
							>
								<Button
									className='fill'
									onClick={ () => {
										onChange(produce(value, (d) => {
											d.texture = b.id;
										}));
									} }
								>
									<Column
										alignX='center'
										alignY='center'
										className='details fill'
									>
										<div className={ classNames('preview', value.rotate ? 'rotate-90' : null) }>
											<img src={ GetAssetsSourceUrl() + b.image } />
										</div>
										<div className='name'>{ b.name }</div>
									</Column>
								</Button>
							</SelectionIndicator>
						)) }
				</div>
				<Column className='solidBackgroundOptions' padding='medium'>
					<Row alignY='center'>
						<Checkbox
							id={ id + ':rotate' }
							checked={ value.rotate }
							onChange={ (checked) => {
								onChange(produce(value, (d) => {
									d.rotate = checked;
								}));
							} }
						/>
						<label htmlFor={ id + ':rotate' }>Rotate texture by 90°</label>
					</Row>
					<Row alignY='center' gap='medium'>
						<span className='flex-1'>Tile scale</span>
						<NumberInput
							className='flex-6 zero-width'
							rangeSlider
							aria-label='Camera height'
							min={ 1 }
							max={ RoomBackground3dBoxSideSchema.shape.tileScale._def.innerType.maxValue ?? 10 }
							step={ 1 }
							value={ value.tileScale }
							onChange={ (newValue) => onChange(produce(value, (d) => {
								d.tileScale = newValue;
							})) }
						/>
						<NumberInput
							className='flex-grow-1 value'
							aria-label='Camera height'
							min={ 1 }
							max={ RoomBackground3dBoxSideSchema.shape.tileScale._def.innerType.maxValue ?? 10 }
							step={ 1 }
							value={ value.tileScale }
							onChange={ (newValue) => onChange(produce(value, (d) => {
								d.tileScale = newValue;
							})) }
						/>
					</Row>
				</Column>
				<Row className='footer' alignX='center' wrap>
					<Button onClick={ hide }>Confirm</Button>
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
