import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { ItemImage } from '/@/renderer/components/item-image/item-image';
import styles from '/@/renderer/features/shared/components/music032/music032-pages.module.css';
import { PlayingIndicator } from '/@/renderer/features/shared/components/playing-indicator/playing-indicator';
import { useAlbumPlayState } from '/@/renderer/features/shared/components/playing-indicator/use-song-play-state';
import { useCurrentServerWithCredential } from '/@/renderer/store';
import { Icon } from '/@/shared/components/icon/icon';
import { LibraryItem } from '/@/shared/types/domain-types';

export type Music032AlbumCardProps = {
    albumId: string;
    artist?: string;
    artworkUrl?: string;
    meta?: string;
    onPlay: () => void;
    roleLabel?: string;
    title: string;
    to: string;
};

/** 032 专辑卡：作品详情关联专辑、系列专辑共用。整卡跳 feishin 专辑页。 */
export const Music032AlbumCard = ({
    albumId,
    artist,
    artworkUrl,
    meta,
    onPlay,
    roleLabel,
    title,
    to,
}: Music032AlbumCardProps) => {
    const { t } = useTranslation();
    const server = useCurrentServerWithCredential();
    const playState = useAlbumPlayState(server?.id, albumId);

    return (
        <Link className={styles.posterCard} title={title} to={to}>
            <div className={styles.posterArt}>
                {artworkUrl ? (
                    <ItemImage
                        containerClassName={styles.imgBox}
                        id={artworkUrl}
                        itemType={LibraryItem.ALBUM}
                        size={360}
                    />
                ) : (
                    <span className={styles.placeholder}>032</span>
                )}
                {roleLabel && <span className={styles.posterType}>{roleLabel}</span>}
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
            {artist && <span className={styles.posterSub}>{artist}</span>}
            {meta && <span className={styles.posterSub}>{meta}</span>}
        </Link>
    );
};
