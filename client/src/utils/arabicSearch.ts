/** Strip tashkeel / tatweel and normalize common Arabic letter variants for search. */
export function normalizeArabicForSearch(text: string): string {
  return text
    .normalize("NFC")
    .replace(
      /[\u064B-\u065F\u0670\u0640\u0610-\u061A\u06D6-\u06ED\u08D3-\u08FF]/g,
      "",
    )
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ى/g, "ي")
    .toLowerCase()
    .trim();
}

export function arabicSearchEquals(a: string, b: string): boolean {
  return normalizeArabicForSearch(a) === normalizeArabicForSearch(b);
}
