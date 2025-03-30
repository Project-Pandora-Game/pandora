import type { Immutable } from 'immer';
import { type GraphicsSourceLayer } from 'pandora-common';
import { ReactElement, useId } from 'react';
import { useEvent } from '../../../common/useEvent.ts';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { Row } from '../../../components/common/container/container.tsx';
import { ContextHelpButton } from '../../../components/help/contextHelpButton.tsx';
import { useObservable } from '../../../observable.ts';
import { EditorAssetGraphics } from '../../assets/editorAssetGraphics.ts';
import { type EditorAssetGraphicsLayer } from '../../assets/editorAssetGraphicsLayer.ts';

export function LayerHeightAndWidthSetting({ layer }: { layer: EditorAssetGraphicsLayer; asset: EditorAssetGraphics; }): ReactElement | null {
	const id = useId();
	const { width, height } = useObservable<Immutable<GraphicsSourceLayer>>(layer.definition);

	const onChangeHeight = useEvent((newValue: number) => {
		layer.setHeight(newValue);
	});

	const onChangeWidth = useEvent((newValue: number) => {
		layer.setWidth(newValue);
	});

	return (
		<div className='layer-size-setup'>
			<Row className='area-title' alignY='center'>
				<span>
					Width and Height
				</span>
				<ContextHelpButton>
					<p>
						These two values define width and height of the layer.<br />
						By default they are have the same value as the character canvas.<br />
					</p>
				</ContextHelpButton>
			</Row>
			<label className='area-xLabel' htmlFor={ id + ':width' }>
				Width:
			</label>
			<NumberInput
				id={ id + ':width' }
				value={ width }
				onChange={ onChangeWidth }
				className='area-xInput'
			/>
			<label className='area-yLabel' htmlFor={ id + ':height' }>
				Height:
			</label>
			<NumberInput
				id={ id + ':height' }
				value={ height }
				onChange={ onChangeHeight }
				className='area-yInput'
			/>
		</div>
	);

}

export function LayerOffsetSetting({ layer }: { layer: EditorAssetGraphicsLayer; asset: EditorAssetGraphics; }): ReactElement | null {
	const id = useId();
	const {
		x: layerXOffset,
		y: layerYOffset,
	} = useObservable<Immutable<GraphicsSourceLayer>>(layer.definition);

	const onChangeX = useEvent((newValue: number) => {
		layer.setXOffset(newValue);
	});

	const onChangeY = useEvent((newValue: number) => {
		layer.setYOffset(newValue);
	});

	return (
		<div className='layer-size-setup'>
			<Row className='area-title' alignY='center'>
				<span>
					Layer Offset
				</span>
				<ContextHelpButton>
					<p>
						These two values define how much the current layer is set off in the X- and Y-axis.<br />
						This way you will be able to place an item higher or lower on a character.<br />
						Per default, all values are set to 0.
					</p>
					<p>
						A positive x-value will move the image to the right, a negative one to the left.<br />
						A positive y-value will move the image to the bottom, a negative one to the top.
					</p>
				</ContextHelpButton>
			</Row>
			<label className='area-xLabel' htmlFor={ id + ':offset-x' }>
				X:
			</label>
			<NumberInput
				id={ id + ':offset-x' }
				value={ layerXOffset }
				onChange={ onChangeX }
				className='area-xInput'
			/>
			<label className='area-yLabel' htmlFor={ id + ':offset-y' }>
				Y:
			</label>
			<NumberInput
				id={ id + ':offset-y' }
				value={ layerYOffset }
				onChange={ onChangeY }
				className='area-yInput'
			/>
		</div>
	);
}
