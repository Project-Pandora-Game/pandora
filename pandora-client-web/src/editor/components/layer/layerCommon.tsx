import type { Immutable } from 'immer';
import { type GraphicsSourceLayer } from 'pandora-common';
import { ReactElement } from 'react';
import { useEvent } from '../../../common/useEvent.ts';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { Row } from '../../../components/common/container/container.tsx';
import { ContextHelpButton } from '../../../components/help/contextHelpButton.tsx';
import { useObservable } from '../../../observable.ts';
import { EditorAssetGraphics } from '../../assets/editorAssetGraphics.ts';
import { type EditorAssetGraphicsLayer } from '../../assets/editorAssetGraphicsLayer.ts';

export function LayerHeightAndWidthSetting({ layer }: { layer: EditorAssetGraphicsLayer; asset: EditorAssetGraphics; }): ReactElement | null {
	const { width, height } = useObservable<Immutable<GraphicsSourceLayer>>(layer.definition);

	const onChangeHeight = useEvent((newValue: number) => {
		layer.setHeight(newValue);
	});

	const onChangeWidth = useEvent((newValue: number) => {
		layer.setWidth(newValue);
	});

	return (
		<>
			<Row alignY='center'>
				<label>
					Width and Height
					<ContextHelpButton>
						<p>
							These two values define width and height of the layer.<br />
							By default they are have the same value as the character canvas.<br />
						</p>
					</ContextHelpButton>
				</label>
			</Row>
			<Row alignY='center'>
				<label htmlFor='width'>
					Width:
					<ContextHelpButton>
						<p>
							Sets the width of the layer.<br />
						</p>
					</ContextHelpButton>
				</label>
				<NumberInput
					id='width'
					value={ width }
					onChange={ onChangeWidth }
					className='flex-1'
				/>
			</Row>
			<Row alignY='center'>
				<label htmlFor='height'>
					Height:
					<ContextHelpButton>
						<p>
							Sets the height of the layer.<br />
						</p>
					</ContextHelpButton>
				</label>
				<NumberInput
					id='height'
					value={ height }
					onChange={ onChangeHeight }
					className='flex-1'
				/>
			</Row>
		</>
	);

}

export function LayerOffsetSetting({ layer }: { layer: EditorAssetGraphicsLayer; asset: EditorAssetGraphics; }): ReactElement | null {
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
		<>
			<Row alignY='center'>
				<label>
					Layer Offset
					<ContextHelpButton>
						<p>
							These two values define how much the curent layer is set off in the X- and Y-axis.<br />
							This way you will be able to place an item higher higher or lower on a character.<br />
							Per default, all values are set to 0.<br />
						</p>
					</ContextHelpButton>
				</label>
			</Row>
			<Row alignY='center'>
				<label htmlFor='layer-offset-x'>
					X-Offset:
					<ContextHelpButton>
						<p>
							A positive x-value will move the image to the right, a negative one to the left.<br />
						</p>
					</ContextHelpButton>
				</label>
				<NumberInput
					id='layer-offset-x'
					value={ layerXOffset }
					onChange={ onChangeX }
					className='flex-1'
				/>
			</Row>
			<Row alignY='center'>
				<label htmlFor='layer-offset-y'>
					Y-Offset:
					<ContextHelpButton>
						<p>
							A positive y-value will move the image to the bottom, a negative one to the top.<br />
						</p>
					</ContextHelpButton>
				</label>
				<NumberInput
					id='layer-offset-y'
					value={ layerYOffset }
					onChange={ onChangeY }
					className='flex-1'
				/>
			</Row>
		</>
	);
}
