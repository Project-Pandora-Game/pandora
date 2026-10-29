import { Suspense, ReactNode } from 'react';

const infinite = { then: () => { /** noop */ } };

function Suspender({ freeze, children }: {
	freeze: boolean;
	children: ReactNode;
}) {
	if (freeze) {
		// eslint-disable-next-line @typescript-eslint/only-throw-error
		throw infinite;
	}
	return <>{ children }</>;
}

export function Freeze({ freeze, children, placeholder = null }: {
	freeze: boolean;
	children: ReactNode;
	placeholder?: ReactNode;
}) {
	return (
		<Suspense fallback={ placeholder }>
			<Suspender freeze={ freeze }>{ children }</Suspender>
		</Suspense>
	);
}
