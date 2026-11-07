const incoming = new URL(location.href);
const state = incoming.searchParams.get('state');
const code = incoming.searchParams.get('code');
const error = incoming.searchParams.get('error');
if (/^[a-f0-9]{64}$/.test(state || '') && (code && code.length <= 4096 || error && error.length <= 100)) {
  const destination = new URL('https://http--yumetrics--dmg6gnvmmd7s.code.run/auth/google/callback');
  for (const key of ['state', 'code', 'error']) if (incoming.searchParams.has(key)) destination.searchParams.set(key, incoming.searchParams.get(key));
  history.replaceState(null, '', incoming.pathname);
  location.replace(destination.href);
} else {
  document.getElementById('message').textContent = 'Indítsd a belépést a Yumetrics alkalmazásból. / Start signing in from the Yumetrics app.';
}
