/** Promisifies an IndexedDB request */
export function IndexedDbRequestToPromise<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => {
			resolve(request.result);
		};
		request.onerror = () => {
			reject(new Error('Request failed', { cause: request.error }));
		};
	});
}
