import { CharacterAppearance, Assert, AssetGraphicsDefinition, AssetId, CharacterSize, LayerDefinition, LayerImageSetting, LayerMirror, Asset, ItemId, ActionRoomContext, CharacterRestrictionsManager, CloneDeepMutable, GetLogger, CharacterId, AssetFrameworkCharacterState, AssetFrameworkGlobalStateContainer, AssertNotNullable, CharacterView, ICharacterRoomData, CHARACTER_DEFAULT_PUBLIC_SETTINGS, TypedEventEmitter, GameLogicCharacter, GameLogicCharacterClient, DoAppearanceAction, AppearanceAction, AppearanceActionContext } from 'pandora-common';
import { BaseTexture, Texture } from 'pixi.js';
import { toast } from 'react-toastify';
import { AssetGraphics, AssetGraphicsLayer, LayerToImmediateName } from '../../../assets/assetGraphics';
import { GraphicsManagerInstance, IGraphicsLoader } from '../../../assets/graphicsManager';
import { LoadArrayBufferImageResource, StripAssetHash } from '../../../graphics/utility';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast';
import { Editor } from '../../editor';
import { cloneDeep } from 'lodash';
import { downloadZip, InputWithSizeMeta } from 'client-zip';
import { ICharacter, CharacterEvents } from '../../../character/character';
import { Immutable } from 'immer';
import { useEditorState } from '../../editorContextProvider';
import { EDITOR_ROOM_CONTEXT } from '../../components/wardrobe/wardrobe';

export interface EditorActionContext {
	dryRun?: boolean;
}

export class AppearanceEditor extends CharacterAppearance {
	public readonly globalState: AssetFrameworkGlobalStateContainer;

	constructor(characterState: AssetFrameworkCharacterState, character: GameLogicCharacter, globalState: AssetFrameworkGlobalStateContainer) {
		super(characterState, character);
		this.globalState = globalState;
	}

	protected _makeActionContext(): AppearanceActionContext {
		return {
			player: this.character,
			globalState: this.globalState,
			roomContext: EDITOR_ROOM_CONTEXT,
			getCharacter: (id) => {
				if (id === this.id) {
					return this.character;
				}
				return null;
			},
		};
	}

	public editorDoAction(
		action: AppearanceAction,
		{ dryRun = false }: EditorActionContext = {},
	): boolean {
		const result = DoAppearanceAction(action, this._makeActionContext(), this.assetManager);

		if (!result.valid || result.problems.length > 0) {
			return false;
		}

		if (!dryRun) {
			this.globalState.setState(result.resultState);
		}
		return true;
	}

	public setPose(bone: string, value: number): boolean {
		if (!Number.isInteger(value))
			throw new Error('Attempt to set non-int pose value');

		// This asserts existence of bone
		this.getPose(bone);

		return this.editorDoAction({
			type: this.assetManager.getBoneByName(bone).type,
			target: this.id,
			bones: { [bone]: value },
		});
	}

	public addItem(asset: Asset, context: EditorActionContext = {}): boolean {
		return this.editorDoAction({
			type: 'create',
			target: {
				type: 'character',
				characterId: this.id,
			},
			itemTemplate: {
				asset: asset.id,
			},
			container: [],
		}, context);
	}

	public removeItem(id: ItemId, context: EditorActionContext = {}): boolean {
		return this.editorDoAction({
			type: 'delete',
			target: {
				type: 'character',
				characterId: this.id,
			},
			item: {
				container: [],
				itemId: id,
			},
		}, context);
	}

	public moveItem(id: ItemId, shift: number, context: EditorActionContext = {}): boolean {
		return this.editorDoAction({
			type: 'move',
			target: {
				type: 'character',
				characterId: this.id,
			},
			item: {
				container: [],
				itemId: id,
			},
			shift,
		}, context);
	}

	public setView(view: CharacterView, context: EditorActionContext = {}): boolean {
		return this.editorDoAction({
			type: 'setView',
			target: this.id,
			view,
		}, context);
	}
}

export const EDITOR_CHARACTER_ID: CharacterId = 'c0';

export class EditorCharacter extends TypedEventEmitter<CharacterEvents<ICharacterRoomData>> implements ICharacter<ICharacterRoomData> {
	public readonly type = 'character';
	public readonly id = EDITOR_CHARACTER_ID;
	public readonly name = 'Editor character';

	public readonly editor: Editor;
	protected readonly logger = GetLogger('EditorCharacter');

	public readonly data: ICharacterRoomData;
	public readonly gameLogicCharacter: GameLogicCharacterClient;

	constructor(editor: Editor) {
		super();
		this.editor = editor;
		this.data = {
			id: this.id,
			accountId: 0,
			name: 'EditorCharacter',
			profileDescription: 'An editor character',
			settings: cloneDeep(CHARACTER_DEFAULT_PUBLIC_SETTINGS),
			position: [0, 0, 0],
			isOnline: true,
		};
		this.gameLogicCharacter = new GameLogicCharacterClient(this.data, this.logger.prefixMessages('[GameLogic]'));
	}

	public isPlayer(): boolean {
		return true;
	}

	public getAppearance(state?: AssetFrameworkCharacterState): AppearanceEditor {
		state ??= this.editor.globalState.currentState.getCharacterState(this.id) ?? undefined;
		Assert(state != null && state.id === this.id);
		return new AppearanceEditor(state, this.gameLogicCharacter, this.editor.globalState);
	}

	public getRestrictionManager(state: AssetFrameworkCharacterState | undefined, roomContext: ActionRoomContext | null): CharacterRestrictionsManager {
		return this.getAppearance(state).getRestrictionManager(roomContext);
	}
}

export function useEditorCharacterState(): AssetFrameworkCharacterState {
	const globalState = useEditorState();
	const characterState = globalState.characters.get(EDITOR_CHARACTER_ID);
	AssertNotNullable(characterState);

	return characterState;
}

export class EditorAssetGraphics extends AssetGraphics {
	public readonly editor: Editor;
	public onChangeHandler: (() => void) | undefined;

	constructor(editor: Editor, id: AssetId, definition?: Immutable<AssetGraphicsDefinition>, onChange?: () => void) {
		super(id, definition ?? {
			layers: [],
		});
		this.editor = editor;
		this.onChangeHandler = onChange;
	}

	public override load(definition: AssetGraphicsDefinition): void {
		super.load(definition);
		this.onChange();
	}

	protected onChange(): void {
		this.onChangeHandler?.();
	}

	protected override createLayer(definition: LayerDefinition): AssetGraphicsLayer {
		const layer = super.createLayer(definition);
		return layer;
	}

	public addLayer(): void {
		const newLayer = this.createLayer({
			x: 0,
			y: 0,
			width: CharacterSize.WIDTH,
			height: CharacterSize.HEIGHT,
			priority: 'OVERLAY',
			points: [],
			mirror: LayerMirror.NONE,
			colorizationKey: undefined,
			image: {
				image: '',
				overrides: [],
			},
		});
		this.layers = [...this.layers, newLayer];
		this.onChange();
	}

	public deleteLayer(layer: AssetGraphicsLayer): void {
		const index = this.layers.indexOf(layer);
		if (index < 0)
			return;

		// Prevent deletion if the layer has dependants
		const dependant = this.layers.find((l) => l !== layer && l.definition.value.points === index);
		if (dependant) {
			toast(`Failed to delete layer, because layer '${LayerToImmediateName(dependant)}' depends on it`, TOAST_OPTIONS_ERROR);
			return;
		}

		const pointsMap = this.makePointDependenciesMap();
		pointsMap.delete(layer);

		this.layers = this.layers.filter((l) => l !== layer);

		this.applyPointDependenciesMap(pointsMap);

		this.onChange();
	}

	public moveLayerRelative(layer: AssetGraphicsLayer, shift: number): void {
		const currentPos = this.layers.indexOf(layer);
		if (currentPos < 0)
			return;

		const newPos = currentPos + shift;
		if (newPos < 0 && newPos >= this.layers.length)
			return;

		const pointsMap = this.makePointDependenciesMap();

		const newLayers = this.layers.slice();
		newLayers.splice(currentPos, 1);
		newLayers.splice(newPos, 0, layer);
		this.layers = newLayers;

		this.applyPointDependenciesMap(pointsMap);

		this.onChange();
	}

	public setScaleAs(layer: AssetGraphicsLayer, scaleAs: string | null): void {
		if (layer.mirror && layer.isMirror) {
			layer = layer.mirror;
		}

		layer._modifyDefinition((d) => {
			if (scaleAs) {
				d.scaling = {
					scaleBone: scaleAs,
					stops: [],
				};
			} else {
				d.scaling = undefined;
			}
		});
	}

	public addScalingStop(layer: AssetGraphicsLayer, value: number): void {
		if (layer.mirror && layer.isMirror) {
			layer = layer.mirror;
		}

		if (value === 0 || !Number.isInteger(value) || value < -180 || value > 180) {
			throw new Error('Invalid value supplied');
		}

		layer._modifyDefinition((d) => {
			Assert(d.scaling, 'Cannot add scaling stop if not scaling');

			if (d.scaling.stops.some((stop) => stop[0] === value))
				return;

			d.scaling.stops.push([value, cloneDeep(d.image)]);
			d.scaling.stops.sort((a, b) => a[0] - b[0]);
		});
	}

	public removeScalingStop(layer: AssetGraphicsLayer, stop: number): void {
		if (layer.mirror && layer.isMirror) {
			layer = layer.mirror;
		}

		layer._modifyDefinition((d) => {
			Assert(d.scaling, 'Cannot remove scaling stop if not scaling');

			d.scaling.stops = d.scaling.stops.filter((s) => s[0] !== stop);
		});
	}

	public layerMirrorFrom(layer: AssetGraphicsLayer, source: number | string | null): void {
		if (layer.mirror && layer.isMirror)
			return this.layerMirrorFrom(layer.mirror, source);

		if (!this.layers.includes(layer)) {
			throw new Error('Cannot configure unknown layer');
		}

		layer._modifyDefinition((d) => {
			if (source === null) {
				if (typeof d.points === 'number') {
					const points = this.layers[d.points].definition.value.points;
					if (!Array.isArray(points)) {
						throw new Error('More than one jump in points reference');
					}
					d.points = CloneDeepMutable(points);
				}
				if (typeof d.points === 'string') {
					const manager = GraphicsManagerInstance.value;
					const template = manager?.getTemplate(d.points);
					if (!template) {
						throw new Error('Unknown point template');
					}
					d.points = cloneDeep(template);
				}
				return;
			}

			if (source === '') {
				d.points = [];
				return;
			}
			if (typeof source === 'string') {
				const manager = GraphicsManagerInstance.value;
				const template = manager?.getTemplate(source);
				if (!template) {
					throw new Error('Unknown point template');
				}
				d.points = source;
				return;
			}

			if (source === layer.index) {
				throw new Error('Cannot mirror layer from itself');
			}

			const sourceLayer = this.layers[source];
			if (!Array.isArray(sourceLayer?.definition.value.points)) {
				throw new Error('Cannot mirror from layer that doesn\'t have own points');
			}

			d.points = source;
		});
	}

	private makePointDependenciesMap(): Map<AssetGraphicsLayer, AssetGraphicsLayer> {
		const result = new Map<AssetGraphicsLayer, AssetGraphicsLayer>();
		for (const layer of this.layers) {
			if (typeof layer.definition.value.points === 'number') {
				result.set(layer, this.layers[layer.definition.value.points]);
			}
		}
		return result;
	}

	private applyPointDependenciesMap(map: Map<AssetGraphicsLayer, AssetGraphicsLayer>) {
		for (const layer of this.layers) {
			layer._modifyDefinition((d) => {
				if (typeof d.points === 'number') {
					const sourceLayer = map.get(layer);
					if (!sourceLayer) {
						throw new Error(`Failed to apply point map, layer '${LayerToImmediateName(layer)}' not found in map`);
					}
					const sourceIndex = this.layers.indexOf(sourceLayer);
					if (sourceIndex < 0) {
						throw new Error(`Failed to apply point map, depencency layer '${LayerToImmediateName(sourceLayer)}' for '${LayerToImmediateName(layer)}' not found`);
					}
					d.points = sourceIndex;
				}
			});
		}
	}

	private readonly fileContents = new Map<string, ArrayBuffer>();
	private readonly textures = new Map<string, Texture>([['', Texture.EMPTY]]);
	private _loadedTextures: readonly string[] = [];
	public get loadedTextures(): readonly string[] {
		return this._loadedTextures;
	}

	public getTexture(image: string): Texture {
		const texture = this.textures.get(image);
		return texture ?? Texture.EMPTY;
	}

	public async addTextureFromArrayBuffer(name: string, buffer: ArrayBuffer): Promise<void> {
		const texture = new Texture(new BaseTexture(await LoadArrayBufferImageResource(buffer)));
		this.fileContents.set(name, buffer);
		this.textures.set(name, texture);
		if (!this._loadedTextures.includes(name)) {
			this._loadedTextures = [...this._loadedTextures, name];
		}
		this.onChange();
	}

	public getTextureImageSource(name: string): string | null {
		const buffer = this.fileContents.get(name);
		if (!buffer)
			return null;

		return URL.createObjectURL(new Blob([buffer], { type: 'image/png' }));
	}

	public deleteTexture(name: string): void {
		this.fileContents.delete(name);
		this.textures.delete(name);
		this._loadedTextures = this._loadedTextures.filter((t) => t !== name);
		this.onChange();
	}

	public async addTexturesFromFiles(files: FileList): Promise<void> {
		for (let i = 0; i < files.length; i++) {
			const file = files.item(i);
			if (!file || !file.name.endsWith('.png'))
				continue;
			const buffer = await file.arrayBuffer();
			await this.addTextureFromArrayBuffer(file.name, buffer);
		}
	}

	public loadAllUsedImages(loader: IGraphicsLoader): Promise<void> {
		const images = new Set<string>();
		for (const layer of this.layers) {
			const processSetting = (setting: LayerImageSetting): void => {
				{
					const layerImage = setting.image;
					images.add(layerImage);
					setting.image = StripAssetHash(layerImage);
					const alphaImage = setting.alphaImage;
					if (alphaImage) {
						images.add(alphaImage);
						setting.alphaImage = StripAssetHash(alphaImage);
					}
				}
				for (const override of setting.overrides.concat(setting.alphaOverrides ?? [])) {
					images.add(override.image);
					override.image = StripAssetHash(override.image);
				}
			};
			layer._modifyDefinition((d) => {
				processSetting(d.image);
				d.scaling?.stops.forEach((s) => processSetting(s[1]));
			});
		}
		return Promise.allSettled(
			Array.from(images.values())
				.filter((image) => image.trim())
				.map((image) =>
					loader
						.loadFileArrayBuffer(image)
						.then((result) => this.addTextureFromArrayBuffer(StripAssetHash(image), result)),
				),
		).then(() => undefined);
	}

	public createDefinitionString(): string {
		return `// THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.\n` +
			JSON.stringify(this.export(), undefined, '\t').trim() +
			'\n';
	}

	public async downloadZip(): Promise<void> {
		const graphicsDefinitionContent = this.createDefinitionString();

		const now = new Date();

		const files: InputWithSizeMeta[] = [
			{ name: 'graphics.json', lastModified: now, input: graphicsDefinitionContent },
		];

		for (const [name, image] of this.fileContents.entries()) {
			files.push({
				name,
				input: image,
				lastModified: now,
			});
		}

		// get the ZIP stream in a Blob
		const blob = await downloadZip(files, {
			metadata: files,
		}).blob();

		// make and click a temporary link to download the Blob
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = `${this.id.replace(/^a\//, '').replaceAll('/', '_')}.zip`;
		link.style.display = 'none';
		document.body.appendChild(link);
		link.click();
		link.remove();
	}

	public async exportDefinitionToClipboard(): Promise<void> {
		const graphicsDefinitionContent = this.createDefinitionString();

		await navigator.clipboard.writeText(graphicsDefinitionContent);
	}
}
