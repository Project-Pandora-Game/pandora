import * as z from 'zod';

const refSchema = z.string().trim().min(1).max(200).regex(/^[a-zA-Z0-9_./-]+$/);
export const UpdateDraftOptionsSchema = z.strictObject({
	mainBase: refSchema.optional(),
	mainTarget: refSchema.default('master'),
	assetsBase: refSchema.optional(),
	assetsTarget: refSchema.default('master'),
});
export type UpdateDraftOptions = z.input<typeof UpdateDraftOptionsSchema>;

export const UPDATE_SECTIONS = ['Platform changes', 'Assets', 'Fixes', 'Asset creation changes', 'Bot API changes', 'Server infrastructure changes', 'Technical changes'] as const;
export const UPDATE_PINGS = ['Any update', 'Asset updates', 'Asset creation changes', 'Major updates'] as const;
export type UpdatePing = (typeof UPDATE_PINGS)[number];

// These maintainers historically publish their changes without an appended credit.
// This is an announcement convention, independent of current account roles.
const UNATTRIBUTED_UPDATE_AUTHORS = new Set(['clare', 'jomshir', 'jomshir98', 'claudia', 'claudiamia', 'sekkmer']);

function IsUnattributedUpdateAuthor(author: string): boolean {
	const names = author.split(/\s*(?:&|,|\band\b)\s*/i);
	return names.every((name) => UNATTRIBUTED_UPDATE_AUTHORS.has(name.trim().replace(/^@/, '').toLowerCase()));
}

export interface UpdateEntry {
	section: string;
	text: string;
	author: string;
	pr: string;
}
export interface UpdatePullRequest {
	number: number;
	title: string;
	url: string;
	author: string;
	entries: number;
}
export interface UpdateRepositoryRange {
	repository: string;
	base: string;
	target: string;
	deploymentId?: number;
	deploymentDescription?: string;
	commits: number;
}
export interface UpdateDraft {
	unmatchedCommits: { repository: string; sha: string; title: string; }[];
	ranges: UpdateRepositoryRange[];
	pullRequests: UpdatePullRequest[];
	entries: UpdateEntry[];
	warnings: string[];
	suggestedPings: UpdatePing[];
}

/** Remove terminal control characters from contributor-supplied text, retaining Markdown whitespace. */
export function CleanUpdateText(text: string): string {
	// eslint-disable-next-line no-control-regex
	return text.replace(/\r\n?/g, '\n').replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, '');
}

export function ParseUpdateChangelog(body: string, fallbackAuthor: string, pr: string): { entries: UpdateEntry[]; warnings: string[]; author: string; } {
	const warnings: string[] = [];
	const cleaned = CleanUpdateText(body).replace(/<!--[\s\S]*?-->/g, '');
	const lines = cleaned.split('\n');
	const start = lines.findIndex((line) => /^##\s+Changelog\s*$/i.test(line.trim()));
	if (start < 0)
		return { entries: [], warnings: ['No changelog section; review whether this PR needs an announcement.'], author: fallbackAuthor };
	const changelog: string[] = [];
	let fence: string | undefined;
	for (const line of lines.slice(start + 1)) {
		const match = /^\s*(`{3,}|~{3,})/.exec(line);
		if (match) {
			if (fence == null) {
				fence = match[1];
			} else if (match[1][0] === fence[0] && match[1].length >= fence.length) {
				fence = undefined;
			}
			continue;
		}
		if (fence == null && /^##\s+/.test(line))
			break;
		changelog.push(line);
	}
	if (fence != null)
		warnings.push('Unclosed changelog code block; review the extracted text.');
	if (/^[_*]*(?:none|n\/a|no changelog)[_*.]*$/i.test(changelog.join('\n').trim()))
		return { entries: [], warnings, author: fallbackAuthor };
	const credit = changelog.find((line) => /^Authored by:\s*\S/i.test(line.trim()));
	const author = credit?.trim().replace(/^Authored by:\s*/i, '').trim() || fallbackAuthor;
	if (!credit && !IsUnattributedUpdateAuthor(fallbackAuthor))
		warnings.push(`Missing "Authored by:"; using GitHub login ${fallbackAuthor}. Check the display name and coauthors.`);
	const entries: UpdateEntry[] = [];
	let section: string | undefined;
	for (const line of changelog) {
		const trimmed = line.trim();
		if (!trimmed || /^Authored by:/i.test(trimmed))
			continue;
		const heading = /^(?:#{1,6}\s+)?(?:\*\*)?([^:[\]`]+?):(?:\*\*)?$/.exec(trimmed);
		if (heading && !/^[-*+]\s/.test(trimmed) && !/^\s/.test(line)) {
			const name = heading[1].trim();
			section = UPDATE_SECTIONS.find((s) => s.toLowerCase() === name.toLowerCase()) ?? name;
			if (!UPDATE_SECTIONS.includes(section as (typeof UPDATE_SECTIONS)[number]))
				warnings.push(`Unrecognized section "${section}" retained for review.`);
			continue;
		}
		if (/^[_*]*(?:none|n\/a|no changelog)[_*.]*$/i.test(trimmed))
			continue;
		if (!section) {
			section = 'Other changes';
			warnings.push('Changelog text without a section was retained under "Other changes".');
		}
		const previous = entries.at(-1);
		if (/^\s+\S/.test(line) && previous?.section === section) {
			previous.text += '\n' + line;
		} else {
			const text = trimmed.replace(/^[-*+]\s+/, '');
			const entryAuthor = /\[by\s+([^\]]+)\]/i.exec(text)?.[1].trim() || author;
			entries.push({ section, text, author: entryAuthor, pr });
		}
	}
	if (entries.length === 0)
		warnings.push('Empty changelog; review whether this PR needs an announcement.');
	return { entries, warnings, author };
}

export function SuggestUpdatePings(entries: readonly UpdateEntry[]): UpdatePing[] {
	if (entries.length === 0)
		return [];
	const result: UpdatePing[] = ['Any update'];
	if (entries.some((e) => e.section === 'Assets'))
		result.push('Asset updates');
	if (entries.some((e) => e.section === 'Asset creation changes'))
		result.push('Asset creation changes');
	return result;
}

/** Stable ordering preserves each author's original PR/entry order inside each section. */
export function RenderUpdateAnnouncement(entries: readonly UpdateEntry[], pings: readonly UpdatePing[] = []): string {
	const sections = [...new Set(entries.map((e) => e.section))].sort((a, b) => {
		const ai = UPDATE_SECTIONS.indexOf(a as (typeof UPDATE_SECTIONS)[number]);
		const bi = UPDATE_SECTIONS.indexOf(b as (typeof UPDATE_SECTIONS)[number]);
		return (ai < 0 ? UPDATE_SECTIONS.length : ai) - (bi < 0 ? UPDATE_SECTIONS.length : bi) || a.localeCompare(b, 'en');
	});
	const parts = pings.length > 0 ? [pings.map((ping) => `@Ping: ${ping}`).join(' ')] : [];
	for (const section of sections) {
		const lines = entries.filter((e) => e.section === section)
			.sort((a, b) => a.author.localeCompare(b.author, 'en', { sensitivity: 'base' }))
			.map((entry) => /\[by\s+[^\]]+\]/i.test(entry.text) || IsUnattributedUpdateAuthor(entry.author) ? entry.text : `${entry.text} [by ${entry.author}]`);
		parts.push(`${section}:\n${lines.join('\n')}`);
	}
	return parts.join('\n\n');
}

/** Prefer paragraph/line boundaries; hard splits preserve all characters, including surrogate pairs. */
export function SplitUpdateAnnouncement(text: string, limit: number = 2000, heart: boolean = true): string[] {
	if (!Number.isInteger(limit) || limit < 16)
		throw new Error('Message limit must be an integer of at least 16.');
	let remaining = text.trim();
	if (!remaining)
		return [];
	if (heart)
		remaining += '\n\n❤️';
	const result: string[] = [];
	while (remaining.length > limit) {
		let end = remaining.lastIndexOf('\n\n', limit);
		if (end < limit / 2)
			end = remaining.lastIndexOf('\n', limit);
		if (end < limit / 2)
			end = remaining.lastIndexOf(' ', limit);
		if (end < limit / 2)
			end = limit;
		const code = remaining.charCodeAt(end - 1);
		if (code >= 0xd800 && code <= 0xdbff)
			end--;
		result.push(remaining.slice(0, end).trimEnd());
		remaining = remaining.slice(end).trimStart();
	}
	if (remaining)
		result.push(remaining);
	return result;
}

export const UpdateDraftSchema: z.ZodType<UpdateDraft> = z.object({
	unmatchedCommits: z.array(z.object({ repository: z.string(), sha: z.string(), title: z.string() })),
	ranges: z.array(z.object({ repository: z.string(), base: z.string(), target: z.string(), deploymentId: z.number().optional(), deploymentDescription: z.string().optional(), commits: z.number() })),
	pullRequests: z.array(z.object({ number: z.number(), title: z.string(), url: z.url({ protocol: /^https$/ }), author: z.string(), entries: z.number() })),
	entries: z.array(z.object({ section: z.string(), text: z.string(), author: z.string(), pr: z.string() })),
	warnings: z.array(z.string()),
	suggestedPings: z.array(z.enum(UPDATE_PINGS)),
});
