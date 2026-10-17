import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { m032Context } from '/@/renderer/api/music032/music032-api';
import { ItemImage } from '/@/renderer/components/item-image/item-image';
import { getTitlePath } from '/@/renderer/components/item-list/helpers/get-title-path';
import { ContextMenuController } from '/@/renderer/features/context-menu/context-menu-controller';
import { music032HomeQueries } from '/@/renderer/features/home/music032/api/music032-home-api';
import {
    HomeInlineEmpty,
    HomeSection,
} from '/@/renderer/features/home/music032/components/home-section';
import styles from '/@/renderer/features/home/music032/music032-home.module.css';
import { useMusic032HomePlay } from '/@/renderer/features/home/music032/use-music032-home-play';
import { PlayingIndicator } from '/@/renderer/features/shared/components/playing-indicator/playing-indicator';
import { useSongPlayState } from '/@/renderer/features/shared/components/playing-indicator/use-song-play-state';
import { AppRoute } from '/@/renderer/router/routes';
import { useCurrentServerWithCredential } from '/@/renderer/store';
import { formatHrDateTime } from '/@/renderer/utils/format';
import { m032Normalize } from '/@/shared/api/music032/music032-normalize';
import { Icon } from '/@/shared/components/icon/icon';
import { LibraryItem, Song } from '/@/shared/types/domain-types';

export const RECENT_PLAYED_COUNT = 5;

/**
 * 最近播放：最近播放过的 `count` 首（默认 5，不含下方接着听已列出的曲目），不显示进度。
 * 数据来自 /tracks?sort=recentlyPlayed，从未播放的曲目排在末尾，这里过滤掉。
 */
export const HomeRecentPlayed = ({
    count = RECENT_PLAYED_COUNT,
    excludeTrackIds,
}: {
    count?: number;
    excludeTrackIds: number[];
}) => {
    const { t } = useTranslation();
    const server = useCurrentServerWithCredential();
    const { playSongs } = useMusic032HomePlay();

    const query = useQuery({
        ...(server
            ? music032HomeQueries.recentPlayed(server)
            : { enabled: false, queryKey: ['noop'] as const }),
        enabled: Boolean(server),
    });

    const songs = useMemo(() => {
        const ctx = m032Context(server);
        const exclude = new Set(excludeTrackIds);
        return (query.data?.items ?? [])
            .filter((track) => track.lastPlayedAt && !exclude.has(track.id))
            .slice(0, count)
            .map((track) => m032Normalize.song(ctx, track));
    }, [count, excludeTrackIds, query.data, server]);

    return (
        <HomeSection
            title={t('page.home.music032.recentPlayed')}
            tools={
                <Link className={styles.sectionLink} to={AppRoute.LIBRARY_PLAYBACK_HISTORY}>
                    {t('page.home.music032.playbackHistory')}
                    <Icon icon="arrowRightS" />
                </Link>
            }
        >
            {query.isPending ? null : songs.length === 0 ? (
                <HomeInlineEmpty
                    hint={t('page.home.music032.recentPlayedEmptyHint')}
                    title={t('page.home.music032.recentPlayedEmpty')}
                />
            ) : (
                <div className={styles.rows}>
                    {songs.map((song) => (
                        <RecentPlayedRow
                            key={song.id}
                            onPlay={() => playSongs([song])}
                            song={song}
                        />
                    ))}
                </div>
            )}
        </HomeSection>
    );
};

const RecentPlayedRow = ({ onPlay, song }: { onPlay: () => void; song: Song }) => {
    const server = useCurrentServerWithCredential();
    const playState = useSongPlayState(server?.id, song.id);

    return (
        <article
            className={clsx(styles.resumeRow, playState && styles.isCurrent)}
            onContextMenu={(e) => {
                e.preventDefault();
                ContextMenuController.call({
                    cmd: { items: [song], type: LibraryItem.SONG },
                    event: e,
                });
            }}
        >
            <button aria-label={song.name} className={styles.rowArt} onClick={onPlay} type="button">
                {song.imageId ? (
                    <ItemImage
                        containerClassName={styles.imgBox}
                        id={song.imageId}
                        itemType={LibraryItem.SONG}
                        size={256}
                    />
                ) : (
                    <span>032</span>
                )}
                <span className={styles.rowArtPlay}>
                    {playState ? <PlayingIndicator state={playState} /> : <Icon icon="mediaPlay" />}
                </span>
            </button>
            <div className={styles.rowMain}>
                <span className={styles.rowTitle} title={song.name}>
                    {song.name}
                </span>
                <span className={styles.rowSub}>
                    {song.artistName}
                    {song.albumId && song.album && (
                        <>
                            {' · '}
                            <Link to={getTitlePath(LibraryItem.ALBUM, song.albumId) || '#'}>
                                {song.album}
                            </Link>
                        </>
                    )}
                </span>
            </div>
            <span className={styles.rowWhen}>{formatHrDateTime(song.lastPlayedAt)}</span>
        </article>
    );
};
