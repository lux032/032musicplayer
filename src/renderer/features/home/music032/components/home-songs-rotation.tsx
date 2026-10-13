import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { m032Context } from '/@/renderer/api/music032/music032-api';
import { ItemImage } from '/@/renderer/components/item-image/item-image';
import { ContextMenuController } from '/@/renderer/features/context-menu/context-menu-controller';
import { music032HomeQueries } from '/@/renderer/features/home/music032/api/music032-home-api';
import {
    HomeSection,
    HomeSectionError,
} from '/@/renderer/features/home/music032/components/home-section';
import {
    formatTrackDuration,
    isPrimaryRole,
    workRoleLabel,
} from '/@/renderer/features/home/music032/lib/format';
import { useOpenMusic032Work } from '/@/renderer/features/home/music032/lib/open-music032-web';
import styles from '/@/renderer/features/home/music032/music032-home.module.css';
import { useMusic032HomePlay } from '/@/renderer/features/home/music032/use-music032-home-play';
import { usePlayer } from '/@/renderer/features/player/context/player-context';
import { PlayingIndicator } from '/@/renderer/features/shared/components/playing-indicator/playing-indicator';
import { useSongPlayState } from '/@/renderer/features/shared/components/playing-indicator/use-song-play-state';
import { AppRoute } from '/@/renderer/router/routes';
import { useCurrentServerWithCredential } from '/@/renderer/store';
import { m032Normalize } from '/@/shared/api/music032/music032-normalize';
import { M032HomeSongRow, M032RotationPage } from '/@/shared/api/music032/music032-types';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Button } from '/@/shared/components/button/button';
import { Icon } from '/@/shared/components/icon/icon';
import { toast } from '/@/shared/components/toast/toast';
import { LibraryItem, Song } from '/@/shared/types/domain-types';
import { Play } from '/@/shared/types/types';

/** 主题曲与插曲：每日轮换的歌曲行，换一批翻页。 */
export const HomeSongsRotation = ({ initial }: { initial: M032RotationPage<M032HomeSongRow> }) => {
    const { t } = useTranslation();
    const server = useCurrentServerWithCredential();

    const [args, setArgs] = useState({ batch: initial.batch, generation: initial.generation });
    const isInitialPage = args.batch === initial.batch && args.generation === initial.generation;

    const query = useQuery({
        ...(server
            ? music032HomeQueries.songs(server, args)
            : { enabled: false, queryKey: ['noop'] as const }),
        enabled: Boolean(server),
        ...(isInitialPage ? { initialData: initial } : {}),
    });

    const page = query.data;
    const renewedGenerationRef = useRef<string>('');

    useEffect(() => {
        if (!page?.renewed || renewedGenerationRef.current === page.generation) return;
        renewedGenerationRef.current = page.generation;
        toast.info({ message: t('page.home.music032.renewNotice') });
        setArgs((prev) => ({ ...prev, batch: page.batch, generation: page.generation }));
    }, [page, t]);

    return (
        <HomeSection
            count={t('page.home.music032.songsHint')}
            title={t('page.home.music032.songsTitle')}
            tools={
                <>
                    {(page?.pages ?? 0) > 1 && (
                        <Button
                            leftSection={<Icon icon="refresh" />}
                            onClick={() =>
                                page && setArgs((prev) => ({ ...prev, batch: page.batch + 1 }))
                            }
                            size="sm"
                            variant="subtle"
                        >
                            {t('page.home.music032.nextBatch')}
                        </Button>
                    )}
                    <Link className={styles.sectionLink} to={AppRoute.LIBRARY_SONGS}>
                        {t('page.home.music032.allSongs')}
                        <Icon icon="arrowRightS" />
                    </Link>
                </>
            }
        >
            {query.isError ? (
                <HomeSectionError onRetry={() => query.refetch()} />
            ) : !page ? null : (
                <div aria-busy={query.isFetching} className={styles.songList}>
                    {page.items.map((row) => (
                        <SongRowItem key={`${row.track.id}-${row.role}`} row={row} />
                    ))}
                </div>
            )}
        </HomeSection>
    );
};

const SongRowItem = ({ row }: { row: M032HomeSongRow }) => {
    const { t } = useTranslation();
    const server = useCurrentServerWithCredential();
    const player = usePlayer();
    const openWork = useOpenMusic032Work();
    const { playSongs } = useMusic032HomePlay();

    const song: Song = useMemo(
        () => m032Normalize.song(m032Context(server), row.track),
        [row.track, server],
    );

    const playState = useSongPlayState(server?.id, song.id);

    const appendToQueue = () => {
        player.addToQueueByData([song], Play.LAST);
    };

    return (
        <article
            className={clsx(styles.songRow, playState && styles.isCurrent)}
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
                className={styles.rowArt}
                onClick={() => playSongs([song])}
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
                <span className={styles.rowSub}>{song.artistName}</span>
            </div>
            <span
                className={`${styles.roleTag} ${isPrimaryRole(row.role) ? styles.isPrimary : ''}`}
            >
                {workRoleLabel(t, row.role)}
            </span>
            <button
                className={styles.songWork}
                onClick={() => openWork(row.work.id)}
                title={row.work.title}
                type="button"
            >
                {row.work.title}
            </button>
            <span className={styles.rowTime}>{formatTrackDuration(song.duration)}</span>
            <ActionIcon
                aria-label={t('page.home.music032.addToQueue')}
                onClick={appendToQueue}
                variant="subtle"
            >
                <Icon icon="playlistAdd" />
            </ActionIcon>
        </article>
    );
};
