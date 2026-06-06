import type { ReactElement } from 'react';
import { RenderedLink } from '../chat/links.tsx';
import './richText.scss';

export function RichTextDescription({ content }: { content: string; }): ReactElement {
	const segments = content.split(/(https?:\/\/\S+\s*)/g);
	return (
		<div className='RichTextDescription'>
			{ segments.map((segment, index) => <DescriptionSegment key={ index } segment={ segment } />) }
		</div>
	);
}

function DescriptionSegment({ segment }: { segment: string; }): ReactElement {
	const linkMatch = /^(https?:\/\/\S+)(\s*)$/.exec(segment);
	if (linkMatch) {
		const url = URL.parse(linkMatch[1]);

		if (url != null) {
			return (
				<RenderedLink url={ url } text={ url.href } textAfter={ linkMatch[2] } />
			);
		}
	}

	return (
		<span>{ segment }</span>
	);
}
