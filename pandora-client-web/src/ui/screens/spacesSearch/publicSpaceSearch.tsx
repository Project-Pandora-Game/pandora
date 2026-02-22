import classNames from 'classnames';
import { Immutable } from 'immer';
import { GetLogger, LIMIT_SPACE_SEARCH_COUNT, SPACE_ACTIVITY_SCORE_THRESHOLD, SpaceSearchArgumentsSchema, SpaceSearchSortSchema, ZodMatcher, type SpaceSearchArguments, type SpaceSearchResult, type SpaceSearchResultEntry, type SpaceSearchSort } from 'pandora-common';
import { useMemo, useState, type ReactElement, type ReactNode } from 'react';
import * as z from 'zod';
import { useAsyncEvent } from '../../../common/useEvent.ts';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { Button } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { GridContainer } from '../../../components/common/container/gridContainer.tsx';
import { useDirectoryConnector } from '../../../components/gameContext/directoryConnectorContextProvider.tsx';
import { ContextHelpButton } from '../../../components/help/contextHelpButton.tsx';
import { SelectSettingInput, useStateSettingDriver, useValueMapDriver } from '../../../components/settings/helpers/settingsInputs.tsx';
import { useNavigatePandora } from '../../../routing/navigate.ts';
import { useIsNarrowScreen } from '../../../styles/mediaQueries.ts';
import { SpaceDetailsDialog } from './spaceSearchSpaceDetails.tsx';
import { SPACE_SEARCH_PUBLIC_ICONS, SPACE_SEARCH_PUBLIC_LABELS } from './spacesSearch.tsx';

const IsValidSpaceSearchName = ZodMatcher(SpaceSearchArgumentsSchema.shape.nameFilter.unwrap());

const SPACE_SEARCH_SORT_NAME: Record<SpaceSearchSort, string> = {
	'activity': 'By recent activity',
	'a-z': 'By name (A->Z)',
	'z-a': 'By name (Z->A)',
};

const SPACE_SEARCH_COUNT_OPTIONS: number[] = [];
generateSpaceSearchCountOptions: for (let i = 10; ; i *= 10) {
	for (const j of [1, 2, 5]) {
		const v = i * j;
		if (v > LIMIT_SPACE_SEARCH_COUNT)
			break generateSpaceSearchCountOptions;

		SPACE_SEARCH_COUNT_OPTIONS.push(v);
	}
}

export function PublicSpaceSearch(): ReactElement {
	const directoryConnector = useDirectoryConnector();
	const navigate = useNavigatePandora();
	const isNarrowScreen = useIsNarrowScreen();

	const [spaceNameFilter, setSpaceNameFilter] = useState('');
	const [sort, sortDriver] = useStateSettingDriver<SpaceSearchSort>('activity');
	const [limit, limitDriver] = useStateSettingDriver<number>(10);

	const spaceNameFilterValid = !spaceNameFilter.trim() || IsValidSpaceSearchName(spaceNameFilter.trim());

	const query = useMemo((): SpaceSearchArguments => ({
		nameFilter: spaceNameFilter.trim() || undefined,
		sort,
	}), [spaceNameFilter, sort]);

	const [searchResult, setSearchResult] = useState<Readonly<{
		originalQuery: Immutable<SpaceSearchArguments>;
		limit: number;
		page: number;
		result: [true, SpaceSearchResult] | [false, ReactNode];
	}> | null>(null);

	const [search, processing] = useAsyncEvent(async (queryArgs: SpaceSearchArguments, queryLimit: number, page: number): Promise<typeof searchResult> => {
		const result = await directoryConnector.awaitResponse('spaceSearch', {
			args: queryArgs,
			limit: queryLimit,
			skip: page > 0 ? (page * queryLimit) : undefined,
		});

		return {
			originalQuery: queryArgs,
			limit: queryLimit,
			page,
			result: [true, result.result],
		};
	}, (value: typeof searchResult) => {
		setSearchResult(value);
	}, {
		errorHandler(error) {
			GetLogger('PublicSpaceSearch').error('Error during search:', error);
			setSearchResult({
				originalQuery: query,
				limit,
				page: 0,
				result: [false, 'Search failed.'],
			});
		},
	});

	return (
		<Column padding='medium'>
			<GridContainer padding='medium' templateColumns='minmax(max-content, 1fr) auto minmax(max-content, 1fr)' alignItemsX='center' alignItemsY='center'>
				<Button
					className='justify-self-start'
					onClick={ () => {
						navigate('/spaces/search');
					} }
				>
					◄ Back
				</Button>
				<h2>
					Public space search
					<ContextHelpButton>
						<p>
							This view lets you search for a specific public space or explore unlisted public spaces,<br />
							even if there are no online characters inside.
						</p>
						<p>
							Note that you can only find unlisted spaces with the visibility setting "Public", but not spaces<br />
							with the visibility "Public while an admin is inside".
						</p>
					</ContextHelpButton>
				</h2>
			</GridContainer>
			<fieldset>
				<legend>Search settings</legend>
				<form onSubmit={ (ev) => {
					ev.preventDefault();
					search(query, limit, 0);
				} }>
					<Column padding='small'>
						<Column gap='small'>
							<label>Space name filter</label>
							<TextInput
								autoComplete='none'
								value={ spaceNameFilter }
								onChange={ setSpaceNameFilter }
								disabled={ processing }
							/>
							{ !spaceNameFilterValid ? (<div className='error-box'>Invalid name</div>) : null }
						</Column>
						<SelectSettingInput
							driver={ sortDriver }
							label='Sort results'
							stringify={ SPACE_SEARCH_SORT_NAME }
							schema={ SpaceSearchSortSchema }
							disabled={ processing }
						/>
						<SelectSettingInput
							driver={ useValueMapDriver(limitDriver, (v) => v.toString(10), (v) => Number.parseInt(v, 10)) }
							label='Results per page'
							stringify={ useMemo(() => Object.fromEntries(SPACE_SEARCH_COUNT_OPTIONS.map((v) => [v.toString(10), v.toString(10)])), []) }
							optionOrder={ useMemo(() => SPACE_SEARCH_COUNT_OPTIONS.map((v) => v.toString(10)), []) }
							schema={ useMemo(() => z.enum(SPACE_SEARCH_COUNT_OPTIONS.map((v) => v.toString(10))), []) }
							disabled={ processing }
						/>
						<Row>
							<Button
								type='submit'
								disabled={ processing || !spaceNameFilterValid }
							>
								Search
							</Button>
						</Row>
					</Column>
				</form>
			</fieldset>
			{ (searchResult == null || searchResult.originalQuery !== query || searchResult.limit !== limit) ? (
				null
			) : (!searchResult.result[0]) ? (
				<Column padding='medium' className='error-box'>{ searchResult.result[1] }</Column>
			) : (searchResult.result[1].length > 0 || searchResult.page > 0) ? (
				<>
					<Row alignX='center' alignY='center'>
						{ searchResult.page > 0 ? (
							<Button
								theme='transparent'
								onClick={ () => {
									search(query, limit, searchResult.page - 1);
								} }
								disabled={ processing }
							>
								«
							</Button>
						) : null }
						{ searchResult.page > 3 ? (
							<>
								<Button
									theme='transparent'
									onClick={ () => {
										search(query, limit, 0);
									} }
									disabled={ processing }
								>
									1
								</Button>
								<span>…</span>
							</>
						) : null }
						{ [-3, -2, -1, 0, 1]
							.map((v) => searchResult.page + v)
							.filter((p) => p >= 0 && (p <= searchResult.page || searchResult.result[0] && searchResult.result[1].length === searchResult.limit))
							.map((p) => (
								<Button
									key={ p }
									theme={ p === searchResult.page ? 'defaultActive' : 'transparent' }
									onClick={ () => {
										search(query, limit, p);
									} }
									disabled={ processing }
								>
									{ p + 1 }
								</Button>
							)) }
						{ (searchResult.result[1].length === searchResult.limit) ? (
							<Button
								theme='transparent'
								onClick={ () => {
									search(query, limit, searchResult.page + 1);
								} }
								disabled={ processing }
							>
								»
							</Button>
						) : null }
					</Row>
					{ searchResult.result[1].length === 0 ? (
						<div>No more spaces found</div>
					) : null }
					<Column className={ classNames('spacesSearchList', isNarrowScreen ? 'narrowScreen' : null) }>
						{ searchResult.result[1].map((space) => (
							<PublicSpaceSearchEntry key={ space.id } info={ space } sortedByActivity={ searchResult.originalQuery.sort === 'activity' } />
						)) }
					</Column>
				</>
			) : (
				<div>No Space found</div>
			) }
		</Column>
	);
}

function PublicSpaceSearchEntry({ info, sortedByActivity }: {
	info: SpaceSearchResultEntry;
	sortedByActivity: boolean;
}): ReactElement {

	const [show, setShow] = useState(false);

	const {
		name,
		maxUsers,
		description,
	} = info;

	return (
		<>
			<button
				className={ classNames(
					'spacesSearchListEntry',
					show ? 'selected' : null,
					(sortedByActivity && info.activityScore < SPACE_ACTIVITY_SCORE_THRESHOLD) ? 'empty' : null,
				) }
				onClick={ () => setShow(true) }
			>
				<div className='icon'>
					<img
						src={ SPACE_SEARCH_PUBLIC_ICONS[info.public] }
						title={ SPACE_SEARCH_PUBLIC_LABELS[info.public] }
						alt={ SPACE_SEARCH_PUBLIC_LABELS[info.public] } />
				</div>
				<div className='icons-extra'>
				</div>
				<div className='entry'>
					<span className='name'>{ name }</span>
					<span className='userCountWrapper'>
						(
						<span className='userCount'>
							limit: { maxUsers }
						</span>
						)
					</span>
				</div>
				<div className='description-preview'>{ `${description}` }</div>
			</button>
			{ show && <SpaceDetailsDialog
				baseInfo={ info }
				hide={ () => setShow(false) }
			/> }
		</>
	);
}

