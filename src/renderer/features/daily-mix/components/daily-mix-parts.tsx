import clsx from 'clsx';
import { TFunction } from 'i18next';
import { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { generatePath, Link } from 'react-router';

import { ItemImage } from '/@/renderer/components/item-image/item-image';
import styles from '/@/renderer/features/daily-mix/components/daily-mix.module.css';
import { useDailyMixPlay } from '/@/renderer/features/daily-mix/lib/use-daily-mix-play';
import { PlayingIndicator } from '/@/renderer/features/shared/components/playing-indicator/playing-indicator';
import { SongPlayState } from '/@/renderer/features/shared/components/playing-indicator/song-play-state';
import { AppRoute } from '/@/renderer/router/routes';
import { useCurrentServerWithCredential, usePlayerSong, usePlayerStatus } from '/@/renderer/store';
import { M032DailyMix } from '/@/shared/api/music032/music032-types';
import { Icon } from '/@/shared/components/icon/icon';
import { LibraryItem } from '/@/shared/types/domain-types';
import { PlayerStatus } from '/@/shared/types/types';

export const dailyMixPath = (id: number) =>
    generatePath(AppRoute.DAILY_MIX_DETAIL, { mixId: String(id) });

/** "1 小时 22 分" / "48 分钟", like the web's formatMixDuration. */
export const formatMixDuration = (t: TFunction, durationMillis: number) => {
    const totalMinutes = Math.floor(Math.max(0, durationMillis) / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0
        ? t('page.dailyMix.durationHours', { hours, minutes })
        : t('page.dailyMix.durationMinutes', { minutes });
};

/** Mood · style (or the theme type) · N 首 · duration (web mixSubtitle). */
export const mixSubtitle = (t: TFunction, mix: M032DailyMix) => {
    const parts = mix.tags.map((tag) => tag.label);
    if (parts.length === 0 && mix.themeTypeLabel) parts.push(mix.themeTypeLabel);
    parts.push(t('page.dailyMix.trackCount', { count: mix.trackCount }));
    parts.push(formatMixDuration(t, mix.durationMillis));
    return parts.join(' · ');
};

/** Play state of a mix: the current song was queued from this mix. */
export const useMixPlayState = (mixId: number): SongPlayState => {
    const server = useCurrentServerWithCredential();
    const current = usePlayerSong();
    const playing = usePlayerStatus() === PlayerStatus.PLAYING;
    if (!current || !server || current._serverId !== server.id) return null;
    if (current._dailyMixContext?.id !== mixId) return null;
    return playing ? 'playing' : 'paused';
};

/** 2×2 cover mosaic of the mix's first albums; one cover fills the tile when fewer than four. */
export const DailyMixCovers = ({
    className,
    size = 128,
    urls,
}: {
    className?: string;
    size?: number;
    urls: string[];
}) => {
    if (urls.length === 0) {
        return (
            <span className={clsx(styles.covers, styles.single, className)}>
                <span className={styles.coverPlaceholder}>
                    <Icon icon="playlist" />
                </span>
            </span>
        );
    }
    const shown = urls.length >= 4 ? urls.slice(0, 4) : urls.slice(0, 1);
    return (
        <span className={clsx(styles.covers, shown.length === 1 && styles.single, className)}>
            {shown.map((url) => (
                <ItemImage
                    containerClassName={styles.coverBox}
                    id={url}
                    itemType={LibraryItem.ALBUM}
                    key={url}
                    size={size}
                />
            ))}
        </span>
    );
};

/** One mix as a list row: mosaic play button, title linking to the mix, subtitle. */
export const DailyMixRow = ({
    compact,
    mix,
    showOpen,
}: {
    compact?: boolean;
    mix: M032DailyMix;
    showOpen?: boolean;
}) => {
    const { t } = useTranslation();
    const { playMix } = useDailyMixPlay();
    const playState = useMixPlayState(mix.id);
    const to = dailyMixPath(mix.id);

    const onPlay = (e: MouseEvent) => {
        e.preventDefault();
        void playMix(mix.id);
    };

    return (
        <article
            className={clsx(
                styles.mixRow,
                compact && styles.compact,
                playState && styles.isCurrent,
                mix.rating === -1 && styles.isDisliked,
            )}
        >
            <button
                aria-label={t('page.dailyMix.playMix', { title: mix.title })}
                className={styles.rowArt}
                onClick={onPlay}
                type="button"
            >
                <DailyMixCovers urls={mix.coverUrls} />
                <span className={styles.rowArtPlay}>
                    {playState ? <PlayingIndicator state={playState} /> : <Icon icon="mediaPlay" />}
                </span>
            </button>
            <div className={styles.rowMain}>
                <Link className={styles.rowTitle} title={mix.title} to={to}>
                    {mix.title}
                </Link>
                <span className={styles.rowSub}>{mixSubtitle(t, mix)}</span>
            </div>
            {showOpen && (
                <Link
                    aria-label={t('page.dailyMix.openMix', { title: mix.title })}
                    className={styles.rowOpen}
                    to={to}
                >
                    <Icon icon="arrowRightS" />
                </Link>
            )}
        </article>
    );
};
