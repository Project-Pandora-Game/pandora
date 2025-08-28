import { GetLogger, ServerService, ZodMatcher } from 'pandora-common';
import { accountManager } from '../../account/accountManager.ts';
import { GitHubInfo } from '../../database/databaseStructure.ts';

import { createOAuthAppAuth, createOAuthUserAuth } from '@octokit/auth-oauth-app';
import { Octokit } from '@octokit/rest';
import { Request, Response, Router } from 'express';
import { nanoid } from 'nanoid';
import { URL } from 'url';
import * as z from 'zod';

const API_PATH = 'https://github.com/login/oauth/';

/** GitHub invalidated state after 10 minuets, extra minute is added as the timeout only starts when the client request it */
const GITHUB_OAUTH_STATE_TIMEOUT = 1000 * 60 * (10 + 1);
/** GitHub OAuth client id */
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
/** GitHub OAuth client secret */
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
/** GitHub personal access token */
const GITHUB_PERSONAL_ACCESS_TOKEN = process.env.GITHUB_PERSONAL_ACCESS_TOKEN || '';
const GITHUB_ORG_NAME = 'Project-Pandora-Game';

const logger = GetLogger('GitHubVerifier');

const states = new Map<string, { accountId: number; login: string; }>();

export const GitHubTeamSchema = z.enum(['beta-access', 'developers', 'host', 'lead-developers']);
const IsGitHubTeam = ZodMatcher(GitHubTeamSchema);
export type GitHubTeam = z.infer<typeof GitHubTeamSchema>;

const invalidTeams = new Set<string>();

let octokitOrg!: Octokit;

export const GitHubVerifier = new class GitHubVerifier implements ServerService {
	private _active = false;

	public get active(): boolean {
		return this._active;
	}

	public async init(): Promise<void> {
		if (this.active) {
			return;
		}
		if (!GITHUB_PERSONAL_ACCESS_TOKEN || !GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
			logger.warning('Secret is not set, GitHub OAuth is disabled');
			return;
		}
		// TODO remove this once the org is public
		octokitOrg = new Octokit({
			auth: `token ${GITHUB_PERSONAL_ACCESS_TOKEN}`,
		});
		if (!await GitHubCheckSecret(octokitOrg, true)) {
			logger.warning('Personal access token is invalid, GitHub OAuth is disabled');
			return;
		}
		const octokitTestClient = new Octokit({
			authStrategy: createOAuthAppAuth,
			auth: {
				clientId: GITHUB_CLIENT_ID,
				clientSecret: GITHUB_CLIENT_SECRET,
			},
		});
		if (!await GitHubCheckSecret(octokitTestClient)) {
			logger.warning('Client secret is invalid, GitHub OAuth is disabled');
			return;
		}

		this._active = true;

		logger.info('GitHub Verifier API is attached');
	}

	private async getTeamMemberships(login: string): Promise<GitHubTeam[]> {
		const teams = await octokitOrg.teams.list({ org: GITHUB_ORG_NAME });
		if (teams.status !== 200) {
			return [];
		}
		const memberships = await Promise.all(teams.data.map(async (team) => {
			const { status, data } = await octokitOrg.teams.listMembersInOrg({ org: GITHUB_ORG_NAME, team_slug: team.slug });
			return status === 200 && data.some((user) => user.login === login) ? [team.slug] : [];
		}));
		const result = new Set<GitHubTeam>();
		for (const team of memberships.flat()) {
			if (IsGitHubTeam(team)) {
				result.add(team);
			} else if (!invalidTeams.has(team)) {
				logger.warning(`Unknown GitHub team: '${team}'`);
				invalidTeams.add(team);
			}
		}
		return [...result];
	}

	public async getGitHubRole({ id, login }: Pick<GitHubInfo, 'id' | 'login'>): Promise<Pick<GitHubInfo, 'role' | 'teams'>> {
		try {
			const org = await octokitOrg.orgs.getMembershipForUser({ org: GITHUB_ORG_NAME, username: login });
			if (org.status === 200 && org.data.state === 'active' && org.data.user?.id === id) {
				return {
					role: org.data.role === 'admin' ? 'admin' : 'member',
					teams: await this.getTeamMemberships(login),
				};
			}
		} catch (e) {
			logger.info('Failed to get GitHub member', e);
		}
		try {
			const outside = await octokitOrg.orgs.listOutsideCollaborators({ org: GITHUB_ORG_NAME });
			if (outside.status === 200 && outside.data.some((user) => user.id === id && user.login === login)) {
				return { role: 'collaborator' };
			}
		} catch (e) {
			logger.info('Failed to get GitHub outside collaborator', e);
		}
		return { role: 'none' };
	}

	public prepareLink(accountId: number, login: string): string | null {
		if (!this.active) {
			return null;
		}

		const state = `${accountId}-${nanoid()}`;
		states.set(state, { accountId, login });
		setTimeout(() => states.delete(state), GITHUB_OAUTH_STATE_TIMEOUT);

		const api = new URL(API_PATH + 'authorize');
		api.searchParams.set('client_id', GITHUB_CLIENT_ID);
		api.searchParams.set('login', login);
		api.searchParams.set('state', state);
		api.searchParams.set('allow_signup', 'false');

		return api.toString();
	}
};

async function GitHubCheckSecret(octokit: Octokit, canRead: boolean = false): Promise<boolean> {
	try {
		const { status, data } = await octokit.orgs.listMembers({ org: GITHUB_ORG_NAME });
		if (status !== 200)
			return false;

		return canRead ? data.length > 0 : true;
	} catch {
		return false;
	}
}

export function GitHubVerifierAPI(): Router {
	const router = Router();
	router.use('/callback', async (req, res) => {
		if (!GitHubVerifier.active) {
			res.status(404).send('GitHub Verifier API is not attached').end();
			return;
		}
		await HandleCallback(req, res);
	});
	return router;
}

async function HandleCallback(req: Request, res: Response): Promise<void> {
	const { code, state } = req.query;
	if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
		res.status(400).send('Bad Request').end();
		return;
	}

	const { accountId, login: requestedLogin } = states.get(state) || {};
	if (!accountId || !requestedLogin) {
		res.status(400).send('Bad Request').end();
		return;
	}

	states.delete(state);

	try {
		const octokit = new Octokit({
			authStrategy: createOAuthUserAuth,
			auth: {
				clientId: GITHUB_CLIENT_ID,
				clientSecret: GITHUB_CLIENT_SECRET,
				code,
				state,
			},
		});

		const { status, data } = await octokit.users.getAuthenticated();
		if (status !== 200 || !data || !data.id || data.type !== 'User' || data.login.localeCompare(requestedLogin, undefined, { sensitivity: 'base' }) !== 0) {
			res.status(403).send('Forbidden').end();
			return;
		}

		await UpdateGitHubRole(data, accountId);

		res.set('Content-Type', 'text/html')
			.status(200)
			.send('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Success</title></head><body><h1>Success</h1><p>You can close this window now.</p></body></html>')
			.end();
	} catch {
		res.status(403).send('Forbidden').end();
	}
}

async function UpdateGitHubRole({ login, id }: Awaited<ReturnType<Octokit['users']['getByUsername']>>['data'], accountId: number): Promise<void> {
	try {
		const result = await GitHubVerifier.getGitHubRole({ id, login });
		const account = await accountManager.loadAccountById(accountId);
		if (!account) {
			logger.warning(`Account ${accountId} not found`);
			return;
		}
		await account.secure.setGitHubInfo({
			...result,
			login,
			id,
		});
	} catch (e) {
		logger.error('Failed to get GitHub role', e);
	}
}
