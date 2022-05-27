import React, { ReactElement } from 'react';
import { StripAssetIdPrefix } from '../../../graphics/utility';
import { useObservable } from '../../../observable';
import { Editor } from '../../editor';
import './points.scss';

export function PointsUI({ editor }: { editor: Editor }): ReactElement {
	const selectedLayer = useObservable(editor.targetLayer);

	if (!selectedLayer) {
		return (
			<div>
				<h3>Select an layer to edit its points</h3>
			</div>
		);
	}

	return (
		<div className='editor-pointsui'>
			<h3>Editing: { StripAssetIdPrefix(selectedLayer.asset.id) } &gt; {selectedLayer.name}</h3>
		</div>
	);
}
