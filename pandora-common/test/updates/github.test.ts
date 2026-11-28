/* eslint-disable @typescript-eslint/require-await -- Synchronous HTTP fixtures implement the asynchronous request interface. */
import { describe, expect, it } from '@jest/globals';
import { CreateUpdateGitHubRequest, GenerateUpdateDraft, type UpdateGitHubRequest } from '../../src/updates/github.ts';

const BASE = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);
const SECOND = 'c'.repeat(40);
const PR = { number: 42, title: 'New asset', user: { login: 'github-login' }, body: '## Changelog\nAuthored by: Mia\n```md\nAssets:\n- Added new asset\n```', merge_commit_sha: HEAD, merged_at: '2026-11-06' };

type FixtureOptions = { status?: string; noDeployment?: boolean; missingPr?: boolean; missingBody?: boolean; clientOnly?: boolean; failedLatest?: boolean; twoCommits?: boolean; paginatedCompare?: boolean; };
function Fixture(options: FixtureOptions = {}): { request: UpdateGitHubRequest; paths: string[]; } {
	const paths: string[] = [];
	return {
		paths,
		request: async (path) => {
			paths.push(path);
			if (path.includes('/deployments?')) {
				expect(path).toContain('environment=Production');
				const deployments = [{ id: 1, sha: BASE, description: options.clientOnly ? 'Client deployment' : 'Full deployment' }];
				return options.noDeployment ? [] : options.failedLatest ? [{ id: 2, sha: SECOND, description: 'Full deployment' }, ...deployments] : deployments;
			}
			if (path.includes('/deployments/2/statuses'))
				return [{ state: 'failure' }];
			if (path.includes('/statuses?'))
				return [{ state: 'success' }];
			if (path.includes('/compare/')) {
				expect(path).toContain(`${BASE}...${HEAD}`);
				const commits = [{ sha: HEAD, commit: { message: 'New asset (#42)' } }];
				if (options.paginatedCompare) {
					const secondPage = path.endsWith('page=2');
					return { status: 'ahead', total_commits: 2, commits: secondPage ? [{ sha: SECOND, commit: { message: 'Earlier commit' } }] : commits };
				}
				if (options.twoCommits)
					commits.push({ sha: SECOND, commit: { message: 'Earlier commit' } });
				return { status: options.status ?? 'ahead', total_commits: commits.length, commits };
			}
			if (path.includes('/pulls?'))
				return options.missingPr ? [] : [{ ...PR, body: options.missingBody ? null : PR.body }, { ...PR, number: 99, merged_at: null }, { ...PR, number: 100, merge_commit_sha: 'd'.repeat(40) }];
			if (path.endsWith('/commits/manual-base'))
				return { sha: BASE };
			if (path.includes('/commits/'))
				return { sha: HEAD };
			throw new Error(`Unexpected fixture path: ${path}`);
		},
	};
}

describe('GitHub update collection', () => {
	it('uses successful Production deployments and freezes targets to SHAs', async () => {
		const fixture = Fixture();
		const draft = await GenerateUpdateDraft(fixture.request);
		expect(draft.ranges.map((r) => [r.base, r.target, r.deploymentId])).toEqual([[BASE, HEAD, 1], [BASE, HEAD, 1]]);
		expect(draft.entries).toHaveLength(2);
		expect(draft.warnings).toEqual([]);
		expect(draft.pullRequests.every((pr) => pr.number === 42)).toBe(true);
		expect(draft.suggestedPings).toEqual(['Any update', 'Asset updates']);
	});

	it('deduplicates PRs across commits but keeps matching PR numbers from different repositories', async () => {
		const fixture = Fixture({ twoCommits: true });
		const draft = await GenerateUpdateDraft(fixture.request);
		expect(draft.pullRequests).toHaveLength(2);
		expect(draft.entries).toHaveLength(2);
	});

	it('fetches all comparison pages', async () => {
		const fixture = Fixture({ paginatedCompare: true });
		const draft = await GenerateUpdateDraft(fixture.request);
		expect(draft.ranges.every((r) => r.commits === 2)).toBe(true);
		expect(fixture.paths.filter((p) => p.includes('/compare/') && p.endsWith('page=2'))).toHaveLength(2);
	});

	it('supports explicit baselines without needing deployment records', async () => {
		const fixture = Fixture({ noDeployment: true });
		await GenerateUpdateDraft(fixture.request, { mainBase: 'manual-base', assetsBase: 'manual-base' });
		expect(fixture.paths.some((p) => p.includes('/deployments'))).toBe(false);
	});

	it('reports failed newer deployments and client-only baselines for review', async () => {
		const draft = await GenerateUpdateDraft(Fixture({ failedLatest: true, clientOnly: true }).request);
		expect(draft.warnings.some((w) => w.includes('failure'))).toBe(true);
		expect(draft.warnings.some((w) => w.includes('client-only'))).toBe(true);
	});

	it.each(['behind', 'diverged'])('rejects %s comparisons instead of producing misleading announcements', async (status) => {
		await expect(GenerateUpdateDraft(Fixture({ status }).request)).rejects.toThrow(status);
	});

	it('fails visibly when the baseline is unknown or a response is malformed', async () => {
		await expect(GenerateUpdateDraft(Fixture({ noDeployment: true }).request)).rejects.toThrow('No successful Production');
		await expect(GenerateUpdateDraft(async () => ({ unexpected: true }))).rejects.toThrow();
	});

	it('retains diagnostics for direct commits and PRs with missing changelogs', async () => {
		const direct = await GenerateUpdateDraft(Fixture({ missingPr: true }).request);
		expect(direct.warnings).toHaveLength(2);
		expect(direct.entries).toEqual([]);
		expect(direct.unmatchedCommits).toHaveLength(2);
		const missing = await GenerateUpdateDraft(Fixture({ missingBody: true }).request);
		expect(missing.warnings).toHaveLength(2);
		expect(missing.pullRequests.every((pr) => pr.entries === 0)).toBe(true);
	});

	it('stops queued requests and rejects the draft when a PR lookup fails', async () => {
		const fixture = Fixture();
		let lookups = 0;
		const request: UpdateGitHubRequest = async (path) => {
			if (path.includes('/compare/'))
				return { status: 'ahead', total_commits: 20, commits: Array.from({ length: 20 }, (_, i) => ({ sha: i.toString(16).padStart(40, '0'), commit: { message: 'Change' } })) };
			if (path.includes('/pulls?')) {
				lookups++;
				throw new Error('API failed');
			}
			return await fixture.request(path);
		};
		await expect(GenerateUpdateDraft(request)).rejects.toThrow('API failed');
		expect(lookups).toBeLessThanOrEqual(4);
	});

	it('keeps authentication off output and propagates HTTP errors', async () => {
		let seenUrl = '';
		const request = CreateUpdateGitHubRequest(async (url, headers) => {
			seenUrl = url;
			expect(headers.Authorization).toBe('Bearer secret');
			return { ok: false, status: 403, json: async () => ({}) };
		}, 'secret');
		await expect(request('/repos/Project-Pandora-Game/pandora/deployments')).rejects.toThrow('HTTP 403');
		expect(seenUrl).toBe('https://api.github.com/repos/Project-Pandora-Game/pandora/deployments');
		await expect(request('https://other.example')).rejects.toThrow('Unexpected');
	});
});
