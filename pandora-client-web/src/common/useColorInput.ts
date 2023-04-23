import { useState } from 'react';
import { HexColorString } from 'pandora-common';

export function useColorInput(initialValue?: HexColorString) {
	return useState((initialValue ?? '#ffffff').toUpperCase() as HexColorString);
}
