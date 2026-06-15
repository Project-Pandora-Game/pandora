import { Fragment, useMemo, type ReactElement } from 'react';
import { CreateExportedDataMatcher } from '../../../components/exportImport/exportImportUtils.ts';
import { RenderedPosePreset } from '../chat/embeds.tsx';
import { RenderedLink } from '../chat/links.tsx';
import './richText.scss';

export function RichTextDescription({ content }: { content: string; }): ReactElement {
	const processedContent = useMemo(() => ProcessTextMatchers(content), [content]);

	return (
		<div className='RichTextDescription'>
			{ ...processedContent }
		</div>
	);
}

function ProcessTextMatchers(text: string, matcherIndex: number = 0, keyStartIndex: number = 0): ReactElement[] {
	if (matcherIndex >= RICH_TEXT_MATCHERS.length) {
		return [<span key={ keyStartIndex }>{ text }</span>];
	}

	const matcher = RICH_TEXT_MATCHERS[matcherIndex];

	const result: ReactElement[] = [];

	let i = 0;
	for (const match of text.matchAll(matcher.matchRegex)) {
		// Skip empty matches, if bad matchers could interact with those
		if (!match[0])
			continue;

		// Process text since last match
		if (match.index > i) {
			result.push(...ProcessTextMatchers(text.substring(i, match.index), matcherIndex + 1, keyStartIndex + result.length));
		}

		// Process the match itself
		const processed = matcher.process(match);
		if (processed == null) {
			result.push(<span key={ keyStartIndex + result.length }>{ text }</span>);
		} else {
			result.push(<Fragment key={ keyStartIndex + result.length }>{ processed }</Fragment>);
		}

		// Advance
		i = match.index + match[0].length;

		if (processed != null && matcher.eatSpaceAfter) {
			const space = /^\s*/.exec(text.substring(i));
			if (space != null) {
				i += space[0].length;
			}
		}
	}

	// If we don't have a match, finalize and recurse on next matcher
	if (i < text.length) {
		result.push(...ProcessTextMatchers(text.substring(i), matcherIndex + 1, keyStartIndex + result.length));
	}
	return result;
}

export const RICH_TEXT_MATCHERS: {
	matchRegex: RegExp;
	eatSpaceAfter: boolean;
	process: (match: RegExpExecArray) => ReactElement | null;
}[] = [
	// URLs
	{
		matchRegex: /(https?:\/\/\S+)(\s*)/g,
		eatSpaceAfter: false,
		process: (match) => {
			const url = URL.parse(match[1]);

			if (url != null) {
				return (
					<RenderedLink url={ url } text={ url.href } textAfter={ match[2] } />
				);
			}
			return null;
		},
	},
	// Pose presets
	{
		matchRegex: CreateExportedDataMatcher('PosePreset', 'g'),
		eatSpaceAfter: true,
		process: (match) => (
			<RenderedPosePreset value={ match[0] } />
		),
	},
];
