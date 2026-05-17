import { ReactElement, useEffect, useId, useMemo, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { useNavigatePandora } from '../../../routing/navigate.ts';
import { WIKI_PAGES, WikiPageEntry } from '../wikiPageRegistry.ts';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { useEvent } from '../../../common/useEvent.ts';
import '../wiki.scss';

const PREVIEW_LENGTH = 250;
const MAX_RESULTS = 50;

/** A fixed location used for all static renders during indexing. */
const STATIC_RENDER_LOCATION = '/';

type WikiSection = {
	/** Heading text of this section, or the tab name for page-level preamble */
	title: string;
	/** urlChunk of the containing wiki tab, e.g. 'chat' */
	page: string;
	/** Human-readable tab name, e.g. 'Chat' */
	pageName: string;
	/** The `id` attribute of the heading element that opened this section, if any */
	anchor: string | undefined;
	/** Plain text of this section with HTML stripped */
	content: string;
};

type SearchResult = {
	section: WikiSection;
	/** Character offset of the first query match inside section.content */
	matchIndex: number;
};

function ParsePageIntoSections(entry: WikiPageEntry): WikiSection[] {
	const { pageName, urlChunk, Component } = entry;

	const html = renderToStaticMarkup(
		<StaticRouter location={ STATIC_RENDER_LOCATION }>
			<Component />
		</StaticRouter>,
	);
	const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html');
	const root = doc.getElementById('root')!;
	const anchors = Array.from(root.querySelectorAll('[id]'));

	const BLOCK_TAGS = new Set(['P', 'LI', 'DT', 'DD', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE']);

	function elementText(el: Element): string {
		const parts: string[] = [];
		for (const child of Array.from(el.childNodes)) {
			if (child.nodeType === Node.TEXT_NODE) {
				const t = (child.textContent ?? '').replace(/\s+/g, ' ');
				if (t.trim()) parts.push(t);
			} else if (child instanceof Element) {
				const inner = elementText(child).trim();
				if (!inner) continue;
				if (BLOCK_TAGS.has(child.tagName)) {
					const prev = parts[parts.length - 1]?.trimEnd() ?? '';
					if (prev && !/[.!?]$/.test(prev)) {
						parts.push('. ');
					} else {
						parts.push(' ');
					}
				}
				parts.push(inner);
			}
		}
		return parts.join('').replace(/\s+/g, ' ');
	}

	if (anchors.length === 0) {
		return [{
			title: pageName,
			page: urlChunk,
			pageName,
			anchor: undefined,
			content: elementText(root).trim(),
		}];
	}

	const topChildren = Array.from(root.children);

	function topLevelIndexOf(el: Element): number {
		return topChildren.findIndex((child) => child === el || child.contains(el));
	}

	const cutPoints = anchors
		.map((anchor) => ({
			topIndex: topLevelIndexOf(anchor),
			anchor: anchor.id || undefined,
			title: (anchor.textContent ?? '').replace(/\s+/g, ' ').trim() || pageName,
		}))
		.filter((cp) => cp.topIndex !== -1);

	function sliceText(startIndex: number, endIndex: number): string {
		return topChildren
			.slice(startIndex, endIndex)
			.map((el) => elementText(el).trim())
			.filter(Boolean)
			.join(' ');
	}

	const sections: WikiSection[] = [];

	if (cutPoints.length > 0 && cutPoints[0].topIndex > 0) {
		const preamble = sliceText(0, cutPoints[0].topIndex);
		if (preamble) {
			sections.push({ title: pageName, page: urlChunk, pageName, anchor: undefined, content: preamble });
		}
	}

	for (let i = 0; i < cutPoints.length; i++) {
		const { topIndex, anchor, title } = cutPoints[i];
		const nextTopIndex = cutPoints[i + 1]?.topIndex ?? topChildren.length;
		sections.push({ title, page: urlChunk, pageName, anchor, content: sliceText(topIndex, nextTopIndex) });
	}

	return sections;
}

function BuildIndex(): WikiSection[] {
	return WIKI_PAGES.flatMap(ParsePageIntoSections);
}

function Search(index: WikiSection[], query: string): SearchResult[] {
	const q = query.trim().toLowerCase();
	if (!q)
		return [];

	const results: SearchResult[] = [];

	for (const section of index) {
		if (results.length >= MAX_RESULTS)
			break;

		const titleMatch = section.title.toLowerCase().indexOf(q);
		const contentMatch = section.content.toLowerCase().indexOf(q);

		if (titleMatch !== -1 || contentMatch !== -1) {
			results.push({ section, matchIndex: contentMatch !== -1 ? contentMatch : 0 });
		}
	}

	return results;
}

function BuildPreview(content: string, matchIndex: number): string {
	const half = Math.floor(PREVIEW_LENGTH / 2);
	let start = Math.max(0, matchIndex - half);
	const end = Math.min(content.length, start + PREVIEW_LENGTH);
	start = Math.max(0, end - PREVIEW_LENGTH);

	let preview = content.slice(start, end).trim();
	if (start > 0)
		preview = '…' + preview;
	if (end < content.length)
		preview += '…';

	return preview;
}

function HighlightMatch({ text, query }: { text: string; query: string; }): ReactElement {
	if (!query.trim())
		return <span>{ text }</span>;

	const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
	const lowerQuery = query.toLowerCase();

	return (
		<span>
			{ parts.map((part, i) =>
				part.toLowerCase() === lowerQuery
					? <mark key={ `match-${i}` }>{ part }</mark>
					: <span key={ `text-${i}` }>{ part }</span>,
			) }
		</span>
	);
}

function SectionKey(section: WikiSection): string {
	return `${section.page}__${section.anchor ?? ''}__${section.title}`;
}

function WikiSearchResult({ result, query, onClick }: {
	result: SearchResult;
	query: string;
	onClick: (section: WikiSection) => void;
}): ReactElement {
	const preview = BuildPreview(result.section.content, result.matchIndex);
	const handleClick = useEvent(() => onClick(result.section));

	return (
		<li>
			<button className='wiki-search-result' onClick={ handleClick }>
				<span className='wiki-search-location'>
					<span className='wiki-search-page-tag'>{ result.section.pageName }</span>
					{ result.section.anchor != null && (
						<span className='wiki-search-section-tag'>{ result.section.title }</span>
					) }
				</span>
				<span className='wiki-search-preview'>
					<HighlightMatch text={ preview } query={ query } />
				</span>
			</button>
		</li>
	);
}

export function WikiSearch(): ReactElement {
	const [query, setQuery] = useState('');
	const [index, setIndex] = useState<WikiSection[] | null>(null);
	const idleHandleRef = useRef<number | null>(null);
	const inputId = useId();
	const navigate = useNavigatePandora();

	useEffect(() => {
		const [schedule, cancel] = window.requestIdleCallback
			? [window.requestIdleCallback.bind(window), window.cancelIdleCallback.bind(window)]
			: [(cb: () => void) => setTimeout(cb, 0), clearTimeout];

		idleHandleRef.current = schedule(() => {
			setIndex(BuildIndex());
			idleHandleRef.current = null;
		});

		return () => {
			if (idleHandleRef.current !== null) {
				cancel(idleHandleRef.current);
			}
		};
	}, []);

	const results = useMemo(
		() => (index != null ? Search(index, query) : []),
		[index, query],
	);

	const isIndexing = index === null;

	const handleResultClick = useEvent((section: WikiSection) => {
		navigate(`/wiki/${section.page}${section.anchor ? '#' + section.anchor : ''}`);
	});

	return (
		<div className='wiki-search'>
			<div className='wiki-search-header'>
				<h2>Search the Wiki</h2>
				<p>Find a keyword across all sections of Pandora's wiki or browse it with the tabs on the left.</p>
			</div>

			<div className='wiki-search-input-wrap'>
				<TextInput
					id={ inputId }
					placeholder={ isIndexing ? 'Preparing index…' : 'Type to search…' }
					autoComplete='off'
					spellCheck={ false }
					disabled={ isIndexing }
					value={ query }
					onChange={ setQuery }
					autoFocus
				/>
			</div>

			<div className='wiki-search-results' role='region' aria-live='polite' aria-label='Search results'>
				{ isIndexing && (
					<p>Indexing wiki content…</p>
				) }
				{ !isIndexing && query.trim() === '' && (
					<p>Start typing to search across all wiki pages and sections.</p>
				) }
				{ !isIndexing && query.trim() !== '' && results.length === 0 && (
					<p>
						No results found for <strong>"{ query }"</strong>.<br />
						Try a different keyword or explore the wiki directly with the navigation on the left.
					</p>
				) }
				{ results.length > 0 && (
					<>
						<p className='wiki-search-count'>
							{ results.length }{ results.length >= MAX_RESULTS ? '+' : '' }&nbsp;
							result{ results.length !== 1 ? 's' : '' }
						</p>
						<ul className='wiki-search-list'>
							{ results.map((result) => (
								<WikiSearchResult
									key={ SectionKey(result.section) }
									result={ result }
									query={ query }
									onClick={ handleResultClick }
								/>
							)) }
						</ul>
					</>
				) }
			</div>
		</div>
	);
}
