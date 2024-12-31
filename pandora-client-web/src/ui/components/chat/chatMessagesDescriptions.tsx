import type { Immutable } from 'immer';
import { AssertNever, type AppearanceAction } from 'pandora-common';
import React, { ReactElement } from 'react';

// TODO
export function DescribeGameLogicAction({ action }: {
	action: Immutable<AppearanceAction>;
}): ReactElement {
	switch (action.type) {
		case 'create':
			return <>[TODO] Create an item</>;
		case 'delete':
			return <>[TODO] Delete an item</>;
		case 'transfer':
			return <>[TODO] Transfer an item</>;
		case 'pose':
			return <>[TODO] Pose a character</>;
		case 'body':
			return <>[TODO] Modify body sizes</>;
		case 'move':
			return <>[TODO] Reorder items</>;
		case 'color':
			return <>[TODO] Change item's color</>;
		case 'customize':
			return <>[TODO] Customize an item</>;
		case 'moduleAction':
			return <>[TODO] Interact with item's module in some way</>;
		case 'restrictionOverrideChange':
			return <>[TODO] Enter or leave safemode/timeout mode</>;
		case 'randomize':
			return <>[TODO] Randomize own appearance</>;
		case 'roomDeviceDeploy':
			return <>[TODO] Deploy or move a room device</>;
		case 'roomDeviceEnter':
			return <>[TODO] Put character into a room device</>;
		case 'roomDeviceLeave':
			return <>[TODO] Remove character from a room device</>;
		case 'actionAttemptInterrupt':
			return <>[TODO] Interrupt someone's attempted action</>;
	}

	AssertNever(action);
}
