import type { SpaceListExtendedInfo, SpaceListInfo, SpaceSearchResultEntry } from 'pandora-common';
import { type ReactElement, useEffect, useMemo } from 'react';
import { ModalDialog } from '../../../components/dialog/dialog.tsx';
import { useCurrentAccount } from '../../../services/accountLogic/accountManagerHooks.ts';
import { SpaceDetails } from './spaceDetails.tsx';
import { useSpaceExtendedInfo } from './useSpaceExtendedInfo.tsx';

export function SpaceDetailsDialog({ baseInfo, hide }: {
	baseInfo: SpaceListInfo | SpaceSearchResultEntry;
	hide: () => void;
}): ReactElement | null {
	const accountId = useCurrentAccount()?.id;
	const extendedInfo = useSpaceExtendedInfo(baseInfo.id);

	const info = useMemo((): SpaceListExtendedInfo => {
		if (extendedInfo?.result === 'success')
			return extendedInfo.data;

		return {
			onlineCharacters: NaN,
			totalCharacters: NaN,
			features: [],
			admin: [],
			isOwner: accountId != null && baseInfo.owners.includes(accountId),
			isAdmin: false,
			isAllowed: false,
			characters: [],
			...baseInfo,
		};
	}, [extendedInfo, baseInfo, accountId]);

	// Close if the space disappears
	useEffect(() => {
		if (extendedInfo?.result === 'notFound') {
			hide();
		}
	}, [extendedInfo, hide]);

	// Do not show anything if the space doesn't exist anymore
	// Do not show anything if we don't have account (aka WTF?)
	if (extendedInfo?.result === 'notFound' || accountId == null)
		return null;

	return (
		<ModalDialog>
			<SpaceDetails info={ info } hasFullInfo={ extendedInfo?.result === 'success' } hide={ hide } />
		</ModalDialog>
	);
}
