import { useEffect, useRef, useState } from 'react';
import { useMounted } from '../../common/useMounted.ts';
import { GIT_COMMIT_HASH, NODE_ENV, USER_DEBUG } from '../../config/Environment.ts';
import { NotificationSource, useNotification } from '../../services/notificationHandler.ts';
import { Button } from '../common/button/button.tsx';
import { Row } from '../common/container/container.tsx';
import { ModalDialog } from '../dialog/dialog.tsx';

// In debug mode 30 seconds, otherwise 5 minutes per new version check
const VERSION_CHECK_INTERVAL = USER_DEBUG ? 30_000 : (5 * 60_000);

export function VersionCheck() {
	return NODE_ENV === 'production' ? <VersionCheckImpl /> : null;
}

function VersionCheckImpl() {
	const [nextVersion, setNextVersion] = useState('');
	const [ignoredVersion, setIgnoredVersion] = useState('');
	const notifiedRef = useRef(false);
	const notify = useNotification(NotificationSource.VERSION_CHANGED);

	const mounted = useMounted();

	useEffect(() => {
		const cleanup = setInterval(() => {
			GetCurrentVersion()
				.then((version) => {
					if (mounted && version !== GIT_COMMIT_HASH) {
						setNextVersion(version);
						if (!notifiedRef.current) {
							notifiedRef.current = true;
							notify({
								// TODO: notification
							});
						}
					} else {
						setNextVersion('');
					}
				})
				.catch(() => { /** noop */ });
		}, VERSION_CHECK_INTERVAL);
		return () => clearInterval(cleanup);
	}, [mounted, notify]);

	if (!nextVersion || nextVersion === ignoredVersion) {
		return null;
	}

	return (
		<ModalDialog>
			<h3>
				You are running an outdated version of Project Pandora.
			</h3>
			<p>
				Currently running version: { GIT_COMMIT_HASH }
			</p>
			<p>
				New version: { nextVersion }
			</p>
			<p>
				Please reload the page to get the newest version.
			</p>
			<Row alignX='space-between'>
				<Button onClick={ () => setIgnoredVersion(nextVersion) }>
					Cancel
				</Button>
				<Button onClick={ () => window.location.reload() }>Reload</Button>
			</Row>
		</ModalDialog>
	);
}

async function GetCurrentVersion(): Promise<string> {
	const result = await fetch(`/version.json?${Date.now()}`);
	const json = await result.json() as { gitCommitHash: string; };
	return json.gitCommitHash;
}
