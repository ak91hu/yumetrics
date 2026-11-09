import { translate, translateMarkup, formatMessage, languageCode, localeFor } from '/i18n.mjs';
export { messageSource } from '/i18n.mjs';

const requested = new URL(location.href).searchParams.get('lang');
const preferredLanguage = languageCode((['hu', 'en'].includes(requested) ? requested : null) || document.cookie.match(/(?:^|;\s*)yumetrics_language=(hu|en)(?:;|$)/)?.[1] || document.documentElement.dataset.defaultLanguage || 'en');
let language = 'hu';
export const getLanguage = () => language;
export const locale = () => localeFor(language);
export const t = (source, ...values) => Array.isArray(source) ? formatMessage(source, values, language) : translate(source, language);
export function html(strings, ...values) {
  if (typeof strings === 'string') return translateMarkup(strings, language);
  const markup = strings.reduce((text, part, index) => text + (index ? `\uFFF0${index - 1}\uFFF1` : '') + part, '');
  return translateMarkup(markup, language).replace(/\uFFF0(\d+)\uFFF1/g, (_, index) => String(values[Number(index)] ?? ''));
}
const staticNodes = [], attributes = [];
export function initializeLanguage() {
  const control = document.querySelector('.language-control');
  for (const heading of document.querySelectorAll('dialog .modal-heading')) if (control) {
    const copy = control.cloneNode(true); copy.classList.add('dialog-language'); heading.after(copy);
  }
  for (const option of document.querySelectorAll('option:not([value])')) option.value = option.value;
  const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.textContent.trim() && !node.parentElement.closest('script,style,[data-language-switch]')) staticNodes.push([node, node.textContent]);
  }
  for (const element of document.querySelectorAll('[aria-label],[placeholder],[alt],[title],meta[name="description"]')) {
    for (const name of ['aria-label', 'placeholder', 'alt', 'title', 'content']) if (element.hasAttribute(name)) attributes.push([element, name, element.getAttribute(name)]);
  }
  for (const select of document.querySelectorAll('[data-language-switch]')) select.addEventListener('change', () => {
    window.dispatchEvent(new Event('languagechanging'));
    language = languageCode(select.value); applyLanguage();
    window.dispatchEvent(new Event('languagechange'));
  });
  language = preferredLanguage; applyLanguage();
  document.documentElement.dataset.languageReady = 'true';
}
function applyLanguage() {
  document.documentElement.lang = language;
  const url = new URL(location.href); url.searchParams.delete('lang'); history.replaceState(null, '', url);
  document.cookie = `yumetrics_language=${language}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  for (const [node, source] of staticNodes) if (node.isConnected) node.textContent = t(source);
  for (const [element, name, source] of attributes) if (element.isConnected) element.setAttribute(name, t(source));
  for (const select of document.querySelectorAll('[data-language-switch]')) select.value = language;
  for (const link of document.querySelectorAll('a[href="/utmutato"],a[href="/guide"]')) link.href = language === 'en' ? '/guide' : '/utmutato';
}
