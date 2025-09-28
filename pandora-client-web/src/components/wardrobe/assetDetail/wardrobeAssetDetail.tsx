import type { Asset, AssetSize } from 'pandora-common';
import { useMemo, type ReactElement } from 'react';
import sourceCodeIcon from '../../../assets/icons/source-code.svg';
import { Column, Row } from '../../common/container/container.tsx';
import { ExternalLink } from '../../common/link/externalLink.tsx';

const SIZE_TEXT: Record<AssetSize, string> = {
	bodypart: 'Body part',
	small: 'Small',
	medium: 'Medium',
	large: 'Large',
	huge: 'Huge',
};

export function WardrobeAssetDetailContent({ asset }: {
	asset: Asset;
}): ReactElement {
	const sourceUrl = useMemo(() => {
		return new URL(asset.definition.credits.sourcePath, 'https://github.com/Project-Pandora-Game/pandora-assets/tree/master/').href;
	}, [asset]);

	return (
		<Column padding='medium' overflowX='hidden' overflowY='auto'>
			<Row>
				<span>Asset:</span>
				<span>{ asset.definition.name }</span>
			</Row>
			<Row>
				<span>Size:</span>
				<span>{ SIZE_TEXT[asset.definition.size] }</span>
			</Row>
			<Column gap='none'>
				<span>Created by:</span>
				<ul>
					{ asset.definition.credits.credits.map((c, i) => (
						<li key={ i }>{ c }</li>
					)) }
				</ul>
			</Column>
			<ExternalLink href={ sourceUrl } sendReferrer>
				<Row alignY='center' gap='small'>
					<img className='icon' src={ sourceCodeIcon } alt='Asset source code' />
					View asset source
				</Row>
			</ExternalLink>
		</Column>
	);
}
