import { IsAuthorized } from 'pandora-common';
import { RenderUpdateAnnouncement, SplitUpdateAnnouncement, UpdateDraftSchema, UPDATE_PINGS, type UpdateDraft, type UpdatePing } from 'pandora-common/updates';
import { useState, type ReactElement } from 'react';
import { CopyToClipboardButton } from '../../../common/clipboard.tsx';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { useCurrentAccount } from '../../../services/accountLogic/accountManagerHooks.ts';
import { Button } from '../../common/button/button.tsx';
import { Column, Row } from '../../common/container/container.tsx';
import { ExternalLink } from '../../common/link/externalLink.tsx';
import { GetDirectoryUrl, useAuthTokenHeader } from '../../gameContext/directoryConnectorContextProvider.tsx';

export function UpdateAnnouncements(): ReactElement {
	const auth = useAuthTokenHeader();
	const account = useCurrentAccount();
	const authorized = !!auth && account?.roles !== undefined && IsAuthorized(account.roles, 'lead-developer');
	const [mainBase, setMainBase] = useState('');
	const [mainTarget, setMainTarget] = useState('master');
	const [assetsBase, setAssetsBase] = useState('');
	const [assetsTarget, setAssetsTarget] = useState('master');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [draft, setDraft] = useState<UpdateDraft | null>(null);
	const [text, setText] = useState('');
	const [pings, setPings] = useState<UpdatePing[]>([]);
	const [heart, setHeart] = useState(true);
	const announcement = [pings.map((ping) => `@Ping: ${ping}`).join(' '), text].filter(Boolean).join('\n\n');
	const messages = SplitUpdateAnnouncement(announcement, 2000, heart);

	async function Generate(): Promise<void> {
		setBusy(true);
		setError('');
		try {
			const response = await fetch(new URL('pandora/mgmt/updates/draft', GetDirectoryUrl()), {
				method: 'POST',
				headers: { 'Authorization': auth!, 'Content-Type': 'application/json' },
				body: JSON.stringify({ mainBase: mainBase.trim() || undefined, mainTarget, assetsBase: assetsBase.trim() || undefined, assetsTarget }),
			});
			if (!response.ok) {
				const failure: unknown = await response.json();
				throw new Error(typeof failure === 'object' && failure != null && 'error' in failure ? String(failure.error) : `Server returned HTTP ${response.status}`);
			}
			const result = UpdateDraftSchema.parse(await response.json());
			setDraft(result);
			setText(RenderUpdateAnnouncement(result.entries));
			setPings(result.suggestedPings);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	}

	return (
		<Column>
			<h2>Update announcement</h2>
			<p>Generate an editable draft from changes since the successful Production deployments. This does not deploy or post to Discord.</p>
			<p>Review credits, missing changelogs, importance, and ping choices. Post only after confirming deployment health and migration results.</p>
			{ !authorized ? <p>A lead developer role is required to generate a draft.</p> : null }
			<Row wrap>
				<label>Pandora base (empty: Production)<TextInput value={ mainBase } onChange={ setMainBase } disabled={ busy || !authorized || draft != null } /></label>
				<label>Pandora target<TextInput value={ mainTarget } onChange={ setMainTarget } disabled={ busy || !authorized || draft != null } /></label>
				<label>Assets base (empty: Production)<TextInput value={ assetsBase } onChange={ setAssetsBase } disabled={ busy || !authorized || draft != null } /></label>
				<label>Assets target<TextInput value={ assetsTarget } onChange={ setAssetsTarget } disabled={ busy || !authorized || draft != null } /></label>
			</Row>
			<Button disabled={ busy || !authorized || draft != null } onClick={ () => {
				void Generate();
			} }>{ busy ? 'Generating…' : 'Generate draft' }
			</Button>
			{ draft ? (
				<Button disabled={ busy } onClick={ () => {
					setDraft(null);
					setText('');
					setPings([]);
				} }>
					Discard draft and start again
				</Button>
			) : null }
			{ error ? <p role='alert'>{ error }</p> : null }
			{ draft ? (
				<>
					<h3>Compared versions</h3>
					{ draft.ranges.map((range) => <p key={ range.repository }>{ range.repository }: <code>{ range.base }</code> → <code>{ range.target }</code> ({ range.commits } commits)</p>) }
					<h3>Review notes ({ draft.warnings.length })</h3>
					<ul>{ draft.warnings.map((warning, i) => <li key={ i }>{ warning }</li>) }</ul>
					<details>
						<summary>Source PRs ({ draft.pullRequests.length })</summary>
						<ul>{ draft.pullRequests.map((pr) => <li key={ pr.url }><ExternalLink href={ pr.url }>{ pr.title }</ExternalLink> — { pr.author }, { pr.entries } entries</li>) }</ul>
					</details>
					<details>
						<summary>Commits without an included PR ({ draft.unmatchedCommits.length })</summary>
						<ul>{ draft.unmatchedCommits.map((commit) => <li key={ `${commit.repository}:${commit.sha}` }><ExternalLink href={ `https://github.com/Project-Pandora-Game/${commit.repository}/commit/${commit.sha}` }>{ commit.repository }: { commit.title }</ExternalLink></li>) }</ul>
					</details>
					<h3>Announcement draft</h3>
					<p>Edit the draft to put the most important changes first and check wording. Ping labels below are placeholders; replace them with the Discord roles when posting.</p>
					<Row wrap>{ UPDATE_PINGS.map((ping) => <label key={ ping }><Checkbox checked={ pings.includes(ping) } onChange={ (checked) => setPings((current) => checked ? [...current, ping] : current.filter((p) => p !== ping)) } />{ ping }</label>) }</Row>
					<label><Checkbox checked={ heart } onChange={ setHeart } />Append a heart to the final part</label>
					<textarea aria-label='Announcement draft' rows={ 20 } value={ text } onChange={ (ev) => setText(ev.target.value) } />
					<CopyToClipboardButton text={ JSON.stringify({ ...draft, text: announcement, messages }, null, 2) } buttonText='Copy draft JSON (includes source commits)' />
					{ messages.length === 0 ? <p>No announcement entries.</p> : null }
					{ messages.map((message, i) => (
						<Column key={ i }>
							<h3>Discord part { i + 1 }/{ messages.length } ({ message.length }/2000)</h3>
							<textarea aria-label={ `Discord part ${i + 1}` } rows={ 10 } readOnly value={ message } />
							<CopyToClipboardButton text={ message } buttonText={ `Copy part ${i + 1}` } />
						</Column>
					)) }
				</>
			) : null }
		</Column>
	);
}
