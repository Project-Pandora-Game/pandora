import type { ReactElement } from 'react';
import { RichTextDescription } from '../../ui/components/richText/richText.tsx';

export function ProfileDescription({ contents }: { contents: string; }): ReactElement {
	return (
		<RichTextDescription content={ contents } />
	);
}
