import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { m032ApiClient, m032Context } from '/@/renderer/api/music032/music032-api';
import { queryKeys } from '/@/renderer/api/query-keys';
import { ItemImage } from '/@/renderer/components/item-image/item-image';
import { getTitlePath } from '/@/renderer/components/item-list/helpers/get-title-path';
import { NativeScrollArea } from '/@/renderer/components/native-scroll-area/native-scroll-area';
import { ContextMenuController } from '/@/renderer/features/context-menu/context-menu-controller';
import { formatTrackDuration } from '/@/renderer/features/home/music032/lib/format';
import { useMusic032HomePlay } from '/@/renderer/features/home/music032/use-music032-home-play';
import styles from '/@/renderer/features/playback-history/routes/playback-history-route.module.css';
import { AnimatedPage } from '/@/renderer/features/shared/components/animated-page';
import { LibraryContainer } from '/@/renderer/features/shared/components/library-container';
import { LibraryHeaderBar } from '/@/renderer/features/shared/components/library-header-bar';
import pageStyles from '/@/renderer/features/shared/components/music032/music032-pages.module.css';
import {
    Music032PageEmpty,
    Music032PageError,
} from '/@/renderer/features/shared/components/music032/music032-states';
import { PageErrorBoundary } from '/@/renderer/features/shared/components/page-error-boundary';
import { PlayingIndicator } from '/@/renderer/features/shared/components/playing-indicator/playing-indicator';
import { useSongPlayState } from '/@/renderer/features/shared/components/playing-indicator/use-song-play-state';
import { useCurrentServerWithCredential } from '/@/renderer/store';
import { formatHrDateTime } from '/@/renderer/utils/format';
import { m032Normalize } from '/@/shared/api/music032/music032-normalize';
import { M032Page, M032PlaybackRecord } from '/@/shared/api/music032/music032-types';
import { Button } from '/@/shared/components/button/button';
import { Icon } from '/@/shared/components/icon/icon';
import { closeAllModals, ConfirmModal, openModal } from '/@/shared/components/modal/modal';
import { Skeleton } from '/@/shared/components/skeleton/skeleton';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { Text } from '/@/shared/components/text/text';
import { toast } from '/@/shared/components/toast/toast';
import { LibraryItem, Song } from '/@/shared/types/domain-types';

const PAGE_SIZE = 100;
const KNOWN_STATES = [
    'buffering',
    'completed',
    'error',
    'interrupted',
    'paused',
    'playing',
    'skipped',
    'stopped',
] as const;

/** 播放记录：GET /api/v1/playback/history（最近播放在前），可清空（DELETE）。 */
const PlaybackHistoryRoute = () => {
    const { t } = useTranslation();
    const server = useCurrentServerWithCredential();
    const queryClient = useQueryClient();
    const { playSongs } = useMusic032HomePlay();

    const query = useInfiniteQuery({
        enabled: Boolean(server),
        getNextPageParam: (
            lastPage: M032Page<M032PlaybackRecord>,
            pages: M032Page<M032PlaybackRecord>[],
        ) => {
            const loaded = pages.reduce((sum, page) => sum + page.items.length, 0);
            return loaded < lastPage.total ? loaded : undefined;
        },
        initialPageParam: 0,
        queryFn: ({ pageParam, signal }) =>
            m032ApiClient({ server, signal }).get<M032Page<M032PlaybackRecord>>(
                '/playback/history',
                { query: { limit: PAGE_SIZE, offset: pageParam as number } },
            ),
        queryKey: queryKeys.playbackHistory.list(server?.id || ''),
        staleTime: 1000 * 30,
    });

    const items = useMemo(() => {
        const ctx = m032Context(server);
        return (query.data?.pages.flatMap((page) => page.items) ?? []).map((record) => ({
            record,
            song: m032Normalize.song(ctx, record.track),
        }));
    }, [query.data, server]);
    const total = query.data?.pages[0]?.total;

    // 无限滚动：哨兵进入视口时取下一页。
    const sentinelRef = useRef<HTMLDivElement>(null);
    const { fetchNextPage, hasNextPage, isFetchingNextPage } = query;
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel || !hasNextPage) return;
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) fetchNextPage();
        });
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [fetchNextPage, hasNextPage]);

    const clear = useMutation({
        mutationFn: () => m032ApiClient({ server }).delete('/playback/history'),
        onError: () => toast.error({ message: t('page.playbackHistory.clearFailed') }),
        onSuccess: () => {
            toast.success({ message: t('page.playbackHistory.cleared') });
            if (!server) return;
            // 主页的接着听 / 最近播放 / 聚焦卡都依赖播放进度。
            queryClient.invalidateQueries({ queryKey: queryKeys.playbackHistory.root(server.id) });
            queryClient.invalidateQueries({ queryKey: queryKeys.home.root(server.id) });
        },
    });

    const confirmClear = () =>
        openModal({
            children: (
                <ConfirmModal
                    labels={{
                        cancel: t('common.cancel'),
                        confirm: t('page.playbackHistory.clearConfirm'),
                    }}
                    onConfirm={() => {
                        closeAllModals();
                        clear.mutate();
                    }}
                >
                    <Text>{t('page.playbackHistory.clearDescription')}</Text>
                </ConfirmModal>
            ),
            title: t('page.playbackHistory.clearTitle'),
        });

    return (
        <AnimatedPage>
            <NativeScrollArea
                pageHeaderProps={{
                    backgroundColor: 'var(--theme-colors-background)',
                    children: (
                        <LibraryHeaderBar>
                            <LibraryHeaderBar.Title>
                                {t('page.playbackHistory.title')}
                            </LibraryHeaderBar.Title>
                        </LibraryHeaderBar>
                    ),
                    offset: 200,
                }}
            >
                <LibraryContainer>
                    <div className={pageStyles.page} style={{ paddingTop: '3rem' }}>
                        <h1 className={pageStyles.pageTitle}>{t('page.playbackHistory.title')}</h1>
                        <div className={pageStyles.toolbar}>
                            {total !== undefined && (
                                <span className={pageStyles.sectionCount}>
                                    {t('page.playbackHistory.count', { count: total })}
                                </span>
                            )}
                            <span className={pageStyles.spacer} />
                            {Boolean(total) && (
                                <Button
                                    disabled={clear.isPending}
                                    onClick={confirmClear}
                                    size="sm"
                                    variant="subtle"
                                >
                                    {t('page.playbackHistory.clear')}
                                </Button>
                            )}
                        </div>
                        {query.isPending ? (
                            <div className={styles.list}>
                                {Array.from({ length: 8 }, (_, i) => (
                                    <Skeleton borderRadius="10px" height={64} key={i} />
                                ))}
                            </div>
                        ) : query.isError ? (
                            <Music032PageError onRetry={() => query.refetch()} />
                        ) : items.length === 0 ? (
                            <Music032PageEmpty
                                hint={t('page.playbackHistory.emptyHint')}
                                title={t('page.playbackHistory.empty')}
                            />
                        ) : (
                            <>
                                <div className={styles.list}>
                                    {items.map(({ record, song }) => (
                                        <HistoryRow
                                            key={record.trackId}
                                            onPlay={() => playSongs([song])}
                                            record={record}
                                            song={song}
                                        />
                                    ))}
                                </div>
                                <div ref={sentinelRef} />
                                {isFetchingNextPage && <Spinner container />}
                            </>
                        )}
                    </div>
                </LibraryContainer>
            </NativeScrollArea>
        </AnimatedPage>
    );
};

type HistoryRowProps = {
    onPlay: () => void;
    record: M032PlaybackRecord;
    song: Song;
};

const HistoryRow = ({ onPlay, record, song }: HistoryRowProps) => {
    const { t } = useTranslation();
    const server = useCurrentServerWithCredential();
    const playState = useSongPlayState(server?.id, song.id);
    const percent =
        record.durationMillis > 0
            ? Math.min(100, Math.round((record.positionMillis / record.durationMillis) * 100))
            : 0;
    const state = record.state || '';
    const stateLabel = (KNOWN_STATES as readonly string[]).includes(state)
        ? t(`page.playbackHistory.state.${state}`)
        : state;

    return (
        <article
            className={clsx(styles.row, playState && styles.isCurrent)}
            onContextMenu={(e) => {
                e.preventDefault();
                ContextMenuController.call({
                    cmd: { items: [song], type: LibraryItem.SONG },
                    event: e,
                });
            }}
        >
            <button aria-label={song.name} className={styles.art} onClick={onPlay} type="button">
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
                <span className={styles.artPlay}>
                    {playState ? <PlayingIndicator state={playState} /> : <Icon icon="mediaPlay" />}
                </span>
            </button>
            <div className={styles.main}>
                <span className={styles.title} title={song.name}>
                    {song.name}
                </span>
                <span className={styles.sub}>
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
                <span aria-label={`${percent}%`} className={styles.meter} role="img">
                    <i style={{ width: `${percent}%` }} />
                </span>
            </div>
            {stateLabel ? (
                <span className={styles.state} data-state={state}>
                    {stateLabel}
                </span>
            ) : (
                <span />
            )}
            <dl className={styles.facts}>
                <div>
                    <dt>{t('page.playbackHistory.playCount')}</dt>
                    <dd>{record.playCount}</dd>
                </div>
                <div>
                    <dt>{t('page.playbackHistory.position')}</dt>
                    <dd>
                        {formatTrackDuration(record.positionMillis)} /{' '}
                        {formatTrackDuration(record.durationMillis)}
                    </dd>
                </div>
                <div>
                    <dt>{t('page.playbackHistory.lastPlayed')}</dt>
                    <dd>{formatHrDateTime(record.lastPlayedAt)}</dd>
                </div>
            </dl>
        </article>
    );
};

const PlaybackHistoryRouteWithBoundary = () => (
    <PageErrorBoundary>
        <PlaybackHistoryRoute />
    </PageErrorBoundary>
);

export default PlaybackHistoryRouteWithBoundary;
