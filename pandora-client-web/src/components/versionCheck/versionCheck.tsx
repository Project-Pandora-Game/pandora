import { useEffect, useRef, useState } from 'react';
import { useMounted } from '../../common/useMounted.ts';
import { VersionDataSchema, type VersionData } from '../../config/definition.ts';
import { BUILD_TIME, GIT_COMMIT_HASH, NODE_ENV, USER_DEBUG } from '../../config/Environment.ts';
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
	const [nextVersion, setNextVersion] = useState<VersionData | null>();
	const [ignoredVersion, setIgnoredVersion] = useState('');
	const notifiedRef = useRef(false);
	const notify = useNotification(NotificationSource.VERSION_CHANGED);

	const mounted = useMounted();

	useEffect(() => {
		const cleanup = setInterval(() => {
			GetCurrentVersion()
				.then((version) => {
					if (mounted && version.gitCommitHash !== GIT_COMMIT_HASH) {
						setNextVersion(version);
						if (!notifiedRef.current) {
							notifiedRef.current = true;
							notify({
								// TODO: notification
							});
						}
					} else {
						setNextVersion(null);
					}
				})
				.catch(() => { /** noop */ });
		}, VERSION_CHECK_INTERVAL);
		return () => clearInterval(cleanup);
	}, [mounted, notify]);

	if (nextVersion == null || nextVersion.gitCommitHash === ignoredVersion) {
		return null;
	}

	return (
		<ModalDialog>
			<h3>
				You are running an outdated version of Project Pandora.
			</h3>
			<p>
				Currently running version: { GIT_COMMIT_HASH } from { new Date(BUILD_TIME).toLocaleDateString() }
			</p>
			<p>
				New version: { nextVersion.gitCommitHash } from { new Date(nextVersion.buildTime).toLocaleDateString() }
			</p>
			<p>
				Please reload the page to get the newest version.
			</p>
			<Row alignX='space-between'>
				<Button onClick={ () => setIgnoredVersion(nextVersion.gitCommitHash) }>
					Cancel
				</Button>
				<Button onClick={ () => window.location.reload() }>Reload</Button>
			</Row>
		</ModalDialog>
	);
}

async function GetCurrentVersion(): Promise<VersionData> {
	const result = await fetch(`/version.json?${Date.now()}`);
	return VersionDataSchema.parse(await result.json());
}
