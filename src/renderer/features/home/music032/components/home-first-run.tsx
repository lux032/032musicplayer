import { useTranslation } from 'react-i18next';

import { openMusic032WebPath } from '/@/renderer/features/home/music032/lib/open-music032-web';
import styles from '/@/renderer/features/home/music032/music032-home.module.css';
import { useCurrentServerWithCredential } from '/@/renderer/store';
import { Button } from '/@/shared/components/button/button';

/** 空库时的首次运行引导：跳 032 网页控制台扫描 / 配置数据来源。 */
export const HomeFirstRun = () => {
    const { t } = useTranslation();
    const server = useCurrentServerWithCredential();

    return (
        <section className={styles.firstRun}>
            <div aria-hidden className={styles.firstRunArt}>
                <span />
                <span />
                <span />
            </div>
            <h2>{t('page.home.music032.firstRunTitle')}</h2>
            <p>{t('page.home.music032.firstRunDescription')}</p>
            <div className={styles.heroActions}>
                <Button
                    onClick={() => openMusic032WebPath(server ?? null, '/admin')}
                    variant="filled"
                >
                    {t('page.home.music032.firstRunScan')}
                </Button>
                <Button
                    onClick={() => openMusic032WebPath(server ?? null, '/admin/settings/metadata')}
                    variant="default"
                >
                    {t('page.home.music032.firstRunMetadata')}
                </Button>
            </div>
            <dl className={styles.firstRunFacts}>
                <div>
                    <dt>{t('page.home.music032.firstRunFactsFormatsLabel')}</dt>
                    <dd>{t('page.home.music032.firstRunFactsFormatsValue')}</dd>
                </div>
                <div>
                    <dt>{t('page.home.music032.firstRunFactsLyricsLabel')}</dt>
                    <dd>{t('page.home.music032.firstRunFactsLyricsValue')}</dd>
                </div>
                <div>
                    <dt>{t('page.home.music032.firstRunFactsOnlineLabel')}</dt>
                    <dd>{t('page.home.music032.firstRunFactsOnlineValue')}</dd>
                </div>
            </dl>
        </section>
    );
};
