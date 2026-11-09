import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { isIP } from 'node:net';
import { Reader } from 'mmdb-lib';

const countries = new Reader(gunzipSync(readFileSync(new URL('./geoip/country.mmdb.gz', import.meta.url))));

export function requestCountry(request, remoteAddress, trustNorthflank = false) {
  // Northflank replaces this header at public ingress; client-supplied X-Forwarded-For is not trusted.
  let address = trustNorthflank ? request.headers.get('x-envoy-external-address') || remoteAddress : remoteAddress;
  address = address?.trim().replace(/^::ffff:/i, '');
  return isIP(address || '') ? countries.get(address)?.country?.iso_code ?? null : null;
}
