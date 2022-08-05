import React, { useState, useRef, useEffect } from 'react';
import { useMounted } from '../../common/useMounted';
import { GIT_COMMIT_HASH, NODE_ENV } from '../../config/Environment';
import { Button } from '../common/Button/Button';
import { Dialog, DialogCloseButton } from '../dialog/dialog';
import { useNotification, NotificationSource } from '../gameContext/notificationContextProvider';

const VERSION_CHECK_INTERVAL = 5 * 60_000; // 5 minutes

export function VersionCheck() {
	return NODE_ENV === 'production' ? <VersionCheckImpl /> : null;
}

function VersionCheckImpl() {
	const [nextVersion, setNextVersion] = useState('');
	const notifiedRef = useRef(false);
	const { notify } = useNotification(NotificationSource.VERSION_CHANGED);

	const mounted = useMounted();

	useEffect(() => {
		const cleanup = setInterval(() => {
			GetCurrentVersion()
				.then((version) => {
					if (mounted && version !== GIT_COMMIT_HASH) {
						setNextVersion(version);
						if (!notifiedRef.current) {
							notifiedRef.current = true;
							notify({});
						}
					} else {
						setNextVersion('');
					}
				})
				.catch(() => { /** noop */ });
		}, VERSION_CHECK_INTERVAL);
		return () => clearInterval(cleanup);
	}, [mounted, notify]);

	if (!nextVersion) {
		return null;
	}

	return (
		<Dialog>
			<h3>
				You are running an outdated version of the application.
			</h3>
			<p>
				Current version: {GIT_COMMIT_HASH}.
			</p>
			<p>
				New version: {nextVersion}
			</p>
			<p>
				Please reload the page.
			</p>
			<div>
				<Button onClick={ () => window.location.reload() }>Reload</Button>
				<DialogCloseButton>Cancel</DialogCloseButton>
			</div>
		</Dialog>
	);
}

async function GetCurrentVersion(): Promise<string> {
	const result = await fetch(`/version.json?${Date.now()}`);
	const json = await result.json() as { gitCommitHash: string };
	return json.gitCommitHash;
}
