import type { Immutable } from 'immer';
import type { IChatSegment } from 'pandora-common';
import type { ReactElement } from 'react';
import { RICH_TEXT_MATCHERS } from '../richText/richText.tsx';
import { RenderedLink } from './links.tsx';

export function RenderChatPart([type, contents]: Immutable<IChatSegment>, index: number, allowEmbeds: boolean): ReactElement {
	if (allowEmbeds && type === 'normal') {
		// Chat allows a single embed per message, which must match in full on trimmed segment
		const toMatch = contents.trim();
		for (const matcher of RICH_TEXT_MATCHERS) {
			const match = new RegExp(matcher.matchRegex.source, matcher.matchRegex.flags).exec(toMatch);
			if (match != null && match[0] === toMatch) {
				const processed = matcher.process(match);
				if (processed != null) {
					return <>{ processed }</>;
				}
			}
		}
	}

	if (type === 'normal' && allowEmbeds && (/^https?:\/\//.exec(contents))) {
		const url = URL.parse(contents);
		if (url != null) {
			return (
				<RenderedLink key={ index } url={ url } text={ contents } />
			);
		}
	}
	switch (type) {
		case 'normal':
			return <span key={ index }>{ contents }</span>;
		case 'italic':
			return <em key={ index }>{ contents }</em>;
		case 'bold':
			return <strong key={ index }>{ contents }</strong>;
	}
}

export function RenderChatPartToString([_type, contents]: Immutable<IChatSegment>, _allowLinkInNormal: boolean): string {
	return contents;
}
