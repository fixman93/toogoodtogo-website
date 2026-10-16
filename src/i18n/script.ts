/**
 * Serbian Latin → Cyrillic transliteration (1:1, digraphs lj/nj/dž included).
 * Tokens that must stay as-is (placeholders, URLs, abbreviations) are protected.
 */
const MAP: Record<string, string> = {
  A: 'А', B: 'Б', V: 'В', G: 'Г', D: 'Д', Đ: 'Ђ', E: 'Е', Ž: 'Ж', Z: 'З', I: 'И', J: 'Ј', K: 'К', L: 'Л', M: 'М', N: 'Н',
  O: 'О', P: 'П', R: 'Р', S: 'С', T: 'Т', Ć: 'Ћ', U: 'У', F: 'Ф', H: 'Х', C: 'Ц', Č: 'Ч', Š: 'Ш',
  a: 'а', b: 'б', v: 'в', g: 'г', d: 'д', đ: 'ђ', e: 'е', ž: 'ж', z: 'з', i: 'и', j: 'ј', k: 'к', l: 'л', m: 'м', n: 'н',
  o: 'о', p: 'п', r: 'р', s: 'с', t: 'т', ć: 'ћ', u: 'у', f: 'ф', h: 'х', c: 'ц', č: 'ч', š: 'ш',
}
const DIGRAPHS: [RegExp, string][] = [
  [/LJ/g, 'Љ'], [/Lj/g, 'Љ'], [/lj/g, 'љ'],
  [/NJ/g, 'Њ'], [/Nj/g, 'Њ'], [/nj/g, 'њ'],
  [/DŽ/g, 'Џ'], [/Dž/g, 'Џ'], [/dž/g, 'џ'],
]
/** Placeholders, URLs, e-mails and abbreviations that stay in Latin. */
const PROTECTED = /(\{\w+\}|https?:\/\/\S+|[\w.+-]+@[\w.-]+|\bQR\b|CO₂e|\bRSD\b|\bGPS\b|\bSMTP\b|\bAPI\b|\bPOS\b|\bZL-[A-Z0-9]+)/g

function convert(chunk: string) {
  let out = chunk
  for (const [rx, cyr] of DIGRAPHS) out = out.replace(rx, cyr)
  return out.replace(/[A-Za-zĐđŽžĆćČčŠš]/g, (ch) => MAP[ch] ?? ch)
}

export function toCyrillic(text: string): string {
  let result = ''
  let last = 0
  for (const match of text.matchAll(PROTECTED)) {
    result += convert(text.slice(last, match.index)) + match[0]
    last = match.index! + match[0].length
  }
  return result + convert(text.slice(last))
}
