import { freeze, type Draft, type Immutable } from 'immer';
import { AssertNotNullable, CalculatePointsTrianglesFlat, CloneDeepMutable, EMPTY_ARRAY, type PointTemplate, type PointTemplateSource } from 'pandora-common';
import * as PIXI from 'pixi.js';
import { ReactElement, useCallback, useMemo } from 'react';
import { CalculatePointDefinitionsFromTemplate } from '../../assets/assetGraphicsCalculations.ts';
import { GraphicsManagerInstance } from '../../assets/graphicsManager.ts';
import { Container } from '../../graphics/baseComponents/container.ts';
import { Graphics } from '../../graphics/baseComponents/graphics.ts';
import { Observable, useObservable } from '../../observable.ts';
import { EditorAssetGraphicsManager } from '../assets/editorAssetGraphicsManager.ts';
import type { Editor } from '../editor.tsx';
import { DraggablePoint, DraggablePointDisplay } from './draggable.tsx';
import { EDITOR_LAYER_Z_INDEX_EXTRA } from './layer/editorLayer.tsx';

const DEFAULT_POINT_TEMPLATE = freeze<Immutable<PointTemplateSource>>({
	points: EMPTY_ARRAY,
}, true);

/**
 * Class containing utility methods for manipulating a point template
 */
export class PointTemplateEditor {
	public readonly templateName: string;
	private readonly _editor: Editor;

	public readonly points = new Observable<readonly DraggablePoint[]>([]);
	public readonly targetPoint = new Observable<DraggablePoint | null>(null);

	constructor(templateName: string, editor: Editor) {
		this.templateName = templateName;
		this._editor = editor;
		this._refreshPoints();
	}

	public createNewPoint(x: number, y: number): void {
		x = Math.round(x);
		y = Math.round(y);

		this.modifyTemplate((d) => {
			d.points.push({
				pos: [x, y],
				mirror: false,
				transforms: [],
			});
		});
	}

	public getCurrent(): Immutable<PointTemplateSource> {
		return EditorAssetGraphicsManager.editedPointTemplates.value.get(this.templateName) ??
			EditorAssetGraphicsManager.originalPointTempalates[this.templateName] ??
			DEFAULT_POINT_TEMPLATE;
	}

	public modifyTemplate(recipe: (d: Draft<PointTemplateSource>) => void) {
		const originalTemplate: Immutable<PointTemplateSource> = EditorAssetGraphicsManager.originalPointTempalates[this.templateName] ?? DEFAULT_POINT_TEMPLATE;

		EditorAssetGraphicsManager.editedPointTemplates.produceImmer((d) => {
			const template = d.get(this.templateName) ?? CloneDeepMutable(originalTemplate);
			recipe(template);
			d.set(this.templateName, template);
		});

		this._refreshPoints();
	}

	private _refreshPoints(): void {
		const points = CalculatePointDefinitionsFromTemplate(this.getCurrent().points);
		const currentPoints = this.points.value;
		if (currentPoints.length === points.length) {
			for (let i = 0; i < points.length; i++) {
				currentPoints[i].updatePoint(points[i]);
			}
			return;
		}
		this.targetPoint.value = null;
		this.points.value = points.map((definition) => new DraggablePoint(this, definition));
	}
}

export function PointTemplateEditLayer({ templateEditor }: {
	templateEditor: PointTemplateEditor;
}): ReactElement {
	const editorModifiedTemplates = useObservable(EditorAssetGraphicsManager.editedPointTemplates);
	const graphicsManager = useObservable(GraphicsManagerInstance);
	AssertNotNullable(graphicsManager);

	const currentTemplate = useMemo((): Immutable<PointTemplate> => {
		return editorModifiedTemplates.get(templateEditor.templateName)?.points ??
			graphicsManager.getTemplate(templateEditor.templateName) ??
			EMPTY_ARRAY;
	}, [graphicsManager, editorModifiedTemplates, templateEditor]);

	const [points, triangles] = useMemo(() => {
		const p = CalculatePointDefinitionsFromTemplate(currentTemplate);
		const t = CalculatePointsTrianglesFlat(p);
		return [p, t];
	}, [currentTemplate]);

	const drawWireFrame = useCallback((g: PIXI.GraphicsContext) => {
		// Draw triangles
		for (let i = 0; i < triangles.length; i += 3) {
			const poly = [0, 1, 2]
				.map((p) => triangles[i + p])
				.flatMap((p) => [points[p].pos[0], points[p].pos[1]]);
			g.poly(poly)
				.stroke({ width: 1, color: 0x555555, alpha: 0.3, pixelLine: true });
		}
	}, [points, triangles]);

	return (
		<Container
			zIndex={ EDITOR_LAYER_Z_INDEX_EXTRA }
		>
			<Graphics
				draw={ drawWireFrame }
			/>
			{
				useObservable(templateEditor.points)
					.map((p, i) => <DraggablePointDisplay templateEditor={ templateEditor } draggablePoint={ p } key={ i } />)
			}
		</Container>
	);
}
