import { KnownObject, PANDORA_ACCESS_TOKEN_SCOPES, PandoraAccessTokenScopeListAdd, PandoraAccessTokenScopeListRemove, type PandoraAccessTokenScopeList } from 'pandora-common';
import { Fragment, useId, type ReactElement } from 'react';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { Column, Row } from '../../common/container/container.tsx';
import { GridContainer } from '../../common/container/gridContainer.tsx';

export function PATScopes({ selectedScopes, onChange }: {
	selectedScopes: PandoraAccessTokenScopeList;
	onChange: ((newScopes: PandoraAccessTokenScopeList) => void) | null;
}): ReactElement {
	const id = useId();

	return (
		<Column gap='small'>
			<strong>Scopes</strong>
			<GridContainer templateColumns='minmax(max-content, 1fr) 2fr' templateRows='auto-flow' gap='small' alignItemsY='start'>
				{ KnownObject.entries(PANDORA_ACCESS_TOKEN_SCOPES).map(([scope, { description }]) => {
					return (
						<Fragment key={ scope }>
							{ onChange != null ? (
								<Row alignY='center'>
									<Checkbox
										id={ id + ':' + scope }
										checked={ selectedScopes.includes(scope) }
										onChange={ (checked) => {
											if (checked) {
												onChange(PandoraAccessTokenScopeListAdd(selectedScopes, scope));
											} else {
												onChange(PandoraAccessTokenScopeListRemove(selectedScopes, scope));
											}
										} }
									/>
									<label htmlFor={ id + ':' + scope }>{ scope }</label>
								</Row>
							) : (
								<span>{ scope }</span>
							) }
							<div>
								{ description }
							</div>
						</Fragment>
					);
				}) }
			</GridContainer>
		</Column>
	);
}
