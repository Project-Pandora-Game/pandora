/* eslint-disable @typescript-eslint/naming-convention */

/**
 * Minimal declaration for File System Access API.
 * as of now this is not part of the current DOM library
 *
 * implementation is based on:
 * @see https://wicg.github.io/file-system-access
 *
 * other options: '@types/wicg-file-system-access' which was not working, also somewhat outdated
 */

/** @see https://wicg.github.io/file-system-access/#dom-window-showdirectorypicker */
declare function showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;

declare type WellKnownDirectory = 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';

declare type StartInDirectory = WellKnownDirectory | FileSystemHandle;

declare interface DirectoryPickerOptions {
	id: string;
	startIn: StartInDirectory;
}

/** extends the base interface from the DOM library */
declare interface FileSystemDirectoryHandle extends FileSystemHandle {
	keys(): AsyncIterableIterator<string>;
	values(): AsyncIterableIterator<FileSystemHandle>;
	entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
	[Symbol.asyncIterator]: FileSystemDirectoryHandle['entries'];
}
