import i18n from './i18n';

export function tx(text: string): string {
  return i18n.t(text, { defaultValue: text });
}
