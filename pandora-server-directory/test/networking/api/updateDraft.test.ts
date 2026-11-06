import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import type { Server } from 'node:http';
import { ENV } from '../../../src/config.ts';
import { PandoraApiManagement } from '../../../src/networking/api/mgmt.ts';
import { TestMockAccount } from '../../utils.ts';

const fetchServer = globalThis.fetch;
const AUTH = 'Basic ' + Buffer.from('0:update-draft-test').toString('base64');
let server: Server;
let endpoint: string;

beforeAll(async () => {
	const app = express();
	app.use('/pandora/mgmt', PandoraApiManagement());
	await new Promise<void>((resolve) => {
		server = app.listen(0, '127.0.0.1', () => resolve());
	});
	const address = server.address();
	if (address == null || typeof address === 'string')
		throw new Error('Expected TCP address');
	endpoint = `http://127.0.0.1:${address.port}/pandora/mgmt/updates/draft`;
});

beforeEach(() => {
	jest.replaceProperty(ENV, 'ADMIN_ENDPOINT_TOKEN', 'update-draft-test');
});
afterEach(() => {
	jest.restoreAllMocks();
});
afterAll(async () => {
	await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

describe('Update draft management endpoint', () => {
	it('rejects unauthenticated requests without contacting GitHub', async () => {
		const github = jest.spyOn(globalThis, 'fetch');
		const response = await fetchServer(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
		expect(response.status).toBe(401);
		expect(github).not.toHaveBeenCalled();
	});

	it('rejects authenticated accounts without the lead-developer role', async () => {
		const account = await TestMockAccount();
		const token = await account.secure.generateNewLoginToken();
		const auth = 'Basic ' + Buffer.from(Buffer.from(account.username).toString('base64') + ':' + token.value).toString('base64');
		const github = jest.spyOn(globalThis, 'fetch');
		const response = await fetchServer(endpoint, { method: 'POST', headers: { 'Authorization': auth, 'Content-Type': 'application/json' }, body: '{}' });
		expect(response.status).toBe(403);
		expect(github).not.toHaveBeenCalled();
	});

	it('validates refs after authentication and before contacting GitHub', async () => {
		const github = jest.spyOn(globalThis, 'fetch');
		const response = await fetchServer(endpoint, { method: 'POST', headers: { 'Authorization': AUTH, 'Content-Type': 'application/json' }, body: '{"mainTarget":"bad?ref"}' });
		expect(response.status).toBe(400);
		expect(github).not.toHaveBeenCalled();
	});

	it('rejects concurrent generation and releases the slot after an upstream failure', async () => {
		let rejectRequest: (error: Error) => void = () => {
			throw new Error('Request not started');
		};
		let started: () => void = () => {
			throw new Error('Start observer not ready');
		};
		const start = new Promise<void>((resolve) => {
			started = resolve;
		});
		jest.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>((_resolve, reject) => {
			rejectRequest = reject;
			started();
		}));
		const first = fetchServer(endpoint, { method: 'POST', headers: { 'Authorization': AUTH, 'Content-Type': 'application/json' }, body: '{}' });
		await start;
		const second = await fetchServer(endpoint, { method: 'POST', headers: { 'Authorization': AUTH, 'Content-Type': 'application/json' }, body: '{}' });
		expect(second.status).toBe(429);
		rejectRequest(new Error('GitHub unavailable'));
		expect((await first).status).toBe(502);
		jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Still unavailable'));
		const retry = await fetchServer(endpoint, { method: 'POST', headers: { 'Authorization': AUTH, 'Content-Type': 'application/json' }, body: '{}' });
		expect(retry.status).toBe(502);
	});

	it('returns a draft using only GET requests to GitHub', async () => {
		const sha = 'a'.repeat(40);
		jest.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
			expect(init?.method).toBeUndefined();
			const path = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
			let data: unknown;
			if (path.includes('/deployments?')) {
				data = [{ id: 1, sha, description: 'Full deployment' }];
			} else if (path.includes('/statuses?')) {
				data = [{ state: 'success' }];
			} else if (path.includes('/compare/')) {
				data = { status: 'identical', total_commits: 0, commits: [] };
			} else {
				data = { sha };
			}
			return Promise.resolve(new Response(JSON.stringify(data), { status: 200 }));
		});
		const response = await fetchServer(endpoint, { method: 'POST', headers: { 'Authorization': AUTH, 'Content-Type': 'application/json' }, body: '{}' });
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ entries: [], warnings: [], ranges: [{ base: sha, target: sha }, { base: sha, target: sha }] });
	});
});
