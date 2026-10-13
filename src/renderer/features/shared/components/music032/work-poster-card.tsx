import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { ItemImage } from '/@/renderer/components/item-image/item-image';
import { workTypeLongLabel } from '/@/renderer/features/home/music032/lib/format';
import { useWorksPlayState } from '/@/renderer/features/home/music032/lib/playing-source';
import styles from '/@/renderer/features/shared/components/music032/music032-pages.module.css';
import { PlayingIndicator } from '/@/renderer/features/shared/components/playing-indicator/playing-indicator';
import { useCurrentServerWithCredential } from '/@/renderer/store';
import { Icon } from '/@/shared/components/icon/icon';
import { LibraryItem } from '/@/shared/types/domain-types';

export type WorkPosterCardProps = {
    onPlay: () => void;
    posterPath: string;
    subtitle?: string;
    title: string;
    to: string;
    trackCount: number;
    workId: number;
    workType: string;
    year: number;
};

/** 作品海报卡：作品列表、系列成员共用。整卡跳作品页，右下角播放。 */
export const WorkPosterCard = ({
    onPlay,
    posterPath,
    subtitle,
    title,
    to,
    trackCount,
    workId,
    workType,
    year,
}: WorkPosterCardProps) => {
    const { t } = useTranslation();
    const server = useCurrentServerWithCredential();
    const playState = useWorksPlayState(server?.id, [workId]);

    return (
        <Link className={styles.posterCard} title={title} to={to}>
            <div className={styles.posterArt}>
                <ItemImage
                    containerClassName={styles.imgBox}
                    id={posterPath}
                    itemType={LibraryItem.ALBUM}
                    size={360}
                />
                <span className={styles.posterType}>{workTypeLongLabel(t, workType)}</span>
                {playState && (
                    <span className={styles.posterBadge}>
                        <PlayingIndicator state={playState} />
                    </span>
                )}
                <button
                    aria-label={t('player.play')}
                    className={styles.posterPlay}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onPlay();
                    }}
                    type="button"
                >
                    <Icon icon="mediaPlay" />
                </button>
            </div>
            <span className={styles.posterTitle}>{title}</span>
            {subtitle && <span className={styles.posterSub}>{subtitle}</span>}
            <span className={styles.posterSub}>
                {year > 0 ? `${year} · ` : ''}
                {t('page.works.tracksCount', { count: trackCount })}
            </span>
        </Link>
    );
};
