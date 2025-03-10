import { downloadZip, InputWithSizeMeta } from 'client-zip';
import { Immutable } from 'immer';
import { cloneDeep } from 'lodash-es';
import {
	ActionSpaceContext,
	AppearanceAction,
	AppearanceActionContext,
	AppearanceActionProcessingContext,
	ApplyAction,
	Assert,
	AssertNotNullable,
	Asset,
	ASSET_PREFERENCES_DEFAULT,
	AssetFrameworkCharacterState,
	AssetFrameworkGlobalStateContainer,
	AssetGraphicsDefinition,
	AssetGraphicsDefinitionSchema,
	AssetId,
	CHARACTER_DEFAULT_PUBLIC_SETTINGS,
	CharacterAppearance,
	CharacterId,
	CharacterRestrictionsManager,
	CharacterSize,
	CharacterView,
	GameLogicCharacter,
	GameLogicCharacterClient,
	GetLogger,
	ICharacterRoomData,
	ItemId,
	LayerDefinition,
	LayerImageSetting,
	LayerMirror,
	TypedEventEmitter,
	type AssetFrameworkGlobalState,
} from 'pandora-common';
import { Texture } from 'pixi.js';
import { AssetGraphics, AssetGraphicsLayer } from '../../../assets/assetGraphics.ts';
import { IGraphicsLoader } from '../../../assets/graphicsManager.ts';
import { CharacterEvents, ICharacter } from '../../../character/character.ts';
import { DownloadAsFile } from '../../../common/downloadHelper.ts';
import { LoadArrayBufferImageResource, StripAssetHash } from '../../../graphics/utility.ts';
import { EDITOR_SPACE_CONTEXT } from '../../components/wardrobe/wardrobe.tsx';
import { Editor } from '../../editor.tsx';
import { useEditorState } from '../../editorContextProvider.tsx';

export interface EditorActionContext {
	dryRun?: boolean;
}

export class AppearanceEditor extends CharacterAppearance {
	public readonly globalStateContainer: AssetFrameworkGlobalStateContainer;

	constructor(globalState: AssetFrameworkGlobalState, character: GameLogicCharacter, globalStateContainer: AssetFrameworkGlobalStateContainer) {
		super(globalState, character);
		this.globalStateContainer = globalStateContainer;
	}

	protected _makeActionContext(): AppearanceActionContext {
		return {
			executionContext: 'act',
			player: this.character,
			spaceContext: EDITOR_SPACE_CONTEXT,
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
		const processingContext = new AppearanceActionProcessingContext(this._makeActionContext(), this.globalStateContainer.currentState);
		const result = ApplyAction(processingContext, action);

		if (!result.valid) {
			return false;
		}

		if (!dryRun) {
			this.globalStateContainer.setState(result.resultState);
		}
		return true;
	}

	public setPose(bone: string, value: number): boolean {
		if (!Number.isInteger(value))
			throw new Error('Attempt to set non-int pose value');

		const definition = this.assetManager.getBoneByName(bone);
		if (definition == null)
			throw new Error(`Attempt to get pose for unknown bone: ${bone}`);

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
			type: 'pose',
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
			assetPreferences: cloneDeep(ASSET_PREFERENCES_DEFAULT),
		};
		this.gameLogicCharacter = new GameLogicCharacterClient(() => this.data, this.logger.prefixMessages('[GameLogic]'));
	}

	public isPlayer(): boolean {
		return true;
	}

	public getAppearance(globalState?: AssetFrameworkGlobalState): AppearanceEditor {
		globalState ??= this.editor.globalState.currentState;
		return new AppearanceEditor(globalState, this.gameLogicCharacter, this.editor.globalState);
	}

	public getRestrictionManager(globalState: AssetFrameworkGlobalState | undefined, spaceContext: ActionSpaceContext): CharacterRestrictionsManager {
		return this.getAppearance(globalState).getRestrictionManager(spaceContext);
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
			points: '',
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

		this.layers = this.layers.filter((l) => l !== layer);

		this.onChange();
	}

	public moveLayerRelative(layer: AssetGraphicsLayer, shift: number): void {
		const currentPos = this.layers.indexOf(layer);
		if (currentPos < 0)
			return;

		const newPos = currentPos + shift;
		if (newPos < 0 && newPos >= this.layers.length)
			return;

		const newLayers = this.layers.slice();
		newLayers.splice(currentPos, 1);
		newLayers.splice(newPos, 0, layer);
		this.layers = newLayers;

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
		const texture = new Texture({
			source: await LoadArrayBufferImageResource(buffer),
			label: `Editor: ${name}`,
		});
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
			JSON.stringify(AssetGraphicsDefinitionSchema.parse(this.export()), undefined, '\t').trim() +
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

		DownloadAsFile(blob, `${this.id.replace(/^a\//, '').replaceAll('/', '_')}.zip`);
	}

	public async exportDefinitionToClipboard(): Promise<void> {
		const graphicsDefinitionContent = this.createDefinitionString();

		await navigator.clipboard.writeText(graphicsDefinitionContent);
	}
}
