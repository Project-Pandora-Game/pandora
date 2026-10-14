import arrowRight from '../../../assets/icons/arrow-right.svg';
import body from '../../../assets/icons/body.svg';
import color from '../../../assets/icons/color.svg';
import deviceSvg from '../../../assets/icons/device.svg';
import editIcon from '../../../assets/icons/edit.svg';
import forbid from '../../../assets/icons/forbidden.svg';
import lock from '../../../assets/icons/lock.svg';
import modificationEdit from '../../../assets/icons/modification-edit.svg';
import modificationLock from '../../../assets/icons/modification-lock.svg';
import modificationView from '../../../assets/icons/modification-view.svg';
import movement from '../../../assets/icons/movement.svg';
import onOff from '../../../assets/icons/on-off.svg';
import questionmark from '../../../assets/icons/questionmark.svg';
import settingIcon from '../../../assets/icons/setting.svg';
import star from '../../../assets/icons/star.svg';
import storage from '../../../assets/icons/storage.svg';
import toggle from '../../../assets/icons/toggle.svg';

export function GetPermissionIcon(icon: string): string {
	switch (icon) {
		case 'star':
			return star;
		case 'arrow-right':
			return arrowRight;
		case 'questionmark':
			return questionmark;
		case 'body':
			return body;
		case 'color':
			return color;
		case 'lock':
			return lock;
		case 'text':
			return editIcon;
		case 'on-off':
			return onOff;
		case 'setting':
			return settingIcon;
		case 'storage':
			return storage;
		case 'toggle':
			return toggle;
		case 'device':
			return deviceSvg;
		case 'movement':
			return movement;
		case 'modification-edit':
			return modificationEdit;
		case 'modification-lock':
			return modificationLock;
		case 'modification-view':
			return modificationView;
		default:
			return forbid;
	}
}
