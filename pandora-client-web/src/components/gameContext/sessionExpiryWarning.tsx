import { FormatTimeInterval } from 'pandora-common';
import { useEffect, useState, type ReactElement } from 'react';
import { useCurrentTime } from '../../common/useCurrentTime.ts';
import { useObservable } from '../../observable.ts';
import { useCurrentAccount } from '../../services/accountLogic/accountManagerHooks.ts';
import { Button } from '../common/button/button.tsx';
import { Column, Row } from '../common/container/container.tsx';
import { DraggableDialog } from '../dialog/dialog.tsx';
import { ExtendCurrentSessionDialog } from '../settings/securitySettings.tsx';
import { useDirectoryConnector } from './directoryConnectorContextProvider.tsx';

const TIME_LEFT_WARNING = 24 * 60 * 60_000;
const TIME_LEFT_WARNING_HIGHLIGHT = 15 * 60_000;

export function SessionExpiryWarningProvider(): ReactElement | null {
	const isLoggedIn = useCurrentAccount() != null;
	const directoryConnector = useDirectoryConnector();
	const authToken = useObservable(directoryConnector.authToken);

	const [showExpiryWarning, setShowExpiryWarning] = useState(false);

	useEffect(() => {
		if (isLoggedIn && authToken != null) {
			const timeLeft = authToken.expires - Date.now();
			const underTwentyFourHours = timeLeft - TIME_LEFT_WARNING;
			if (underTwentyFourHours > 0) {
				const timeout = setTimeout(() => {
					setShowExpiryWarning(true);
				}, underTwentyFourHours);
				return () => {
					clearTimeout(timeout);
				};
			} else {
				setShowExpiryWarning(true);
				return undefined;
			}
		} else {
			return undefined;
		}
	}, [isLoggedIn, authToken]);

	if (!showExpiryWarning)
		return null;

	return (
		<SessionExpiryWarningDialog onClose={ () => setShowExpiryWarning(false) } />
	);
}

function SessionExpiryWarningDialog({ onClose }: { onClose: () => void; }): ReactElement | null {
	const directoryConnector = useDirectoryConnector();
	const authToken = useObservable(directoryConnector.authToken);
	const [showExtend, setShowExtend] = useState(false);
	const now = useCurrentTime();

	if (!authToken) {
		return null;
	}

	const timeLeft = authToken.expires - now;

	const hide = () => {
		onClose();
		return true;
	};

	if (showExtend) {
		return <ExtendCurrentSessionDialog token={ authToken } hide={ hide } />;
	}

	return (
		<DraggableDialog
			title='Auto-logout notice'
			close={ onClose }
			highlight={ timeLeft < TIME_LEFT_WARNING_HIGHLIGHT }
			allowShade
		>
			<Column gap='x-large'>
				<Column>
					<span>Your session will expire in:</span>
					<Column alignX='center'>
						{ FormatTimeInterval(timeLeft, 'two-most-significant') }
					</Column>
					<span>You will be automatically logged out at that point.</span>
				</Column>
				<Row alignX='space-between'>
					<Button onClick={ hide }>Ignore</Button>
					<Button onClick={ () => setShowExtend(true) }>Extend with password</Button>
				</Row>
			</Column>
		</DraggableDialog>
	);
}
