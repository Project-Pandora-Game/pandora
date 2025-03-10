import { ComponentType, ReactElement } from 'react';
import { DivContainer, Row } from '../common/container/container.tsx';
import { AuthFormRouter } from './authFormRouter.tsx';
import { LoginTeaser } from './loginTeaser.tsx';

export interface AuthPageProps {
	component: ComponentType<Record<string, never>>;
}

export function AuthPage({ component }: AuthPageProps): ReactElement {
	return (
		<DivContainer align='center' justify='center'>
			<Row alignX='center' alignY='center' wrap padding='large' gap='xxx-large'>
				<LoginTeaser />
				<AuthFormRouter component={ component } />
			</Row>
		</DivContainer>
	);
}
