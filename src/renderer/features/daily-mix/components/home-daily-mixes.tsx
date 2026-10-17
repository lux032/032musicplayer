import { useTranslation } from 'react-i18next';

import { DailyMixRow } from '/@/renderer/features/daily-mix/components/daily-mix-parts';
import styles from '/@/renderer/features/daily-mix/components/daily-mix.module.css';
import {
    HomeInlineEmpty,
    HomeSection,
} from '/@/renderer/features/home/music032/components/home-section';
import { M032DailyMix } from '/@/shared/api/music032/music032-types';

/**
 * 今日推荐 on the 032 home (web home.html "s-mixes"): one row per mix, or a
 * "generating" note while today's mixes are being built.
 */
export const HomeDailyMixes = ({
    generating,
    mixes,
}: {
    generating: boolean;
    mixes: M032DailyMix[];
}) => {
    const { t } = useTranslation();

    return (
        <HomeSection title={t('page.dailyMix.title')}>
            {mixes.length > 0 ? (
                <div className={styles.rows}>
                    {mixes.map((mix) => (
                        <DailyMixRow key={mix.id} mix={mix} showOpen />
                    ))}
                </div>
            ) : generating ? (
                <HomeInlineEmpty
                    hint={t('page.dailyMix.generatingHint')}
                    title={t('page.dailyMix.generating')}
                />
            ) : null}
        </HomeSection>
    );
};
