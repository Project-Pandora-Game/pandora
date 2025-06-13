import { z } from 'zod';

export const DirectoryStatusAnnouncementSchema = z.object({
	type: z.enum(['info', 'warning']),
	title: z.string(),
	content: z.string().nullable(),
});
export type DirectoryStatusAnnouncement = z.infer<typeof DirectoryStatusAnnouncementSchema>;

export type IDirectoryStatus = {
	time: number;
	onlineAccounts: number;
	onlineCharacters: number;
	betaKeyRequired?: true;
	captchaSiteKey?: string;
	announcement?: DirectoryStatusAnnouncement;
};

export function CreateDefaultDirectoryStatus(): IDirectoryStatus {
	return {
		time: Date.now(),
		onlineAccounts: 0,
		onlineCharacters: 0,
	};
}
