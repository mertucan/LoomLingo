/**
 * Makes measurement abbreviations readable for the Turkish voice, which spells
 * them out ("mm" becomes "meme", "cm" becomes "ceme"). Only the spoken text is
 * changed; subtitles keep the short form.
 */
const LETTER = "A-Za-zÇĞİÖŞÜçğıöşüÂâÎîÛû";
const NUMBER = "\\d+(?:[.,]\\d+)?";

/** Read out wherever they stand alone: "5 mm", "5mm", "kaç mm". Longer forms first. */
const ALWAYS: Array<[string, string]> = [
  ["mm", "milimetre"], ["cm", "santimetre"], ["km", "kilometre"], ["mg", "miligram"], ["kg", "kilogram"],
  ["ml", "mililitre"], ["rpm", "devir"], ["kw", "kilovat"], ["hz", "hertz"],
];
/** Too short to be safe on their own ("a", "m"), so read out only right after a number. */
const AFTER_NUMBER: Array<[string, string]> = [
  ["gr", "gram"], ["lt", "litre"], ["sn", "saniye"], ["dk", "dakika"],
  ["m", "metre"], ["g", "gram"], ["l", "litre"], ["v", "volt"], ["w", "vat"], ["a", "amper"],
];

const notLetterAfter = `(?![${LETTER}0-9])`;
const RULES: Array<[RegExp, string]> = [
  // 2x5, 3 × 4: "2 çarpı 5"
  [new RegExp(`(${NUMBER})\\s?[x×]\\s?(?=\\d)`, "gi"), "$1 çarpı "],
  // %30 and 30% are both "yüzde 30"
  [new RegExp(`%\\s?(${NUMBER})`, "g"), "yüzde $1"],
  [new RegExp(`(${NUMBER})\\s?%`, "g"), "yüzde $1"],
  // 90°, 40 °C
  [new RegExp(`(${NUMBER})\\s?°\\s?C?${notLetterAfter}`, "g"), "$1 derece"],
  // 5" (inch)
  [new RegExp(`(${NUMBER})\\s?(?:"|”|″)`, "g"), "$1 inç"],
  // No. 14, no:14 → "numara 14"
  [new RegExp(`(^|[^${LETTER}])no[.:]?\\s?(?=\\d)`, "gi"), "$1numara "],
  ...ALWAYS.map(([unit, word]): [RegExp, string] => [new RegExp(`(^|[^${LETTER}])(\\d*)\\s?${unit}${notLetterAfter}`, "gi"), `$1$2 ${word}`]),
  ...AFTER_NUMBER.map(([unit, word]): [RegExp, string] => [new RegExp(`(\\d)\\s?${unit}${notLetterAfter}`, "gi"), `$1 ${word}`]),
];

export function readMeasurements(text: string): string {
  let out = text;
  for (const [pattern, replacement] of RULES) out = out.replace(pattern, replacement);
  // "milimetre'lik" → "milimetrelik": the voice reads the suffix as part of the word.
  return out.replace(/(milimetre|santimetre|kilometre|metre|miligram|kilogram|gram|mililitre|litre|devir|kilovat|hertz|saniye|dakika|volt|vat|amper|derece|inç)['’]/g, "$1")
    .replace(/\s+/g, " ").trim();
}
