import { SETTINGS_HASH } from '../../../lib/shareLinks';
import { open } from '../../navigation';

/**
 * R212 (D-1230): `set your place`, wherever it stands, opens the settings page, whose location section is the place
 * group; its Back returns to the page that asked. R215 points it at the place dialog (D-1238).
 */
export function requestPlace(): void {
  open(SETTINGS_HASH);
}
