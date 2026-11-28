import { parseArgs } from 'node:util';
import { CreateUpdateGitHubRequest, GenerateUpdateDraft, RenderUpdateAnnouncement, SplitUpdateAnnouncement, UPDATE_PINGS, type UpdatePing } from 'pandora-common/updates';

const HELP = `Usage: pandora-cli updates [options]

Generate a draft from Production to master for Pandora and its assets, without
connecting to a Pandora server, deploying, or posting to Discord.

  --main-base REF       Override the successful Production baseline
  --main-target REF     Target commit or branch (default: master)
  --assets-base REF     Override the assets Production baseline
  --assets-target REF   Assets target commit or branch (default: master)
  --format FORMAT      markdown (default), json, or discord
  --pings LIST         Comma-separated ping names; empty disables suggested pings
  --no-heart           Omit the final heart in Discord parts
  --help               Show this help

Optional authentication: PANDORA_UPDATES_GITHUB_TOKEN, GH_TOKEN, or GITHUB_TOKEN.
Public repository reads also work unauthenticated, with a lower API rate limit.
Review warnings, credits, ordering, and deployment health before posting.
`;

export async function RunUpdatesCommand(args: string[]): Promise<boolean> {
	const { values } = parseArgs({
		args,
		options: {
			'main-base': { type: 'string' },
			'main-target': { type: 'string' },
			'assets-base': { type: 'string' },
			'assets-target': { type: 'string' },
			'format': { type: 'string', default: 'markdown' },
			'pings': { type: 'string' },
			'no-heart': { type: 'boolean', default: false },
			'help': { type: 'boolean', default: false },
		},
	});
	if (values.help) {
		process.stdout.write(HELP);
		return true;
	}
	if (!['markdown', 'json', 'discord'].includes(values.format))
		throw new Error('Format must be markdown, json, or discord.');
	const pings = values.pings?.split(',').map((s) => s.trim()).filter(Boolean);
	if (pings?.some((p) => !UPDATE_PINGS.includes(p as UpdatePing)))
		throw new Error(`Unknown ping. Choose from: ${UPDATE_PINGS.join(', ')}.`);
	const token = process.env.PANDORA_UPDATES_GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
	const request = CreateUpdateGitHubRequest((url, headers) => fetch(url, { headers, signal: AbortSignal.timeout(30_000), redirect: 'error' }), token);
	const draft = await GenerateUpdateDraft(request, {
		mainBase: values['main-base'], mainTarget: values['main-target'],
		assetsBase: values['assets-base'], assetsTarget: values['assets-target'],
	});
	const text = RenderUpdateAnnouncement(draft.entries, (pings as UpdatePing[] | undefined) ?? draft.suggestedPings);
	const messages = SplitUpdateAnnouncement(text, 2000, !values['no-heart']);
	for (const range of draft.ranges)
		process.stderr.write(`${range.repository}: ${range.base}..${range.target} (${range.commits} commits)\n`);
	for (const warning of draft.warnings)
		process.stderr.write(`Review: ${warning}\n`);
	if (values.format === 'json') {
		process.stdout.write(JSON.stringify({ ...draft, text, messages }, null, 2) + '\n');
	} else if (values.format === 'discord') {
		process.stdout.write(messages.map((message, i) => `--- Part ${i + 1}/${messages.length} ---\n${message}`).join('\n\n') + '\n');
	} else {
		process.stdout.write(text + '\n');
	}
	return true;
}
