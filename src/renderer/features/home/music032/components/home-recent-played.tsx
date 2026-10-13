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
import styles from '/@/renderer/features/home/music032/music032-home.module.css';
import { useMusic032HomePlay } from '/@/renderer/features/home/music032/use-music032-home-play';
import { PlayingIndicator } from '/@/renderer/features/shared/components/playing-indicator/playing-indicator';
import { useSongPlayState } from '/@/renderer/features/shared/components/playing-indicator/use-song-play-state';
import { useCurrentServerWithCredential } from '/@/renderer/store';
import { formatDateRelative } from '/@/renderer/utils/format';
import { m032Normalize } from '/@/shared/api/music032/music032-normalize';
import { Icon } from '/@/shared/components/icon/icon';
import { LibraryItem, Song } from '/@/shared/types/domain-types';

/**
 * 最近播放：填在接着听下方，只占用左栏剩余高度（由右侧最近添加决定），
 * 放不下的行被 CSS 折到隐藏列里；剩余空间不够一行时整块隐藏。
 */
export const HomeRecentPlayed = ({ excludeTrackIds }: { excludeTrackIds: number[] }) => {
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
            .map((track) => m032Normalize.song(ctx, track));
    }, [excludeTrackIds, query.data, server]);

    return (
        <div aria-hidden={songs.length === 0} className={styles.recentPlayed}>
            {songs.length > 0 && (
                <div className={styles.recentPlayedInner}>
                    <h3 className={styles.recentPlayedTitle}>
                        {t('page.home.music032.recentPlayed')}
                    </h3>
                    <div className={styles.recentPlayedRows}>
                        {songs.map((song) => (
                            <RecentPlayedRow
                                key={song.id}
                                onPlay={() => playSongs([song])}
                                song={song}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const RecentPlayedRow = ({ onPlay, song }: { onPlay: () => void; song: Song }) => {
    const server = useCurrentServerWithCredential();
    const playState = useSongPlayState(server?.id, song.id);

    return (
        <article
            className={clsx(styles.resumeRow, styles.playedRow, playState && styles.isCurrent)}
            onContextMenu={(e) => {
                e.preventDefault();
                ContextMenuController.call({
                    cmd: { items: [song], type: LibraryItem.SONG },
                    event: e,
                });
            }}
        >
            <button
                aria-label={song.name}
                className={clsx(styles.rowArt, styles.playedArt)}
                onClick={onPlay}
                type="button"
            >
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
            <span className={styles.rowWhen}>{formatDateRelative(song.lastPlayedAt)}</span>
        </article>
    );
};
