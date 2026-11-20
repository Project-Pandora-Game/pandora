import * as z from 'zod';
import { CleanUpdateText, ParseUpdateChangelog, SuggestUpdatePings, UpdateDraftOptionsSchema, type UpdateDraft, type UpdateDraftOptions, type UpdateRepositoryRange } from './draft.ts';

/** Request paths are generated internally and always relative to https://api.github.com. */
export type UpdateGitHubRequest = (path: string) => Promise<unknown>;
const shaSchema = z.string().regex(/^[a-f0-9]{40}$/);
const deploymentSchema = z.object({ id: z.number(), sha: shaSchema, description: z.string().nullable() });
const commitSchema = z.object({ sha: shaSchema, commit: z.object({ message: z.string() }) });
const compareSchema = z.object({ status: z.enum(['identical', 'ahead', 'behind', 'diverged']), total_commits: z.number().int().nonnegative(), commits: z.array(commitSchema) });
const pullSchema = z.object({ number: z.number(), title: z.string(), body: z.string().nullable(), user: z.object({ login: z.string() }).nullable(), merged_at: z.string().nullable(), merge_commit_sha: z.string().nullable() });

async function FindProductionDeployment(request: UpdateGitHubRequest, prefix: string, warnings: string[]): Promise<z.infer<typeof deploymentSchema>> {
	for (let page = 1; page <= 10; page++) {
		const deployments = z.array(deploymentSchema).parse(await request(`${prefix}/deployments?environment=Production&per_page=100&page=${page}`));
		for (const deployment of deployments) {
			const statuses = z.array(z.object({ state: z.string() })).parse(await request(`${prefix}/deployments/${deployment.id}/statuses?per_page=1`));
			if (statuses[0]?.state === 'success')
				return deployment;
			warnings.push(`${prefix}: newer Production deployment ${deployment.id} has status ${statuses[0]?.state ?? 'unknown'}. Verify the running version before using this baseline.`);
		}
		if (deployments.length < 100)
			break;
	}
	throw new Error(`No successful Production deployment found for ${prefix}. Supply an explicit base commit.`);
}

async function MapUpdateItems<T, R>(items: readonly T[], map: (item: T) => Promise<R>): Promise<R[]> {
	const result: R[] = [];
	let next = 0;
	let failure: Error | undefined;
	await Promise.all(Array.from({ length: Math.min(4, items.length) }, async () => {
		while (failure == null && next < items.length) {
			const index = next++;
			try {
				result[index] = await map(items[index]);
			} catch (error) {
				failure ??= error instanceof Error ? error : new Error('GitHub request failed.', { cause: error });
			}
		}
	}));
	if (failure != null)
		throw failure;
	return result;
}

/** Read-only: resolves targets to immutable SHAs, compares ancestry, then maps included merge commits to PRs. */
export async function GenerateUpdateDraft(request: UpdateGitHubRequest, input: UpdateDraftOptions = {}): Promise<UpdateDraft> {
	const options = UpdateDraftOptionsSchema.parse(input);
	const draft: UpdateDraft = { unmatchedCommits: [], ranges: [], pullRequests: [], entries: [], warnings: [], suggestedPings: [] };
	for (const repository of ['pandora', 'pandora-assets'] as const) {
		const prefix = `/repos/Project-Pandora-Game/${repository}`;
		const baseRef = repository === 'pandora' ? options.mainBase : options.assetsBase;
		const targetRef = repository === 'pandora' ? options.mainTarget : options.assetsTarget;
		const deployment = baseRef ? undefined : await FindProductionDeployment(request, prefix, draft.warnings);
		const base = deployment?.sha ?? z.object({ sha: shaSchema }).parse(await request(`${prefix}/commits/${encodeURIComponent(baseRef!)}`)).sha;
		const target = z.object({ sha: shaSchema }).parse(await request(`${prefix}/commits/${encodeURIComponent(targetRef)}`)).sha;
		const range: UpdateRepositoryRange = { repository, base, target, deploymentId: deployment?.id, deploymentDescription: deployment?.description ?? undefined, commits: 0 };
		draft.ranges.push(range);
		if (deployment && /client/i.test(deployment.description ?? ''))
			draft.warnings.push(`${repository}: baseline deployment was client-only. Server changes may still be outstanding; supply the last full deployment as mainBase when appropriate.`);
		const commits: z.infer<typeof commitSchema>[] = [];
		for (let page = 1; ; page++) {
			const comparison = compareSchema.parse(await request(`${prefix}/compare/${base}...${target}?per_page=100&page=${page}`));
			if (comparison.status === 'behind' || comparison.status === 'diverged')
				throw new Error(`${repository}: target is ${comparison.status} relative to the baseline. Review the rollback or branch divergence and supply the intended base and target.`);
			commits.push(...comparison.commits);
			if (commits.length >= comparison.total_commits)
				break;
			if (comparison.commits.length === 0 || page >= 100)
				throw new Error(`${repository}: could not retrieve the complete commit range. No partial announcement was generated.`);
		}
		range.commits = commits.length;
		const includedShas = new Set(commits.map((c) => c.sha));
		const associated = await MapUpdateItems(commits, async (commit) => {
			const pulls: z.infer<typeof pullSchema>[] = [];
			for (let page = 1; ; page++) {
				const items = z.array(pullSchema).parse(await request(`${prefix}/commits/${commit.sha}/pulls?per_page=100&page=${page}`));
				pulls.push(...items);
				if (items.length < 100)
					return pulls.filter((pr) => pr.merged_at != null && pr.merge_commit_sha != null && includedShas.has(pr.merge_commit_sha));
				if (page >= 10)
					throw new Error(`${repository}: too many PR associations; unable to produce a complete draft.`);
			}
		});
		const prs = new Map<number, z.infer<typeof pullSchema>>();
		for (let i = 0; i < commits.length; i++) {
			if (associated[i].length === 0)
				draft.unmatchedCommits.push({ repository, sha: commits[i].sha, title: CleanUpdateText(commits[i].commit.message.split('\n')[0]) });
			for (const pr of associated[i])
				prs.set(pr.number, pr);
		}
		const unmatched = draft.unmatchedCommits.filter((commit) => commit.repository === repository);
		if (unmatched.length > 0)
			draft.warnings.push(`${repository}: ${unmatched.length} ${unmatched.length === 1 ? 'commit has' : 'commits have'} no included merged PR. Review the unmatched commits in the UI or JSON output.`);
		for (const pr of prs.values()) {
			const url = `https://github.com/Project-Pandora-Game/${repository}/pull/${pr.number}`;
			const parsed = ParseUpdateChangelog(pr.body ?? '', CleanUpdateText(pr.user?.login ?? 'unknown'), url);
			draft.entries.push(...parsed.entries);
			draft.warnings.push(...parsed.warnings.map((warning) => `${repository}#${pr.number}: ${warning}`));
			draft.pullRequests.push({ number: pr.number, title: CleanUpdateText(pr.title), url, author: parsed.author, entries: parsed.entries.length });
		}
	}
	draft.suggestedPings = SuggestUpdatePings(draft.entries);
	return draft;
}

/** Inject the runtime fetch implementation so this module works without DOM or Node ambient types. */
export function CreateUpdateGitHubRequest(fetcher: (url: string, headers: Record<string, string>) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown>; }>, token?: string): UpdateGitHubRequest {
	return async (path) => {
		if (!path.startsWith('/repos/Project-Pandora-Game/'))
			throw new Error('Unexpected GitHub API path.');
		const response = await fetcher(`https://api.github.com${path}`, {
			'Accept': 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		});
		if (!response.ok)
			throw new Error(`GitHub returned HTTP ${response.status} for ${path}. Check repository access, token permissions and rate limits.`);
		return await response.json();
	};
}
