export const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://res.cloudinary.com https://*.googleusercontent.com; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
};
export const STATIC_FILES = { '/': ['index.html', 'text/html; charset=utf-8'], '/index.html': ['index.html', 'text/html; charset=utf-8'], '/app.mjs': ['app.mjs', 'text/javascript; charset=utf-8'], '/analysis-ui.mjs': ['analysis-ui.mjs', 'text/javascript; charset=utf-8'], '/domain.mjs': ['../lib/domain.mjs', 'text/javascript; charset=utf-8'], '/food-reference.mjs': ['../lib/food-reference.mjs', 'text/javascript; charset=utf-8'], '/styles.css': ['styles.css', 'text/css; charset=utf-8'], '/favicon.svg': ['favicon.svg', 'image/svg+xml'] };
STATIC_FILES['/cozy.css'] = ['cozy.css', 'text/css; charset=utf-8'];
STATIC_FILES['/account.css'] = ['account.css', 'text/css; charset=utf-8'];
STATIC_FILES['/login.mjs'] = ['login.mjs', 'text/javascript; charset=utf-8'];
STATIC_FILES['/hero-pork-knuckle.webp'] = ['hero-pork-knuckle.webp', 'image/webp'];
STATIC_FILES['/hungarian-food.mjs'] = ['../lib/hungarian-food.mjs', 'text/javascript; charset=utf-8'];
STATIC_FILES['/utmutato'] = ['help.html', 'text/html; charset=utf-8'];
STATIC_FILES['/help.html'] = ['help.html', 'text/html; charset=utf-8'];
STATIC_FILES['/guide'] = ['help.html', 'text/html; charset=utf-8'];
STATIC_FILES['/help-en.html'] = ['help.html', 'text/html; charset=utf-8'];
STATIC_FILES['/localization.mjs'] = ['localization.mjs', 'text/javascript; charset=utf-8'];
STATIC_FILES['/i18n.mjs'] = ['../lib/i18n.mjs', 'text/javascript; charset=utf-8'];
STATIC_FILES['/translations-en.mjs'] = ['../lib/translations-en.mjs', 'text/javascript; charset=utf-8'];

STATIC_FILES['/logo.svg'] = ['logo.svg', 'image/svg+xml'];
STATIC_FILES['/brand-banner.svg'] = ['brand-banner.svg', 'image/svg+xml'];
STATIC_FILES['/profile-ui.mjs'] = ['profile-ui.mjs', 'text/javascript; charset=utf-8'];
STATIC_FILES['/product-label.mjs'] = ['../lib/product-label.mjs', 'text/javascript; charset=utf-8'];
STATIC_FILES['/admin'] = ['admin.html', 'text/html; charset=utf-8'];
STATIC_FILES['/admin.html'] = ['admin.html', 'text/html; charset=utf-8'];
STATIC_FILES['/admin.mjs'] = ['admin.mjs', 'text/javascript; charset=utf-8'];
STATIC_FILES['/admin.css'] = ['admin.css', 'text/css; charset=utf-8'];
for (const id of ['first', 'three', 'seven', 'fourteen', 'thirty', 'hundred']) STATIC_FILES[`/badges/${id}.png`] = [`badges/${id}.png`, 'image/png'];

STATIC_FILES['/admin-charts.mjs'] = ['admin-charts.mjs', 'text/javascript; charset=utf-8'];
