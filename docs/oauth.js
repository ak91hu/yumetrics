const incoming = new URL(location.href);
const state = incoming.searchParams.get('state');
const backupState = /^backup\.([a-f0-9]{64})$/.exec(state || '');
const appState = backupState ? backupState[1] : state;
const code = incoming.searchParams.get('code');
const error = incoming.searchParams.get('error');
if (/^[a-f0-9]{64}$/.test(appState || '') && (code && code.length <= 4096 || error && error.length <= 100)) {
  const destination = new URL(backupState ? 'https://yumetrics-backup.ak91hu.workers.dev/auth/google/callback' : 'https://http--yumetrics--dmg6gnvmmd7s.code.run/auth/google/callback');
  for (const key of ['state', 'code', 'error']) if (incoming.searchParams.has(key)) destination.searchParams.set(key, incoming.searchParams.get(key));
  destination.searchParams.set('state', appState);
  history.replaceState(null, '', incoming.pathname);
  location.replace(destination.href);
} else {
  document.getElementById('message').textContent = 'Indítsd a belépést a Yumetrics alkalmazásból. / Start signing in from the Yumetrics app.';
}
