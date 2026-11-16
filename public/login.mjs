import { t, initializeLanguage } from '/localization.mjs';
const message = document.querySelector('#login-message'), button = document.querySelector('#google-signin');
const mobileHeader = document.querySelector('.login-header'), desktopAction = document.querySelector('#login-desktop-action');
const mobileLayout = window.matchMedia('(max-width:650px)');
function placeSignIn() { (mobileLayout.matches ? mobileHeader : desktopAction).append(button); }
placeSignIn();
mobileLayout.addEventListener('change', placeSignIn);
initializeLanguage();
function showMessage(source) { message.dataset.message = source; message.textContent = t(source); }
window.addEventListener('languagechange', () => { if (message.dataset.message) message.textContent = t(message.dataset.message); });
if (new URL(location.href).searchParams.get('login') === 'failed') { message.hidden = false; showMessage('A bejelentkezés megszakadt vagy lejárt. Jelentkezz be újra a Google-fiókoddal.'); }
try {
  const response = await fetch('/api/auth-status', { cache: 'no-store' }), status = await response.json();
  if (!status.configured) { button.removeAttribute('href'); button.setAttribute('aria-disabled', 'true'); message.hidden = false; showMessage('A bejelentkezés még nincs beállítva. A szükséges hozzáférési adatokat az alkalmazás üzemeltetője tudja megadni.'); }
} catch { message.hidden = false; showMessage('A szerver most nem érhető el. Próbáld újra később.'); }
