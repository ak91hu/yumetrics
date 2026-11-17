// Installable web app only. Offline mode is not a goal (recognition needs the network),
// so nothing is cached: every request goes to the network unchanged.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
