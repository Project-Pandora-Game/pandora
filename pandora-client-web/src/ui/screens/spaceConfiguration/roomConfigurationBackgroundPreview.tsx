import classNames from 'classnames';
import type { Immutable } from 'immer';
import type { RoomBackgroundData } from 'pandora-common';
import type { ReactElement } from 'react';
import { DivContainer } from '../../../components/common/container/container.tsx';
import { Container } from '../../../graphics/baseComponents/container.ts';
import { GraphicsBackground } from '../../../graphics/graphicsBackground.tsx';
import { GraphicsSceneBackgroundRenderer } from '../../../graphics/graphicsSceneRenderer.tsx';
import { UseTextureGetterOverride } from '../../../graphics/useTexture.ts';
import { useDevicePixelRatio } from '../../../services/screenResolution/screenResolutionHooks.ts';
import { serviceManagerContext } from '../../../services/serviceProvider.tsx';

export function RoomConfigurationBackgroundPreview({ background, previewSize, className }: {
	background: Immutable<RoomBackgroundData> | null;
	previewSize: number;
	className?: string;
}): ReactElement | null {
	const dpr = useDevicePixelRatio();

	if (background == null) {
		return null;
	}

	const previewScale = Math.min(previewSize / background.imageSize[0], previewSize / background.imageSize[1]);
	const previewSizeX = Math.ceil(previewScale * background.imageSize[0]);
	const previewSizeY = Math.ceil(previewScale * background.imageSize[1]);

	return (
		<DivContainer className={ classNames('RoomConfigurationBackgroundPreview', className) }>
			<GraphicsSceneBackgroundRenderer
				renderArea={ { x: 0, y: 0, width: previewSizeX, height: previewSizeY } }
				resolution={ dpr }
				backgroundColor={ 0x000000 }
				backgroundAlpha={ 0 }
				forwardContexts={ [serviceManagerContext, UseTextureGetterOverride] }
			>
				<Container
					scale={ { x: previewScale, y: previewScale } }
					x={ (previewSizeX - previewScale * background.imageSize[0]) / 2 }
					y={ (previewSizeY - previewScale * background.imageSize[1]) / 2 }
				>
					<GraphicsBackground
						background={ background }
					/>
				</Container>
			</GraphicsSceneBackgroundRenderer>
		</DivContainer>
	);
}
