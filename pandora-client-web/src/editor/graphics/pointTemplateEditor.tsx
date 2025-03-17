import { type Draft, type Immutable } from 'immer';
import { AssertNotNullable, CalculatePointsTrianglesFlat, CloneDeepMutable, EMPTY_ARRAY, type PointTemplate } from 'pandora-common';
import * as PIXI from 'pixi.js';
import { ReactElement, useCallback, useMemo } from 'react';
import { CalculatePointDefinitionsFromTemplate } from '../../assets/assetGraphicsCalculations.ts';
import { GraphicsManagerInstance } from '../../assets/graphicsManager.ts';
import { Container } from '../../graphics/baseComponents/container.ts';
import { Graphics } from '../../graphics/baseComponents/graphics.ts';
import { Observable, useObservable } from '../../observable.ts';
import type { Editor } from '../editor.tsx';
import { useEditor } from '../editorContextProvider.tsx';
import { DraggablePoint, DraggablePointDisplay } from './draggable.tsx';
import { EDITOR_LAYER_Z_INDEX_EXTRA } from './layer/editorLayer.tsx';

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
			d.push({
				pos: [x, y],
				mirror: false,
				transforms: [],
			});
		});
	}

	public getCurrent(): Immutable<PointTemplate> {
		return this._editor.modifiedPointTemplates.value.get(this.templateName) ??
			GraphicsManagerInstance.value?.getTemplate(this.templateName) ??
			EMPTY_ARRAY;
	}

	public modifyTemplate(recipe: (d: Draft<PointTemplate>) => void) {
		const originalTemplate: Immutable<PointTemplate> = GraphicsManagerInstance.value?.getTemplate(this.templateName) ?? [];

		this._editor.modifiedPointTemplates.produceImmer((d) => {
			const template = d.get(this.templateName) ?? CloneDeepMutable(originalTemplate);
			recipe(template);
			d.set(this.templateName, template);
		});

		this._refreshPoints();
	}

	private _refreshPoints(): void {
		const points = CalculatePointDefinitionsFromTemplate(this.getCurrent());
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
	const editor = useEditor();
	const editorModifiedTemplates = useObservable(editor.modifiedPointTemplates);
	const graphicsManager = useObservable(GraphicsManagerInstance);
	AssertNotNullable(graphicsManager);

	const currentTemplate = useMemo((): Immutable<PointTemplate> => {
		return editorModifiedTemplates.get(templateEditor.templateName) ??
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
