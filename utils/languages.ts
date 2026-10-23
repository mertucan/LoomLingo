const NAMES: Record<string, string> = {
  tr: "Türkçe", en: "İngilizce", hi: "Hintçe", bn: "Bengalce", ur: "Urduca", ta: "Tamilce", te: "Telugu dili",
  mr: "Marathi dili", gu: "Gujarati dili", pa: "Pencapça", kn: "Kannada dili", ml: "Malayalam dili", ne: "Nepalce",
  zh: "Çince", ja: "Japonca", ko: "Korece", vi: "Vietnamca", id: "Endonezce", th: "Tayca", ar: "Arapça", fa: "Farsça",
  ru: "Rusça", uk: "Ukraynaca", de: "Almanca", fr: "Fransızca", es: "İspanyolca", pt: "Portekizce", it: "İtalyanca",
  pl: "Lehçe", nl: "Felemenkçe", ro: "Rumence", el: "Yunanca", bg: "Bulgarca", uz: "Özbekçe", az: "Azerice",
};

/** Turkish display name for a caption language code such as "hi" or "pt-BR". */
export function languageName(code: string): string | null {
  return NAMES[code.toLowerCase().split(/[-_]/)[0] ?? ""] ?? null;
}

export function isTurkish(code: string): boolean { return code.toLowerCase().split(/[-_]/)[0] === "tr"; }
