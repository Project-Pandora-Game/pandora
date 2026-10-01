import classNames from 'classnames';
import { ReactElement, useEffect, useRef } from 'react';
import { Column } from '../../../components/common/container/container.tsx';
import { Scrollable } from '../../../components/common/scrollbar/scrollbar.tsx';
import { useChatInput } from './chatInputContext.ts';

export function ChatAutocompleteHint(): ReactElement | null {
	const { autocompleteHint, commandsRunner } = useChatInput();
	const selectedElementRef = useRef<HTMLSpanElement>(null);

	useEffect(() => {
		if (autocompleteHint?.data.index != null && selectedElementRef.current != null) {
			selectedElementRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	}, [autocompleteHint?.data.index]);

	if (!autocompleteHint?.data.result || commandsRunner == null)
		return null;

	// When only one command can/should be displayed, onlyShowOption is set to that command's index in the option array
	let longDescriptionOption: number | null = null;
	if (autocompleteHint.data.index != null) {
		longDescriptionOption = autocompleteHint.data.index;
	} else if (autocompleteHint.data.result.options.length === 1) {
		longDescriptionOption = 0;
	}
	if (longDescriptionOption != null && !autocompleteHint.data.result.options[longDescriptionOption]?.longDescription) {
		longDescriptionOption = null;
	}

	return (
		<div className='autocomplete-hint'>
			{ autocompleteHint.data.result.header }
			{ autocompleteHint.data.result.options.length > 0 ? (
				<>
					<hr />
					<Scrollable className='flex-1'>
						<Column gap='tiny'>
							{
								autocompleteHint.data.result.options.map((option, index) => (
									<span key={ index }
										className={ classNames({ selected: index === autocompleteHint.data.index }) }
										ref={ index === autocompleteHint.data.index ? selectedElementRef : undefined }
										onClick={ (ev) => {
											ev.preventDefault();

											autocompleteHint.selectOption(option, autocompleteHint.commandKey);
										} }
									>
										{ option.displayValue }
									</span>
								))
							}
						</Column>
					</Scrollable>
				</>
			) : null }
			{ longDescriptionOption != null ? (
				<>
					<hr />
					{ autocompleteHint.data.result.options[longDescriptionOption]?.longDescription }
				</>
			) : null }
		</div>
	);
}
