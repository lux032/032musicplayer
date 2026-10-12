import { useTranslation } from 'react-i18next';

import { openMusic032WebPath } from '/@/renderer/features/home/music032/lib/open-music032-web';
import styles from '/@/renderer/features/home/music032/music032-home.module.css';
import { useCurrentServerWithCredential } from '/@/renderer/store';
import { formatHrDateTime } from '/@/renderer/utils/format';
import { M032HomeResponse } from '/@/shared/api/music032/music032-types';

/** 页脚统计：专辑 / 歌曲 / 作品总数、上次扫描时间、待审核入口（跳 032 网页）。 */
export const HomeStatsFooter = ({ stats }: { stats: M032HomeResponse['stats'] }) => {
    const { t } = useTranslation();
    const server = useCurrentServerWithCredential();

    const statLine = (count: number, key: string) => (
        <span>
            <strong>{count}</strong> {t(key, { count }).replace(new RegExp(`^${count}\\s*`), '')}
        </span>
    );

    return (
        <footer className={styles.footer}>
            {statLine(stats.albums, 'page.home.music032.statsAlbums')}
            {statLine(stats.tracks, 'page.home.music032.statsTracks')}
            {statLine(stats.works, 'page.home.music032.statsWorks')}
            {stats.lastScanAt && (
                <span>
                    {t('page.home.music032.lastScan', {
                        time: formatHrDateTime(stats.lastScanAt),
                    })}
                </span>
            )}
            <button
                className={styles.footerReview}
                onClick={() => openMusic032WebPath(server ?? null, '/admin/work-review')}
                type="button"
            >
                {t('page.home.music032.pendingReview')}
                {stats.pendingReviewCount > 0 && (
                    <span className={styles.footerBadge}>{stats.pendingReviewCount}</span>
                )}
            </button>
        </footer>
    );
};
