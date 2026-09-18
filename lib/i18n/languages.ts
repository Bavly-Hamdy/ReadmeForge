export interface LanguageOption {
  code: string;
  label: string;
  nativeLabel: string;
  flag: string;
  direction: "ltr" | "rtl";
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "ar", label: "Arabic", nativeLabel: "العربية", flag: "🇸🇦", direction: "rtl" },
  { code: "es", label: "Spanish", nativeLabel: "Español", flag: "🇪🇸", direction: "ltr" },
  { code: "zh-CN", label: "Chinese (Simplified)", nativeLabel: "简体中文", flag: "🇨🇳", direction: "ltr" },
  { code: "fr", label: "French", nativeLabel: "Français", flag: "🇫🇷", direction: "ltr" },
  { code: "de", label: "German", nativeLabel: "Deutsch", flag: "🇩🇪", direction: "ltr" },
  { code: "ja", label: "Japanese", nativeLabel: "日本語", flag: "🇯🇵", direction: "ltr" },
  { code: "ko", label: "Korean", nativeLabel: "한국어", flag: "🇰🇷", direction: "ltr" },
  { code: "pt-BR", label: "Portuguese (Brazil)", nativeLabel: "Português", flag: "🇧🇷", direction: "ltr" },
  { code: "ru", label: "Russian", nativeLabel: "Русский", flag: "🇷🇺", direction: "ltr" },
  { code: "tr", label: "Turkish", nativeLabel: "Türkçe", flag: "🇹🇷", direction: "ltr" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", flag: "🇮🇳", direction: "ltr" },
  { code: "it", label: "Italian", nativeLabel: "Italiano", flag: "🇮🇹", direction: "ltr" },
];

export function getLanguageByCode(code: string): LanguageOption | undefined {
  return SUPPORTED_LANGUAGES.find((lang) => lang.code.toLowerCase() === code.toLowerCase());
}
