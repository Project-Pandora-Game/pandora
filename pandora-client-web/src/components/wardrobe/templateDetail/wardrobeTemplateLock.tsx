import type { ReactElement } from 'react';
import { Row } from '../../common/container/container.tsx';
import { ContextHelpButton } from '../../help/contextHelpButton.tsx';

export function WardrobeTemplateLockDataNotice(): ReactElement {
	return (
		<Row alignY='center'>
			<span>Part of the lock's configuration can be saved</span>
			<ContextHelpButton>
				<p>
					Locks remember only limited amount of data and are always saved and spawned in "unlocked" state.
				</p>
				<p>
					In particular only fingerprint list is saved. Any other data, such as password or timer is not saved.
				</p>
			</ContextHelpButton>
		</Row>
	);
}
