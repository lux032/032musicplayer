import isElectron from 'is-electron';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { languages } from '/@/i18n/i18n';
import { getTranslationDisplayModeOptions } from '/@/renderer/features/lyrics/utils/translation-display-modes';
import {
    SettingOption,
    SettingsSection,
} from '/@/renderer/features/settings/components/settings-section';
import { useMusic032LyricsTranslationSupported } from '/@/renderer/features/shared/hooks/use-music032-capabilities';
import { useLyricsSettings, useSettingsStoreActions } from '/@/renderer/store';
import { NumberInput } from '/@/shared/components/number-input/number-input';
import { Select } from '/@/shared/components/select/select';
import { Switch } from '/@/shared/components/switch/switch';

export const LyricSettings = memo(() => {
    const { t } = useTranslation();
    const settings = useLyricsSettings();
    const { setSettings } = useSettingsStoreActions();
    const isTranslationSupported = useMusic032LyricsTranslationSupported();

    const updateSetting = (updates: Partial<typeof settings>) => {
        setSettings({
            lyrics: {
                ...settings,
                ...updates,
            },
        });
    };

    const lyricOptions: SettingOption[] = [
        {
            control: (
                <Switch
                    aria-label="Follow lyrics"
                    defaultChecked={settings.follow}
                    onChange={(e) => updateSetting({ follow: e.currentTarget.checked })}
                />
            ),
            description: t('setting.followLyric', {
                context: 'description',
            }),
            title: t('setting.followLyric'),
        },
        {
            control: (
                <Switch
                    aria-label="Enable furigana generation"
                    defaultChecked={settings.enableFurigana}
                    onChange={(e) => updateSetting({ enableFurigana: e.currentTarget.checked })}
                />
            ),
            description: t('setting.enableFurigana', {
                context: 'description',
            }),
            title: t('setting.enableFurigana'),
        },
        {
            control: (
                <Switch
                    aria-label="Enable romaji generation"
                    defaultChecked={settings.enableRomaji}
                    onChange={(e) => updateSetting({ enableRomaji: e.currentTarget.checked })}
                />
            ),
            description: t('setting.enableRomaji', {
                context: 'description',
            }),
            title: t('setting.enableRomaji'),
        },
        {
            control: (
                <NumberInput
                    defaultValue={settings.delayMs}
                    onBlur={(e) => {
                        const value = Number(e.currentTarget.value);
                        updateSetting({ delayMs: value });
                    }}
                    step={10}
                    width={100}
                />
            ),
            description: t('setting.lyricOffset', {
                context: 'description',
            }),
            isHidden: !isElectron(),
            title: t('setting.lyricOffset'),
        },
        {
            control: (
                <Switch
                    aria-label="Enable auto translation"
                    checked={isTranslationSupported && settings.enableAutoTranslation}
                    disabled={!isTranslationSupported}
                    onChange={(e) =>
                        updateSetting({ enableAutoTranslation: e.currentTarget.checked })
                    }
                />
            ),
            description:
                t('setting.enableAutoTranslation', {
                    context: 'description',
                }) +
                (isTranslationSupported ? '' : ` ${t('setting.lyricsTranslationServerRequired')}`),
            title: t('setting.enableAutoTranslation'),
        },
        {
            control: (
                <Select
                    data={languages}
                    onChange={(value) => {
                        updateSetting({ translationTargetLanguage: value });
                    }}
                    value={settings.translationTargetLanguage}
                />
            ),
            description: t('setting.translationTargetLanguage', {
                context: 'description',
            }),
            title: t('setting.translationTargetLanguage'),
        },
        {
            control: (
                <Select
                    allowDeselect={false}
                    data={getTranslationDisplayModeOptions(t)}
                    onChange={(value) => {
                        if (value === 'bilingual' || value === 'translated') {
                            updateSetting({ translationDisplayMode: value });
                        }
                    }}
                    value={settings.translationDisplayMode ?? 'bilingual'}
                />
            ),
            description: t('setting.translationDisplayMode', {
                context: 'description',
            }),
            title: t('setting.translationDisplayMode'),
        },
    ];

    return <SettingsSection options={lyricOptions} title={t('page.setting.lyrics')} />;
});
