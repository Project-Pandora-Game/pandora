import { AssetGraphicsDefinition, AssetId, CharacterSize, LayerDefinition, LayerImageOverride, LayerMirror, LayerSide, PointDefinition } from 'pandora-common';
import { TypedEventEmitter } from '../event';
import { MakeMirroredPoints, MirrorCondition, MirrorPoint } from '../graphics/mirroring';

export class AssetGraphicsLayer extends TypedEventEmitter<{
	change: undefined;
}> {
	public readonly asset: AssetGraphics;
	public mirror: AssetGraphicsLayer | undefined;
	public readonly isMirror: boolean;
	public definition: LayerDefinition;
	public side: LayerSide | undefined;

	public finalPoints!: PointDefinition[];

	public get index(): number {
		return this.isMirror && this.mirror ? this.mirror.index : this.asset.layers.indexOf(this);
	}

	public get name(): string {
		return (this.definition.name || `${this.index}`) + (this.isMirror ? ' (mirror)' : '');
	}

	constructor(asset: AssetGraphics, definition: LayerDefinition, mirror?: AssetGraphicsLayer) {
		super();
		this.asset = asset;
		this.definition = definition;
		this.mirror = mirror;
		this.isMirror = mirror !== undefined;
		this.updateMirror();
	}

	public buildPoints(): void {
		let points = this.definition.points;
		if (typeof points === 'number') {
			points = this.asset.layers[points].definition.points;
			if (!Array.isArray(points)) {
				throw new Error('More than one jump in points reference');
			}
		}
		if (this.isMirror && this.definition.mirror === LayerMirror.FULL) {
			points = points.map(MirrorPoint);
		}
		this.finalPoints = points.flatMap(MakeMirroredPoints);
		if (this.mirror && !this.isMirror) {
			this.mirror.buildPoints();
		}
		this.emit('change', undefined);
	}

	public updateMirror(): void {
		if (this.isMirror)
			return;

		if (this.definition.mirror === LayerMirror.NONE) {
			this.mirror = undefined;
			return;
		}

		const mirrored: LayerDefinition = {
			...this.definition,
			imageOverrides: this.definition.imageOverrides.map(({ image, condition }): LayerImageOverride => ({ image, condition: MirrorCondition(condition) })),
		};

		if (this.definition.mirror === LayerMirror.FULL) {
			mirrored.x = CharacterSize.WIDTH - this.definition.x;
		}

		this.mirror = new AssetGraphicsLayer(this.asset, mirrored, this);

		if (this.definition.mirror === LayerMirror.SELECT) {
			this.side = LayerSide.LEFT;
			this.mirror.side = LayerSide.RIGHT;
		}
	}
}

export class AssetGraphics {
	public readonly id: AssetId;
	public layers!: readonly AssetGraphicsLayer[];

	public get allLayers(): AssetGraphicsLayer[] {
		return this.layers.flatMap((l) => l.mirror ? [l, l.mirror] : [l]);
	}

	constructor(id: AssetId, definition: AssetGraphicsDefinition) {
		this.id = id;
		this.load(definition);
	}

	load(definition: AssetGraphicsDefinition) {
		this.layers = definition.layers.map(this.createLayer.bind(this));
		this.layers.forEach((l) => l.buildPoints());
	}

	export(): AssetGraphicsDefinition {
		return {
			layers: this.layers.map((l) => l.definition),
		};
	}

	protected createLayer(definition: LayerDefinition): AssetGraphicsLayer {
		return new AssetGraphicsLayer(this, definition);
	}
}
