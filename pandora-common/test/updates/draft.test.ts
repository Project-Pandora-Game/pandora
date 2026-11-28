import { describe, expect, it } from '@jest/globals';
import { ParseUpdateChangelog, RenderUpdateAnnouncement, SplitUpdateAnnouncement, SuggestUpdatePings, UpdateDraftOptionsSchema } from '../../src/updates/draft.ts';

const PR = 'https://github.com/Project-Pandora-Game/pandora/pull/1';

describe('Update announcement formatting', () => {
	it('extracts the template, ignores commented examples and stops at the checklist', () => {
		const result = ParseUpdateChangelog('<!-- ## Changelog\nFake:\n- example -->\n## About The Pull Request\nDetails\n## Changelog\nAuthored by: Sandrine & Mia\n```md\nAssets:\n- [Tray] Renamed the module\nFixes:\n- Fixed a bug:\n  - With nested details\n```\n## Checklist\n- [x] Tested', 'login', PR);
		expect(result.warnings).toEqual([]);
		expect(result.author).toBe('Sandrine & Mia');
		expect(result.entries.map((e) => [e.section, e.text])).toEqual([
			['Assets', '[Tray] Renamed the module'],
			['Fixes', 'Fixed a bug:\n  - With nested details'],
		]);
	});

	it('retains unfamiliar sections, missing headings, and explicit per-entry credits', () => {
		const result = ParseUpdateChangelog('## Changelog\nAuthored by: Clare\n- Important change [by Nikky]\nNew section:\n- Another change', 'login', PR);
		expect(result.warnings).toHaveLength(2);
		expect(RenderUpdateAnnouncement(result.entries)).toContain('Important change [by Nikky]');
		expect(RenderUpdateAnnouncement(result.entries)).not.toContain('[by Nikky] [by Clare]');
		expect(result.entries[1].section).toBe('New section');
	});

	it('handles CRLF, unfenced bodies and legacy plain lines', () => {
		const result = ParseUpdateChangelog('## Changelog\r\nAuthored by: Mia\r\nAssets:\r\nOne change\r\nAnother change\r\n## Checklist\r\nUnchecked', 'login', PR);
		expect(result.entries).toHaveLength(2);
		expect(result.warnings).toEqual([]);
	});

	it('flags missing author, missing changelog and malformed fences without inventing entries', () => {
		expect(ParseUpdateChangelog('Internal update', 'login', PR).entries).toEqual([]);
		expect(ParseUpdateChangelog('## Changelog\n_None_', 'login', PR)).toEqual({ entries: [], warnings: [], author: 'login' });
		const parsed = ParseUpdateChangelog('## Changelog\n```md\nFixes:\n- Fixed it', 'login', PR);
		expect(parsed.warnings.join('\n')).toMatch(/Unclosed/);
		expect(parsed.warnings.join('\n')).toMatch(/Missing "Authored by:"/);
		expect(parsed.entries[0].author).toBe('login');
	});

	it('groups sections and authors while keeping each author stable', () => {
		const entries = [
			{ section: 'Fixes', text: 'Z fix', author: 'Zoe', pr: PR },
			{ section: 'Assets', text: 'A first', author: 'Amy', pr: PR },
			{ section: 'Platform changes', text: 'Feature', author: 'Zoe', pr: PR },
			{ section: 'Assets', text: 'A second', author: 'Amy', pr: PR },
			{ section: 'Assets', text: 'Z asset', author: 'Zoe', pr: PR },
		];
		const text = RenderUpdateAnnouncement(entries, SuggestUpdatePings(entries));
		expect(text).toBe('@Ping: Any update @Ping: Asset updates\n\nPlatform changes:\nFeature [by Zoe]\n\nAssets:\nA first [by Amy]\nA second [by Amy]\nZ asset [by Zoe]\n\nFixes:\nZ fix [by Zoe]');
		expect(SuggestUpdatePings([])).toEqual([]);
		expect(SuggestUpdatePings(entries)).not.toContain('Major updates');
	});

	it.each(['Clare', 'Claudia', 'Sekkmer', 'Jomshir98', 'Jomshir', 'ClaudiaMia', 'Clare & Claudia', 'clare and SEKKMER'])('omits automatic credits for %s without discarding source attribution', (author) => {
		const parsed = ParseUpdateChangelog(`## Changelog\nAuthored by: ${author}\nFixes:\n- Fixed it`, 'login', PR);
		expect(parsed.entries[0].author).toBe(author);
		expect(RenderUpdateAnnouncement(parsed.entries)).toBe('Fixes:\nFixed it');
	});

	it('allows an omitted maintainer name but still flags unknown contributor names', () => {
		const body = '## Changelog\nFixes:\n- Fixed it';
		const maintainer = ParseUpdateChangelog(body, 'Jomshir98', PR);
		expect(maintainer.warnings).toEqual([]);
		expect(RenderUpdateAnnouncement(maintainer.entries)).toBe('Fixes:\nFixed it');
		expect(ParseUpdateChangelog(body, 'contributor', PR).warnings.join('\n')).toContain('Missing "Authored by:"');
	});

	it('keeps mixed collaborations, contributor names, and explicit per-entry credits', () => {
		const parsed = ParseUpdateChangelog('## Changelog\nAuthored by: Clare & Sandrine\nAssets:\n- Shared work\n- Guest work [by Nikky]\n- Explicit credit [by Clare]', 'login', PR);
		const text = RenderUpdateAnnouncement(parsed.entries);
		expect(text).toContain('Shared work [by Clare & Sandrine]');
		expect(text).toContain('Guest work [by Nikky]');
		expect(text).toContain('Explicit credit [by Clare]');
		expect(text).not.toContain('[by Nikky] [by');
	});

	it('strips terminal controls from changelogs', () => {
		const parsed = ParseUpdateChangelog('## Changelog\nAuthored by: Mia\nAssets:\n- Safe\u001b[31m', 'login', PR);
		expect(parsed.entries[0].text).not.toContain('\u001b');
	});

	it('splits oversized paragraphs and emoji without exceeding Discord limits or losing words', () => {
		const text = Array.from({ length: 1000 }, (_, i) => `Change${i}🙂`).join('\n');
		const messages = SplitUpdateAnnouncement(text);
		expect(messages.length).toBeGreaterThan(1);
		expect(messages.every((m) => m.length <= 2000)).toBe(true);
		expect(messages.join('\n').match(/Change\d+🙂/g)).toHaveLength(1000);
		expect(messages.at(-1)).toMatch(/❤️$/);
		expect(messages.slice(0, -1).join('')).not.toContain('❤️');
		const long = SplitUpdateAnnouncement('🙂'.repeat(3000), 2000, false);
		expect(long.join('')).toBe('🙂'.repeat(3000));
	});

	it('handles empty text, final heart overflow and invalid limits', () => {
		expect(SplitUpdateAnnouncement('')).toEqual([]);
		const split = SplitUpdateAnnouncement('x'.repeat(2000));
		expect(split.every((s) => s.length <= 2000)).toBe(true);
		expect(split.at(-1)).toBe('❤️');
		expect(SplitUpdateAnnouncement('text', 2000, false)).toEqual(['text']);
		expect(() => SplitUpdateAnnouncement('text', 1)).toThrow();
	});

	it('validates refs and rejects unexpected options', () => {
		expect(UpdateDraftOptionsSchema.parse({})).toEqual({ mainTarget: 'master', assetsTarget: 'master' });
		expect(UpdateDraftOptionsSchema.safeParse({ mainTarget: '../x?per_page=1' }).success).toBe(false);
		expect(UpdateDraftOptionsSchema.safeParse({ token: 'secret' }).success).toBe(false);
	});
});
