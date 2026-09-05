/**
 * R38: the dev server over HTTPS for the phone. iOS hands out
 * `DeviceOrientationEvent` only on a secure origin, and a LAN address is not
 * one, so the spike is served with a self-signed certificate that `openssl`
 * writes once into `.sdd-cache/` (git-ignored). The phone warns about the
 * certificate once; Safari's "visit this website" continues.
 *
 *   npm run spike:window            # https://<this machine's LAN address>:5173/spike/window/
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { mergeConfig } from 'vite';
import base from '../../vite.config';

const dir = resolve('.sdd-cache/spike-cert');
const key = resolve(dir, 'key.pem');
const cert = resolve(dir, 'cert.pem');

if (!existsSync(key) || !existsSync(cert)) {
  mkdirSync(dir, { recursive: true });
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '30', '-subj', '/CN=wiys-spike'], { stdio: 'ignore' });
}

export default mergeConfig(base, { server: { https: { key, cert }, host: true } });
