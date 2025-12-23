import type { Immutable } from 'immer';
import { type TransformDefinition } from 'pandora-common';
import React, { ReactElement, useCallback, useState } from 'react';
import { useAssetManager } from '../../../assets/assetManager.tsx';
import { useUpdatedUserInput } from '../../../common/useSyncUserInput.ts';
import { ParseTransforms, SerializeTransforms } from '../../parsing.ts';

export function PointTransformationsTextarea({ transforms, setTransforms }: { transforms: Immutable<TransformDefinition[]>; setTransforms?: (newValue: Immutable<TransformDefinition[]>) => void; }): ReactElement | null {
	const assetManager = useAssetManager();
	const [value, setValue] = useUpdatedUserInput(SerializeTransforms(transforms), []);
	const [error, setError] = useState<string | null>(null);

	const onChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setValue(e.target.value);
		try {
			const result = ParseTransforms(e.target.value, assetManager.getAllBones().map((b) => b.name));
			setError(null);
			setTransforms?.(result);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}, [setTransforms, setValue, assetManager]);

	return (
		<>
			<textarea
				spellCheck='false'
				rows={ 6 }
				value={ value }
				onChange={ onChange }
			/>
			{ error != null && <div className='error'>{ error }</div> }
		</>
	);
}
