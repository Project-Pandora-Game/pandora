import { CharacterId, IChatModifier, IClientMessage, IChatSegment } from 'pandora-common';

export type ParserConfig<Types extends string, Default extends string> = Record<Exclude<Types, Default>, [string, string]>;

type LineTypes = 'chat' | 'me' | 'emote' | 'ooc' | 'raw' | 'link';

const ESCAPE = '\\'; // length must be 1

function IndexOf(text: string, find: string): [number, string] {
	const index = text.indexOf(find);
	if (index <= 0)
		return [index, text];

	if (text[index - 1] !== ESCAPE)
		return [index, text];

	if (text[index - 2] !== ESCAPE) {
		const [i2, t2] = IndexOf(text.substring(index + find.length), find);
		return [i2 === -1 ? -1 : i2 + index - 1, text.substring(0, index - 1) + find + t2];
	}

	return [index - 1, text.substring(0, index - 1) + find + text.substring(index + find.length)];
}

export class LineParser {
	private readonly _config: [string, string, RegExp, LineTypes, boolean][] = [
		['**', '*\n', /\*?\*$/, 'emote', false],
		['*', '*\n', /\*$/, 'me', false],
		['((', '))\n', /\)?\)$/g, 'ooc', true],
		['```', '```\n', /`{3}$/, 'raw', true],
		['https://', '\n', /\s/g, 'link', true],
		['http://', '\n', /\s/g, 'link', true],
	];

	public parse(text: string, allowNonTargeted: boolean): [LineTypes, string][] {
		const result: [LineTypes, string][] = [];
		while (text) {
			const [type, inner, next] = this._parseOne(text, allowNonTargeted);
			if (type)
				result.push([type, inner?.trim() ?? '']);

			text = next ?? '';
		}

		return result;
	}

	private _parseOne(text: string, allowNonTargeted: boolean): [LineTypes, string, string?] | [] {
		text = text.trim();
		if (!text)
			return [];

		for (const [start, lineEnd, replace, type, targeted] of this._config) {
			if (!targeted && !allowNonTargeted)
				continue;

			if (text.startsWith(start)) {
				const [index, inner] = IndexOf(text, lineEnd);
				const idx = type === 'link' ? 0 : start.length;
				if (index === -1)
					return [type, inner.substring(idx).replace(replace, '')];

				return [type, inner.substring(idx, index).replace(replace, ''), inner.substring(index + lineEnd.length)];
			}

			if (text.startsWith(ESCAPE + start)) {
				text = text.substring(1);
				break;
			}
		}

		const [indexA, tA] = allowNonTargeted ? IndexOf(text, '\n*') : [-1, text];
		const [indexB, tB] = IndexOf(text, '\n((');
		if (indexA === -1 && indexB === -1)
			return ['chat', text];

		if (indexA === -1)
			return ['chat', tB.substring(0, indexB), tB.substring(indexB + 1)];

		if (indexB === -1)
			return ['chat', tA.substring(0, indexA), tA.substring(indexA + 1)];

		if (indexA < indexB)
			return ['chat', tA.substring(0, indexA), tA.substring(indexA + 1)];

		return ['chat', tB.substring(0, indexB), tB.substring(indexB + 1)];
	}
}

export class SegmentParser {
	private readonly _config: [string, IChatModifier][] = [
		['__', 'bold'],
		['_', 'italic'],
	];
	private readonly _toEscape = '_';

	public parse(text: string, allowLinks: boolean = false): IChatSegment[] {
		text = text.trim();
		const result: IChatSegment[] = [];
		if (allowLinks) {
			const match = /^\s*(https?:\/\/[^\s]+)/.exec(text);
			if (match) {
				result.push(['normal', match[0]]);
				text = text.substring(match[0].length);
				if (!text.trim())
					return result;
			}
		}
		while (text) {
			const [modifier, inner, next] = this._parseOne(text);
			if (modifier)
				result.push([modifier, inner ?? '']);

			text = next ?? '';
		}
		return result;
	}

	public escape(text: string): string {
		let result = '';
		for (const c of text) {
			if (c.includes(this._toEscape) || c === ESCAPE)
				result += ESCAPE;

			result += c;
		}
		return result;
	}

	private _parseOne(text: string): [IChatModifier, string, string?] | [] {
		if (!text)
			return [];

		let acc = '';
		for (let i = 0; i < text.length; i++) {
			if (text[i] === ESCAPE) {
				if (this._config.some(([f]) => text.startsWith(f, i + 1))) {
					acc += text[i + 1];
					++i;
				} else {
					acc += text[i];
				}
				continue;
			}
			const [find, modifier] = this._config.find(([f]) => text.startsWith(f, i)) ?? [];
			if (!find || !modifier) {
				acc += text[i];
				continue;
			}
			if (i !== 0) {
				return ['normal', acc, text.substring(i)];
			}
			for (let j = find.length; j < text.length; j++) {
				if (text[j] === ESCAPE && text[j + 1] === find[0]) {
					acc += text[j + 1];
					++j;
				}
				if (text.startsWith(find, j)) {
					return [modifier, acc, text.substring(j + find.length)];
				}
				acc += text[j];
			}
			return [modifier, acc];
		}
		return ['normal', acc];
	}
}

export const ChatParser = new class ChatParser {
	private readonly _lineParser = new LineParser();
	private readonly _segmentParser = new SegmentParser();

	public parse(text: string, to?: CharacterId[]): IClientMessage[] {
		const lines = this._lineParser.parse(text, to === undefined);
		if (!lines.length)
			return [];

		const result: IClientMessage[] = [];
		for (const [type, line] of lines) {
			switch (type) {
				case 'emote':
				case 'me':
					result.push({
						type,
						parts: this._segmentParser.parse(line, false),
					});
					break;
				case 'chat':
				case 'ooc':
					result.push({
						type,
						parts: this._segmentParser.parse(line, type === 'ooc'),
						to,
					});
					break;
				case 'raw':
					result.push({
						type: 'chat',
						parts: [['normal', line]],
						to,
					});
					break;
				case 'link':
					result.push({
						type: 'ooc',
						parts: [['normal', line]],
						to,
					});
					break;
			}
		}
		return result;
	}

	public parseStyle(text: string, allowLinks: boolean = false): IChatSegment[] {
		return this._segmentParser.parse(text, allowLinks);
	}

	public escapeStyle(text: string): string {
		return this._segmentParser.escape(text);
	}
};
