const KANA_REGEX = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const HAN_REGEX = /\p{Script=Han}/u;

// Best-effort CJK language tag so Han text without kana gets Chinese glyphs
// instead of the bundled Noto Sans JP.
export const detectCjkLang = (text?: null | string): 'ja' | 'zh' | undefined => {
    if (!text) return undefined;
    if (KANA_REGEX.test(text)) return 'ja';
    if (HAN_REGEX.test(text)) return 'zh';
    return undefined;
};
