import { ReactElement } from 'react';
import type { EditorAssetGraphicsRoomDeviceLayer } from '../../assets/editorAssetGraphicsRoomDeviceLayer.ts';

export function LayerRoomDeviceMeshUI(_props: {
	layer: EditorAssetGraphicsRoomDeviceLayer<'mesh'>;
}): ReactElement {
	return (
		<div className='warning-box fill-x'>
			Editing custom mesh layer using the Editor is not yet supported
		</div>
	);
}
