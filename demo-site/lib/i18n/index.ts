import { FALLBACK_LOCALE, type Locale } from "./config";
import zh from "./dictionaries/zh";
import en from "./dictionaries/en";
import ja from "./dictionaries/ja";
import ko from "./dictionaries/ko";
import es from "./dictionaries/es";
import fr from "./dictionaries/fr";
import de from "./dictionaries/de";
import pt from "./dictionaries/pt";
import ru from "./dictionaries/ru";
import tw from "./dictionaries/tw";
import type { Dictionary } from "./dictionaries/zh";

const dictionaries: Record<Locale, Dictionary> = {
  zh,
  en,
  ja,
  ko,
  es,
  fr,
  de,
  pt,
  ru,
  tw,
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[FALLBACK_LOCALE] ?? dictionaries.zh;
}
