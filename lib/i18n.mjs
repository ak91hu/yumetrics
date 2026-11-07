import { ENGLISH } from './translations-en.mjs';

export const languageCode = value => value === 'en' ? 'en' : 'hu';
export const localeFor = language => languageCode(language) === 'en' ? 'en-GB' : 'hu-HU';
const escapePattern = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const systemLabels = ['Energia', 'Fehérje', 'Szénhidrát', 'Zsír', 'Rost', 'Cukor', 'Nátrium', 'Telített zsírsavak', 'Az egész étel tömege', 'A csont és más nem ehető rész tömege', 'A tányér átmérője'];
const patterns = Object.entries(ENGLISH).filter(([key]) => /\{\d+\}/.test(key)).sort(([a], [b]) => b.replace(/\{\d+\}/g, '').length - a.replace(/\{\d+\}/g, '').length).map(([key, value]) => {
  const slots = [...key.matchAll(/\{(\d+)\}/g)].map(match => Number(match[1]));
  return { key, expression: new RegExp('^' + key.split(/\{\d+\}/).map(escapePattern).join('([\\s\\S]*?)') + '$'), slots, value, reverse: new RegExp('^' + value.split(/\{\d+\}/).map(escapePattern).join('([\\s\\S]*?)') + '$'), reverseSlots: [...value.matchAll(/\{(\d+)\}/g)].map(match => Number(match[1])) };
});
export function translate(source, language = 'hu') {
  source = String(source ?? '');
  if (languageCode(language) === 'hu') return source;
  const text = source.trim();
  let result = Object.hasOwn(ENGLISH, text) ? ENGLISH[text] : undefined;
  if (!Object.hasOwn(ENGLISH, text)) {
    for (const pattern of patterns) {
      const match = pattern.expression.exec(text);
      if (match) {
        const values = new Map(pattern.slots.map((slot, index) => [slot, match[index + 1]]));
        result = pattern.value.replace(/\{(\d+)\}/g, (_, slot) => values.get(Number(slot)) ?? '');
        break;
      }
    }
  }
  return result == null ? source : source.slice(0, source.length - source.trimStart().length) + result + source.slice(source.trimEnd().length);
}
export function messageSource(source) {
  source = String(source ?? '');
  const text = source.trim();
  if (Object.hasOwn(ENGLISH, text)) return source;
  const exact = Object.entries(ENGLISH).find(([, value]) => value === text);
  if (exact) return exact[0];
  for (const pattern of patterns) {
    const match = pattern.reverse.exec(text);
    if (match) {
      const values = new Map(pattern.reverseSlots.map((slot, index) => [slot, match[index + 1]]));
      if (pattern.key.startsWith('{0}:') && pattern.key.endsWith('értéket adj meg.')) {
        const label = systemLabels.find(label => translate(label, 'en') === values.get(0));
        if (label) values.set(0, label);
      }
      return pattern.key.replace(/\{(\d+)\}/g, (_, slot) => values.get(Number(slot)) ?? '');
    }
  }
  return source;
}
export function formatMessage(strings, values, language) {
  const key = strings.reduce((text, part, index) => text + (index ? `{${index - 1}}` : '') + part, '');
  return translate(key, language).replace(/\{(\d+)\}/g, (_, index) => String(values[Number(index)] ?? ''));
}
const escapeAttribute = value => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
export function translateMarkup(markup, language) {
  return markup.split(/(<[^>]+>)/g).map(part => part.startsWith('<')
    ? part.replace(/\b(aria-label|placeholder|alt|title)="([^"]*)"/g, (attribute, name, value) => { const translated = translate(value, language); return translated === value ? attribute : `${name}="${escapeAttribute(translated)}"`; })
    : translate(part, language)).join('');
}
export function requestLanguage(request) {
  const cookie = request.headers.get('cookie')?.match(/(?:^|;\s*)yumetrics_language=(hu|en)(?:;|$)/)?.[1];
  const requested = request.headers.get('accept-language')?.split(',')[0].split('-')[0];
  return languageCode(cookie || requested);
}
export function translateSystemMessage(source, language) {
  let result = translate(source, language);
  if (languageCode(language) === 'en') for (const label of systemLabels) {
    if (result.startsWith(label + ':')) result = translate(label, language) + result.slice(label.length);
  }
  return result;
}
export function guideMarkup(source, language, standalone = false) {
  let result = translateMarkup(source, language).replace('lang="hu"', `lang="${languageCode(language)}"`);
  if (standalone) result = result.replaceAll('href="/utmutato"', 'href="./index.html"').replaceAll('href="/guide"', 'href="./english.html"');
  return result;
}
