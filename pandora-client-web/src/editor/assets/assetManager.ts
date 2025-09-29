import { downloadZip, InputWithSizeMeta } from 'client-zip';
import { Immutable } from 'immer';
import { Assert, Asset, AssetDefinition, AssetGraphicsDefinition, AssetId, AssetsDefinitionFile, TypedEventEmitter } from 'pandora-common';
import { AssetManagerClient, GetCurrentAssetManager, UpdateAssetManager, useAssetManager } from '../../assets/assetManager.tsx';
import { DownloadAsFile } from '../../common/downloadHelper.ts';
import { ObservableClass, ObservableProperty } from '../../observable.ts';

export const ASSET_ID_PART_REGEX = /^[a-z][a-z0-9]*([-_][a-z0-9]+)*$/;

export class AssetManagerEditor extends AssetManagerClient {

	public readonly assetTreeView: AssetTreeView = new AssetTreeViewClass;
	public readonly injectedAssets: Record<AssetId, AssetDefinition>;

	constructor(definitionsHash: string, data: Immutable<AssetsDefinitionFile>, injectedAssets: Record<AssetId, AssetDefinition> = {}) {
		super('editor:' + (definitionsHash ?? ''), {
			...data,
			assets: {
				...injectedAssets,
				...data.assets,
			},
		});
		this.injectedAssets = injectedAssets;
		this.assetTreeView.update(this.assetList);
	}

	public static async createNewAsset(category: string, idPart: string, name: string, bodypart: string): Promise<void> {
		const currentManager = GetCurrentAssetManager();
		Assert(currentManager instanceof AssetManagerEditor);
		const id: AssetId = `a/${category}/${idPart}`;

		Assert(ASSET_ID_PART_REGEX.test(category));
		Assert(ASSET_ID_PART_REGEX.test(idPart));
		Assert(!currentManager.getAssetById(id));
		Assert(!bodypart || currentManager.bodyparts.some((b) => b.name === bodypart));

		let definition: AssetDefinition<'bodypart'> | AssetDefinition<'personal'>;
		if (bodypart) {
			definition = {
				type: 'bodypart',
				id,
				name,
				size: 'bodypart',
				bodypart,
				colorization: {
					base: {
						name: 'Color group',
						default: '#FFFFFF',
					},
				},
				hasGraphics: false,
				credits: { credits: [], sourcePath: `${category}/${idPart}` },
			};
		} else {
			definition = {
				type: 'personal',
				id,
				name,
				size: 'medium',
				colorization: {
					base: {
						name: 'Color group',
						default: '#FFFFFF',
					},
				},
				hasGraphics: false,
				credits: { credits: [], sourcePath: `${category}/${idPart}` },
			};
		}

		EditorAssetManager.loadAssetManager(currentManager.definitionsHash, currentManager.rawData, {
			[id]: definition,
		});

		// Download the definition
		const assetTemplateContent = `
// The comments provide info about what is REQUIRED before submitting an asset.
// After filling the info in, please remove the helper comments before creating a PR.

DefineAsset({
	// Name of your asset, this is what users see
	name: '${name}',${bodypart ? `\n\tbodypart: '${bodypart}',` : ''}
	// Size of this item. Affects mainly which things it can fit into. For more details check pandora-common/src/assets/definitions.ts
	size: '${bodypart ? 'bodypart' : 'medium'}',
	// Name of the file with graphics created using Editor.
	graphics: 'graphics.json',
	// Definitions of how your asset should be colorable.
	// Rename the example group or copy it to add more independent ones.
	colorization: {
		colorGroup: {
			name: 'Color group',
			default: '#FFFFFF',
		},
	},
	// Add name of the preview file, optimally created using the editor. For other examples look at other assets.
	preview: undefined,
	// Info about who owns the asset(s)
	ownership: {
		// Same as the author of git commits present in PR, has responsibility for this asset
		responsibleContributor: 'gitName <gitEmail@example.com>',
		// Who is shown in the credits for this asset and at the same time the people to ask when this asset should be changed
		// Note: It does not have to be the gitName, but it may make it easier to get in contact
		credits: ['CHANGE_ME'],
		// Write your preference on how you want to allow others to modify this asset.
		// See more details in CONTRIBUTING.md
		modificationPolicy: 'Fixes and New uses, otherwise ask',
		// Write your preference on how you want to allow others to reuse parts of your assets for their assets,
		// See more details in CONTRIBUTING.md
		reusePolicy: 'Ask first',
		// Legal info about the images
		// If there are multiple sources used, specify this multiple times
		// If the author gave you express permission to use images but wishes to remain Anonymous, write "Anonymous" in relevant fields.
		licensing: [
			{
				// Which part of the asset does this part of licensing apply to?
				// This property is optional, if this applies to the whole asset, simply remove the line with \`part\`.
				// Examples: The chains; The main body of the asset without decorations; The decorations
				part: 'CHANGE_ME',
				// From where does the images come? An HTTP link to the source.
				// Can be 'Self-Made' for assets you created yourself or 'Private' for images acquired by directly communicating with the creator.
				source: 'Private',
				// Who is the copyright holder of the original images? The name they go by.
				copyrightHolder: 'CHANGE_ME',
				// Who edited the images to work for Pandora? It can be the same as \`copyrightHolder\`.
				editedBy: 'CHANGE_ME',
				// License; see possible licenses in ASSET_LICENSING.md file.
				// Alternatively, write the name of the file with the license prefixed by \`./\` (e.g. \`./LICENSE.md\`)
				license: 'Pandora-Use-Only-v1-or-later',
			},
		],
	},
});
`.trim() + '\n';

		const baseGraphics: AssetGraphicsDefinition = {
			type: 'worn',
			layers: [],
		};
		const graphicsDefinitionContent = `// THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.\n`
			+ JSON.stringify(baseGraphics, undefined, '\t').trim()
			+ '\n';

		const now = new Date();

		const files: InputWithSizeMeta[] = [
			{ name: `assets/${category}/${idPart}/${idPart}.asset.ts`, lastModified: now, input: assetTemplateContent },
			{ name: `assets/${category}/${idPart}/graphics.json`, lastModified: now, input: graphicsDefinitionContent },
		];

		// get the ZIP stream in a Blob
		const blob = await downloadZip(files).blob();

		DownloadAsFile(blob, `${id.replace(/^a\//, '').replaceAll('/', '_')}_template.zip`);
	}
}

export const EditorAssetManager = new class extends TypedEventEmitter<{
	assetMangedChanged: AssetManagerEditor;
}> {
	public loadAssetManager(
		definitionsHash: string,
		data: Immutable<AssetsDefinitionFile>,
		injectAdditionalAssets?: Record<AssetId, AssetDefinition>,
	): AssetManagerEditor {
		const currentManager = GetCurrentAssetManager();
		if (currentManager != null && currentManager instanceof AssetManagerEditor) {
			injectAdditionalAssets = injectAdditionalAssets != null ? {
				...currentManager.injectedAssets,
				...injectAdditionalAssets,
			} : currentManager.injectedAssets;
		}

		const manager = new AssetManagerEditor(definitionsHash, data, injectAdditionalAssets);
		loaded = true;
		UpdateAssetManager(manager);
		this.emit('assetMangedChanged', manager);
		return manager;
	}
}();

let loaded = false;

export function useAssetManagerEditor(): AssetManagerEditor {
	Assert(loaded, 'Attempt to use AssetManagerEditor before it is loaded.');
	const assetManager = useAssetManager();
	Assert(assetManager instanceof AssetManagerEditor);
	return assetManager;
}

export type AssetTreeView = AssetTreeViewClass;
class AssetTreeViewClass {
	private readonly _categories = new Map<string, AssetTreeViewCategory>();

	public get categories(): AssetTreeViewCategory[] {
		return [...this._categories.values()];
	}

	public update(assets: readonly Asset[]) {
		const oldCategories = new Map(this._categories);
		this._categories.clear();
		for (const asset of assets) {
			const [, category, name] = /^a\/([^/]+)\/([^/]+)$/.exec(asset.id) || [];
			if (!category || !name)
				continue;

			let categoryTreeView = this._categories.get(category);
			if (!categoryTreeView) {
				this._categories.set(category, categoryTreeView = new AssetTreeViewCategoryClass(category));
			}
			categoryTreeView.set(name, asset);
		}
		// Reopen categories that were open before
		for (const [name, category] of oldCategories) {
			const newCategory = this._categories.get(name);
			if (newCategory != null && category.open) {
				newCategory.open = true;
			}
		}
	}
}

export type AssetTreeViewCategory = AssetTreeViewCategoryClass;
class AssetTreeViewCategoryClass extends ObservableClass<{ open: boolean; }> {
	private _assets = new Map<string, Asset>();

	public get assets(): Asset[] {
		return [...this._assets.values()];
	}
	public readonly name: string;

	@ObservableProperty
	public accessor open: boolean = false;

	constructor(name: string) {
		super();
		this.name = name;
	}

	public set(name: string, asset: Asset) {
		this._assets.set(name, asset);
	}
}
