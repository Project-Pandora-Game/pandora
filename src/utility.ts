/** Sleep for certain amount of milliseconds */
export function Sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
