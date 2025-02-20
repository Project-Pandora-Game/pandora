import type { ReactElement } from 'react';
import { RenderedLink } from '../../ui/screens/spaceJoin/spaceJoin';

export function ProfileDescription({ contents }: { contents: string; }): ReactElement {
	const segments = contents.split(/(https?:\/\/\S+)/);
	return (
		<div>
			{ segments.map((segment, index) => <DescriptionSegment key={ index } segment={ segment } index={ index } />) }
		</div>
	);
}

function DescriptionSegment({ segment, index }: { segment: string; index: number; }): ReactElement {
	if ((/^https?:\/\//.exec(segment)) && URL.canParse(segment)) {
		const url = new URL(segment);
		return (
			<RenderedLink key={ index } index={ index } url={ url } />
		);
	}
	return (
		<span key={ index }>{ segment }</span>
	);
}
