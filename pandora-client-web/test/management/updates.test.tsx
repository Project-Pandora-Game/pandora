import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { IDirectoryAccountInfo } from 'pandora-common/networking/api/directory_client';
import type { UpdateDraft } from 'pandora-common/updates';
import { MemoryRouter } from 'react-router';
import { jest, MockClientModule } from '../jest.ts';

let account: IDirectoryAccountInfo | null = null;
MockClientModule('services/accountLogic/accountManagerHooks.ts', () => ({ useCurrentAccount: () => account }));
MockClientModule('components/gameContext/directoryConnectorContextProvider.tsx', () => ({
	useAuthTokenHeader: () => 'Basic test-token',
	GetDirectoryUrl: () => new URL('http://localhost:25560/'),
}));
const { UpdateAnnouncements } = await import('../../src/components/management/updates/updates.tsx');

const DRAFT: UpdateDraft = {
	ranges: [{ repository: 'pandora', base: 'a'.repeat(40), target: 'b'.repeat(40), commits: 1 }],
	entries: [{ section: 'Assets', text: 'Added a tray', author: 'Mia', pr: 'https://github.com/Project-Pandora-Game/pandora/pull/42' }],
	pullRequests: [{ number: 42, title: 'Added tray', author: 'Mia', url: 'https://github.com/Project-Pandora-Game/pandora/pull/42', entries: 1 }],
	warnings: ['Check credits'],
	unmatchedCommits: [],
	suggestedPings: ['Any update', 'Asset updates'],
};
type TestResponse = { ok: boolean; status: number; json: () => Promise<unknown>; };
const fetchMock = jest.fn((): Promise<TestResponse> => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(DRAFT) }));
const writeText = jest.fn((_text: string) => Promise.resolve());
const originalFetch = globalThis.fetch;

function Render(authorized: boolean = true): void {
	account = {
		id: 1, username: 'test', displayName: 'Test', created: 0,
		spaceOwnershipLimit: 1, settings: {}, settingsCooldowns: {},
		roles: authorized ? { 'lead-developer': {} } : { developer: {} },
	};
	render(<MemoryRouter><UpdateAnnouncements /></MemoryRouter>);
}

beforeEach(() => {
	Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });
	fetchMock.mockReset();
	const response: TestResponse = { ok: true, status: 200, json: () => Promise.resolve(DRAFT) };
	fetchMock.mockResolvedValue(response);
	writeText.mockResolvedValue(undefined);
	Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
});

afterEach(() => {
	cleanup();
	jest.restoreAllMocks();
	globalThis.fetch = originalFetch;
});

describe('Update announcement management', () => {
	it('requires lead-developer access before enabling generation', () => {
		Render(false);
		expect(screen.getByRole('button', { name: 'Generate draft' })).toBeDisabled();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('generates a draft, preserves edits when changing pings, and copies a bounded part', async () => {
		Render();
		fireEvent.click(screen.getByRole('button', { name: 'Generate draft' }));
		const editor = await screen.findByRole('textbox', { name: 'Announcement draft' });
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(screen.getByText('Check credits')).toBeVisible();
		expect(screen.getByRole('link', { name: 'Added tray' })).toHaveAttribute('href', DRAFT.pullRequests[0].url);
		fireEvent.change(editor, { target: { value: 'Reviewed announcement' } });
		fireEvent.click(screen.getByRole('checkbox', { name: 'Asset updates' }));
		expect(editor).toHaveValue('Reviewed announcement');
		expect(screen.getByRole('textbox', { name: 'Discord part 1' })).toHaveValue('@Ping: Any update\n\nReviewed announcement\n\n❤️');
		fireEvent.click(screen.getByRole('button', { name: 'Copy part 1' }));
		await waitFor(() => expect(writeText).toHaveBeenCalledWith('@Ping: Any update\n\nReviewed announcement\n\n❤️'));
		expect(screen.getByRole('button', { name: 'Generate draft' })).toBeDisabled();
		fireEvent.click(screen.getByRole('button', { name: 'Discard draft and start again' }));
		expect(screen.queryByRole('textbox', { name: 'Announcement draft' })).toBeNull();
		expect(screen.getByRole('button', { name: 'Generate draft' })).toBeEnabled();
	});

	it('shows server failures and enables an explicit retry without a partial draft', async () => {
		const response: TestResponse = { ok: false, status: 502, json: () => Promise.resolve({ error: 'GitHub rate limit' }) };
		fetchMock.mockResolvedValueOnce(response);
		Render();
		fireEvent.click(screen.getByRole('button', { name: 'Generate draft' }));
		expect(await screen.findByRole('alert')).toHaveTextContent('GitHub rate limit');
		expect(screen.queryByRole('textbox', { name: 'Announcement draft' })).toBeNull();
		expect(screen.getByRole('button', { name: 'Generate draft' })).toBeEnabled();
	});
});
