import https from 'node:https';
import {blocked} from './errors.mjs';

const relevantApis = [
  'SYNO.API.Auth',
  'SYNO.Core.Share',
  'SYNO.Core.Share.Permission',
  'SYNO.Core.User',
  'SYNO.SynologyDrive.TeamFolders',
  'SYNO.SynologyDrive.Share',
];

function normalizedFingerprint(value) {
  return String(value || '').replaceAll(':', '').toUpperCase();
}

function request(config, parameters, options = {}) {
  const expectedFingerprint = normalizedFingerprint(config.nas.certificate_sha256);
  const body = new URLSearchParams(parameters).toString();
  return new Promise((resolve, reject) => {
    const client = https.request({
      hostname: config.nas.host,
      port: config.nas.https_port,
      path: '/webapi/' + (options.path || 'entry.cgi'),
      method: 'POST',
      // DSM can reuse a TLS session without exposing the peer certificate. Disable caching so pinning is checked.
      agent: new https.Agent({maxCachedSessions: 0}),
      rejectUnauthorized: false,
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'content-length': Buffer.byteLength(body),
        ...(options.synotoken ? {'X-SYNO-TOKEN': options.synotoken} : {}),
        ...(options.sidCookie ? {Cookie: `id=${options.sidCookie}`} : {}),
      },
    }, response => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { raw += chunk; });
      response.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          if (!parsed.success) return reject(new Error(`DSM_API_ERROR_${parsed.error?.code ?? 'UNKNOWN'}`));
          resolve(parsed.data ?? {});
        } catch (error) {
          reject(error);
        }
      });
    });
    client.on('socket', socket => socket.once('secureConnect', () => {
      const actual = normalizedFingerprint(socket.getPeerCertificate()?.fingerprint256);
      if (!expectedFingerprint || actual !== expectedFingerprint) client.destroy(new Error('DSM_CERTIFICATE_MISMATCH'));
    }));
    client.setTimeout(15000, () => client.destroy(new Error('DSM_API_TIMEOUT')));
    client.on('error', reject);
    client.end(body);
  });
}

export async function discoverCatalog(config) {
  const data = await request(config, {
    api: 'SYNO.API.Info', version: '1', method: 'query', query: relevantApis.join(','),
  });
  return Object.fromEntries(relevantApis.filter(name => data[name]).map(name => [name, data[name]]));
}

export async function withSession(config, operation) {
  const account = process.env.SYNOLOGY_ADMIN_USERNAME;
  const passwd = process.env.SYNOLOGY_ADMIN_PASSWORD;
  if (!account || !passwd) blocked('DSM_ADMIN_CREDENTIALS_REQUIRED');
  const login = await request(config, {
    api: 'SYNO.API.Auth', version: '7', method: 'login', account, passwd,
    session: 'AI-Fleas-Synology', format: 'sid', enable_syno_token: 'yes',
  });
  if (!login.sid) blocked('DSM_LOGIN_FAILED');
  const session = {sid: login.sid, synotoken: login.synotoken};
  try {
    return await operation(session);
  } finally {
    try {
      await request(config, {
        api: 'SYNO.API.Auth', version: '7', method: 'logout', session: 'AI-Fleas-Synology', _sid: session.sid,
        ...(session.synotoken ? {SynoToken: session.synotoken} : {}),
      });
    } catch {}
  }
}

export async function call(config, session, catalog, api, method, parameters = {}) {
  const descriptor = catalog[api];
  if (!descriptor) blocked(`DSM_API_UNAVAILABLE_${api}`);
  try {
    if (descriptor.requestFormat === 'JSON') {
      const encoded = Object.fromEntries(Object.entries(parameters)
        .map(([name, value]) => [name, JSON.stringify(value)]));
      return await request(config, {api, version: String(descriptor.maxVersion), method, ...encoded}, {
        path: `${descriptor.path}/${api}`, sidCookie: session.sid, synotoken: session.synotoken,
      });
    }
    return await request(config, {
      api, version: String(descriptor.maxVersion), method, ...parameters, _sid: session.sid,
      ...(session.synotoken ? {SynoToken: session.synotoken} : {}),
    }, {path: descriptor.path, synotoken: session.synotoken});
  } catch (error) {
    blocked(`${api}_${error.message}`);
  }
}

export function rows(data, ...keys) {
  for (const key of keys) if (Array.isArray(data?.[key])) return data[key];
  return [];
}

export function containsName(items, name) {
  return items.some(item => [item.name, item.share_name, item.username, item.account].includes(name));
}
