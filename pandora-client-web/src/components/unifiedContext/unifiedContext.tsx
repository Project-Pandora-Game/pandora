import React, { ReactElement, useEffect } from 'react';
import { createHtmlPortalNode, InPortal, OutPortal } from 'react-reverse-portal';
import { Observable, useObservable } from '../../observable';
import { ChatroomPorlatIn } from '../chatroom/chatroom';

export const ChatRoomPortal = CreatePortalPair();

export function UnifiedContext(): ReactElement {
	return (
		<ChatRoomPortal.In>
			<ChatroomPorlatIn />
		</ChatRoomPortal.In>
	);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CreatePortalPair<Out extends Component<any> = Component<any>>() {
	const node = createHtmlPortalNode();
	const mounted = new Observable(false);

	// eslint-disable-next-line @typescript-eslint/naming-convention
	function PortalIn({ children }: { children: React.ReactNode }) {
		return <InPortal node={ node }>{children}</InPortal>;
	}

	// eslint-disable-next-line @typescript-eslint/naming-convention
	function PortalOut(props: Partial<ComponentProps<Out>>) {
		useEffect(() => {
			mounted.value = true;
			return () => {
				mounted.value = false;
			};
		}, []);
		return <OutPortal node={ node } { ...props } />;
	}

	function useMounted() {
		return useObservable(mounted);
	}

	// eslint-disable-next-line @typescript-eslint/naming-convention
	return { In: PortalIn, Out: PortalOut, useMounted } as const;
}

type Component<P> = React.Component<P> | React.ComponentType<P>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ComponentProps<C extends Component<any>> = C extends Component<infer P> ? P : never;
