import { produce } from 'immer';
import { noop } from 'lodash-es';
import { createContext, ReactElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ChildrenProps } from '../../common/reactTypes.ts';
import { useCurrentAccount } from '../../services/accountLogic/accountManagerHooks.ts';

export interface AuthFormDataState {
	username?: string;
	password?: string;
	justRegistered?: boolean;
}

export interface AuthFormData {
	state: AuthFormDataState;
	setState: (data: Partial<AuthFormDataState>) => void;
}

export const authFormDataContext = createContext<AuthFormData>({
	state: {},
	setState: noop,
});

export function useAuthFormData(): AuthFormData {
	return useContext(authFormDataContext);
}

export function AuthFormDataProvider({ children }: ChildrenProps): ReactElement {
	const loggedIn = useCurrentAccount() != null;
	const [state, setStateInternal] = useState<AuthFormDataState>({});

	useEffect(() => {
		if (loggedIn) {
			setStateInternal({});
		}
	}, [loggedIn]);

	const setState = useCallback((newState: Partial<AuthFormDataState>) => {
		const finalState = produce(state, (draft) => {
			Object.assign(draft, newState);
		});
		setStateInternal(finalState);
	}, [state]);

	const data = useMemo(() => ({ state, setState }), [state, setState]);

	return (
		<authFormDataContext.Provider value={ data }>
			{ children }
		</authFormDataContext.Provider>
	);
}
