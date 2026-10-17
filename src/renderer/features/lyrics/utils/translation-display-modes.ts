import type { TFunction } from 'i18next';

/** Options for settings.lyrics.translationDisplayMode, shared by both lyrics settings forms. */
export const getTranslationDisplayModeOptions = (t: TFunction) => [
    {
        label: t('setting.translationDisplayMode', { context: 'optionBilingual' }),
        value: 'bilingual',
    },
    {
        label: t('setting.translationDisplayMode', { context: 'optionTranslated' }),
        value: 'translated',
    },
];
