import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { generatePath, Link, useNavigate, useParams } from 'react-router';

import { m032Context, Music032ApiError } from '/@/renderer/api/music032/music032-api';
import { queryKeys } from '/@/renderer/api/query-keys';
import { ItemImage } from '/@/renderer/components/item-image/item-image';
import { getTitlePath } from '/@/renderer/components/item-list/helpers/get-title-path';
import { NativeScrollArea } from '/@/renderer/components/native-scroll-area/native-scroll-area';
import { ContextMenuController } from '/@/renderer/features/context-menu/context-menu-controller';
import {
    DAILY_MIX_REASONS,
    dailyMixQueries,
    invalidateDailyMixes,
    rateDailyMix,
    regenerateDailyMix,
    saveDailyMix,
    setRecommendationBlock,
} from '/@/renderer/features/daily-mix/api/daily-mix-api';
import {
    DailyMixCovers,
    dailyMixPath,
    DailyMixRow,
    mixSubtitle,
} from '/@/renderer/features/daily-mix/components/daily-mix-parts';
import styles from '/@/renderer/features/daily-mix/components/daily-mix.module.css';
import { useDailyMixPlay } from '/@/renderer/features/daily-mix/lib/use-daily-mix-play';
import { formatTrackDuration } from '/@/renderer/features/home/music032/lib/format';
import { AnimatedPage } from '/@/renderer/features/shared/components/animated-page';
import { LibraryContainer } from '/@/renderer/features/shared/components/library-container';
import { LibraryHeaderBar } from '/@/renderer/features/shared/components/library-header-bar';
import {
    Music032PageError,
    Music032PageNotFound,
    Music032PageSkeleton,
} from '/@/renderer/features/shared/components/music032/music032-states';
import { PageErrorBoundary } from '/@/renderer/features/shared/components/page-error-boundary';
import { PlayingIndicator } from '/@/renderer/features/shared/components/playing-indicator/playing-indicator';
import { useSongPlayState } from '/@/renderer/features/shared/components/playing-indicator/use-song-play-state';
import { queryClient } from '/@/renderer/lib/react-query';
import { AppRoute } from '/@/renderer/router/routes';
import { useCurrentServerWithCredential } from '/@/renderer/store';
import { m032Normalize } from '/@/shared/api/music032/music032-normalize';
import {
    M032DailyMix,
    M032DailyMixDetail,
    M032DailyMixTrack,
} from '/@/shared/api/music032/music032-types';
import { Button } from '/@/shared/components/button/button';
import { Checkbox } from '/@/shared/components/checkbox/checkbox';
import { Icon } from '/@/shared/components/icon/icon';
import { toast } from '/@/shared/components/toast/toast';
import { LibraryItem, ServerListItemWithCredential, Song } from '/@/shared/types/domain-types';
import { Play } from '/@/shared/types/types';

/**
 * 每日推荐歌单详情，对照 032 网页 /admin/daily-mixes/{id}（templates/daily-mix.html）：
 * 封面拼图 + 主题信息 + 播放按钮；曲目列表（新发现标记、不再推荐）；右栏评价、换一个、
 * 另存为歌单和今天的其他推荐。
 */
const DailyMixDetailRoute = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { mixId = '' } = useParams();
    const id = Number(mixId);
    const server = useCurrentServerWithCredential();
    const { appendDetail, playDetail } = useDailyMixPlay();

    const enabled = Boolean(server) && Number.isInteger(id) && id > 0;
    const detailQuery = useQuery({
        ...(server && enabled
            ? dailyMixQueries.detail(server, id)
            : { enabled: false, queryKey: ['noop'] as const }),
        enabled,
    });
    const listQuery = useQuery({
        ...(server && enabled
            ? dailyMixQueries.list(server)
            : { enabled: false, queryKey: ['noop'] as const }),
        enabled,
    });

    const detail = detailQuery.data;
    const mix = detail?.mix;
    const list = listQuery.data;
    // Same rule as the web page: an active mix of the current day can be replaced.
    const current = Boolean(mix && list && mix.status === 'active' && mix.day === list.day);
    const others = useMemo(
        () => (current && list ? list.items.filter((item) => item.id !== id) : []),
        [current, id, list],
    );

    const songs = useMemo(() => {
        const ctx = m032Context(server);
        const map = new Map<number, Song>();
        for (const item of detail?.tracks ?? []) {
            map.set(item.track.id, m032Normalize.song(ctx, item.track));
        }
        return map;
    }, [detail, server]);

    if (detailQuery.error instanceof Music032ApiError && detailQuery.error.status === 404) {
        return (
            <AnimatedPage>
                <LibraryContainer>
                    <div className={styles.page} style={{ paddingTop: '3rem' }}>
                        <Music032PageNotFound
                            backTo={AppRoute.HOME}
                            backToLabel={t('page.dailyMix.backHome')}
                            hint={t('page.dailyMix.notFoundHint')}
                            title={t('page.dailyMix.notFound')}
                        />
                    </div>
                </LibraryContainer>
            </AnimatedPage>
        );
    }

    const contextLabel = !mix
        ? ''
        : current
          ? t('page.dailyMix.title')
          : mix.status === 'replaced'
            ? t('page.dailyMix.pastReplaced', { day: mix.day })
            : t('page.dailyMix.past', { day: mix.day });

    return (
        <AnimatedPage key={`daily-mix-${mixId}`}>
            <NativeScrollArea
                pageHeaderProps={{
                    backgroundColor: 'var(--theme-colors-background)',
                    children: (
                        <LibraryHeaderBar>
                            <LibraryHeaderBar.Title>{mix?.title || ''}</LibraryHeaderBar.Title>
                        </LibraryHeaderBar>
                    ),
                    offset: 200,
                }}
            >
                <LibraryContainer>
                    <div className={styles.page} style={{ paddingTop: '3rem' }}>
                        {detailQuery.isPending ? (
                            <Music032PageSkeleton />
                        ) : detailQuery.isError || !detail || !mix || !server ? (
                            <Music032PageError onRetry={() => detailQuery.refetch()} />
                        ) : (
                            <>
                                <section className={styles.hero}>
                                    <DailyMixCovers
                                        className={styles.heroCovers}
                                        size={256}
                                        urls={mix.coverUrls}
                                    />
                                    <div className={styles.heroBody}>
                                        <p className={styles.kicker}>
                                            {mix.themeTypeLabel}
                                            {contextLabel && (
                                                <span className={styles.kickerContext}>
                                                    {contextLabel}
                                                </span>
                                            )}
                                        </p>
                                        <h1 className={styles.heroTitle}>{mix.title}</h1>
                                        {mix.description && (
                                            <p className={styles.heroDescription}>
                                                {mix.description}
                                            </p>
                                        )}
                                        {mix.tags.length > 0 && (
                                            <div className={styles.tags}>
                                                {mix.tags.map((tag) => (
                                                    <span
                                                        className={clsx(
                                                            styles.tag,
                                                            tag.kind === 'style' && styles.isStyle,
                                                        )}
                                                        key={`${tag.kind}-${tag.tag}`}
                                                    >
                                                        {tag.label}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <div className={styles.heroActions}>
                                            <Button
                                                leftSection={
                                                    <Icon fill="contrast" icon="mediaPlay" />
                                                }
                                                onClick={() => void playDetail(detail)}
                                                variant="filled"
                                            >
                                                {t('page.dailyMix.playAll')}
                                            </Button>
                                            <Button
                                                leftSection={<Icon icon="mediaShuffle" />}
                                                onClick={() =>
                                                    void playDetail(detail, Play.SHUFFLE)
                                                }
                                                variant="default"
                                            >
                                                {t('page.dailyMix.shuffle')}
                                            </Button>
                                            <Button
                                                leftSection={<Icon icon="playlistAdd" />}
                                                onClick={() => appendDetail(detail)}
                                                variant="default"
                                            >
                                                {t('page.dailyMix.addToQueue')}
                                            </Button>
                                        </div>
                                        <p className={styles.heroMeta}>{mixSubtitle(t, mix)}</p>
                                    </div>
                                </section>

                                <div className={styles.layout}>
                                    <section className={styles.tracksSection}>
                                        <div className={styles.sectionHead}>
                                            <h2>{t('page.dailyMix.songs')}</h2>
                                            <span className={styles.sectionCount}>
                                                {t('page.dailyMix.trackCount', {
                                                    count: detail.tracks.length,
                                                })}
                                            </span>
                                        </div>
                                        <div className={styles.trackList}>
                                            {detail.tracks.map((item) => {
                                                const song = songs.get(item.track.id);
                                                if (!song) return null;
                                                return (
                                                    <DailyMixTrackRow
                                                        item={item}
                                                        key={item.position}
                                                        mixId={mix.id}
                                                        onPlay={() =>
                                                            void playDetail(
                                                                detail,
                                                                Play.NOW,
                                                                song.id,
                                                            )
                                                        }
                                                        server={server}
                                                        song={song}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </section>

                                    <aside className={styles.aside}>
                                        <FeedbackCard
                                            current={current}
                                            mix={mix}
                                            onReplaced={(next) =>
                                                navigate(dailyMixPath(next.id), { replace: true })
                                            }
                                            replacementsLeft={list?.replacementsLeft ?? 0}
                                            server={server}
                                        />
                                        {others.length > 0 && (
                                            <section className={styles.card}>
                                                <h2>{t('page.dailyMix.others')}</h2>
                                                <div className={styles.rows}>
                                                    {others.map((other) => (
                                                        <DailyMixRow
                                                            compact
                                                            key={other.id}
                                                            mix={other}
                                                        />
                                                    ))}
                                                </div>
                                            </section>
                                        )}
                                    </aside>
                                </div>
                            </>
                        )}
                    </div>
                </LibraryContainer>
            </NativeScrollArea>
        </AnimatedPage>
    );
};

const updateDetail = (
    serverId: string,
    mixId: number,
    fn: (detail: M032DailyMixDetail) => M032DailyMixDetail,
) =>
    queryClient.setQueryData<M032DailyMixDetail>(
        queryKeys.dailyMixes.detail(serverId, mixId),
        (old) => (old ? fn(old) : old),
    );

const DailyMixTrackRow = ({
    item,
    mixId,
    onPlay,
    server,
    song,
}: {
    item: M032DailyMixTrack;
    mixId: number;
    onPlay: () => void;
    server: ServerListItemWithCredential;
    song: Song;
}) => {
    const { t } = useTranslation();
    const playState = useSongPlayState(server.id, song.id);
    const [busy, setBusy] = useState(false);
    const blocked = Boolean(item.blocked);
    const missing = Boolean(item.track.missing);
    const albumPath = song.albumId ? getTitlePath(LibraryItem.ALBUM, song.albumId) : null;

    const toggleBlock = async () => {
        setBusy(true);
        try {
            await setRecommendationBlock(server, item.track.id, !blocked);
            updateDetail(server.id, mixId, (old) => ({
                ...old,
                tracks: old.tracks.map((other) =>
                    other.track.id === item.track.id ? { ...other, blocked: !blocked } : other,
                ),
            }));
        } catch {
            toast.error({ message: t('page.dailyMix.actionFailed') });
        } finally {
            setBusy(false);
        }
    };

    return (
        <article
            className={clsx(
                styles.trackRow,
                playState && styles.isCurrent,
                blocked && styles.isBlocked,
            )}
            onContextMenu={(e) => {
                e.preventDefault();
                ContextMenuController.call({
                    cmd: { items: [song], type: LibraryItem.SONG },
                    event: e,
                });
            }}
            onDoubleClick={missing ? undefined : onPlay}
        >
            <button
                aria-label={t('page.dailyMix.playTrack', { title: song.name })}
                className={styles.trackNo}
                disabled={missing}
                onClick={onPlay}
                type="button"
            >
                {playState ? (
                    <PlayingIndicator state={playState} />
                ) : (
                    <>
                        <span className={styles.trackNoText}>{item.position + 1}</span>
                        <Icon className={styles.trackNoPlay} icon="mediaPlay" />
                    </>
                )}
            </button>
            <span className={styles.trackArt}>
                {song.imageId ? (
                    <ItemImage
                        containerClassName={styles.coverBox}
                        id={song.imageId}
                        itemType={LibraryItem.SONG}
                        size={128}
                    />
                ) : (
                    <span>032</span>
                )}
            </span>
            <div className={styles.trackMain}>
                <span className={styles.trackTitle}>
                    <span className={styles.trackTitleText} title={song.name}>
                        {song.name}
                    </span>
                    {item.bucket === 'explore' && (
                        <span className={styles.newBadge} title={t('page.dailyMix.exploreHint')}>
                            {t('page.dailyMix.explore')}
                        </span>
                    )}
                    {missing && (
                        <span className={styles.missing}>{t('page.dailyMix.missing')}</span>
                    )}
                </span>
                <span className={styles.trackSub}>
                    {song.artistName}
                    {albumPath && song.album && (
                        <>
                            {' · '}
                            <Link to={albumPath}>{song.album}</Link>
                        </>
                    )}
                </span>
            </div>
            <span className={styles.trackFormat}>
                {item.track.container && (
                    <span className={styles.formatPill}>{item.track.container.toUpperCase()}</span>
                )}
            </span>
            <span className={styles.trackTime}>{formatTrackDuration(song.duration)}</span>
            <button
                aria-label={
                    blocked
                        ? t('page.dailyMix.unblockTrack', { title: song.name })
                        : t('page.dailyMix.blockTrack', { title: song.name })
                }
                aria-pressed={blocked}
                className={clsx(styles.blockButton, blocked && styles.isOn)}
                disabled={busy}
                onClick={toggleBlock}
                title={blocked ? t('page.dailyMix.unblockHint') : t('page.dailyMix.blockHint')}
                type="button"
            >
                {blocked ? t('page.dailyMix.blocked') : t('page.dailyMix.block')}
            </button>
        </article>
    );
};

const FeedbackCard = ({
    current,
    mix,
    onReplaced,
    replacementsLeft,
    server,
}: {
    current: boolean;
    mix: M032DailyMix;
    onReplaced: (next: M032DailyMix) => void;
    replacementsLeft: number;
    server: ServerListItemWithCredential;
}) => {
    const { t } = useTranslation();
    const [reasonsOpen, setReasonsOpen] = useState(false);
    const [reasons, setReasons] = useState<string[]>(mix.ratingReasons);
    const [busy, setBusy] = useState<null | string>(null);

    const run = async (key: string, fn: () => Promise<void>) => {
        setBusy(key);
        try {
            await fn();
        } catch (error) {
            const message =
                error instanceof Music032ApiError && error.status === 429
                    ? t('page.dailyMix.replaceLimit')
                    : error instanceof Music032ApiError && error.status === 409
                      ? error.message
                      : t('page.dailyMix.actionFailed');
            toast.error({ message });
        } finally {
            setBusy(null);
        }
    };

    const rate = (value: -1 | 0 | 1, chosen: string[] = []) =>
        run(`rate${value}`, async () => {
            const updated = await rateDailyMix(server, mix.id, value, chosen);
            updateDetail(server.id, mix.id, (old) => ({ ...old, mix: updated }));
            setReasons(updated.ratingReasons);
            setReasonsOpen(false);
            void invalidateDailyMixes(server.id);
        });

    const replace = () =>
        run('replace', async () => {
            const next = await regenerateDailyMix(server, mix.id);
            await invalidateDailyMixes(server.id);
            toast.success({ message: t('page.dailyMix.replaced', { title: next.title }) });
            onReplaced(next);
        });

    const save = () =>
        run('save', async () => {
            const { playlist } = await saveDailyMix(server, mix.id);
            updateDetail(server.id, mix.id, (old) => ({
                ...old,
                mix: { ...old.mix, savedPlaylistId: playlist.id },
            }));
            void queryClient.invalidateQueries({ queryKey: queryKeys.playlists.root(server.id) });
            void queryClient.invalidateQueries({ queryKey: queryKeys.home.root(server.id) });
            toast.success({ message: t('page.dailyMix.saved', { name: playlist.name }) });
        });

    const reasonText = mix.ratingReasons
        .map((code) => t(`page.dailyMix.reason.${code}`, { defaultValue: code }))
        .join(t('page.dailyMix.reasonSeparator'));

    return (
        <section className={clsx(styles.card, styles.feedback)}>
            <h2>{t('page.dailyMix.feedbackTitle')}</h2>
            <div className={styles.rateRow}>
                <button
                    aria-pressed={mix.rating === 1}
                    className={clsx(styles.rateButton, mix.rating === 1 && styles.isOn)}
                    disabled={busy !== null}
                    onClick={() => rate(mix.rating === 1 ? 0 : 1)}
                    type="button"
                >
                    <Icon icon="thumbsUp" />
                    {t('page.dailyMix.like')}
                </button>
                {mix.rating === -1 ? (
                    <button
                        aria-pressed
                        className={clsx(styles.rateButton, styles.isOn)}
                        disabled={busy !== null}
                        onClick={() => rate(0)}
                        type="button"
                    >
                        <Icon icon="thumbsDown" />
                        {t('page.dailyMix.disliked')}
                    </button>
                ) : (
                    <button
                        aria-expanded={reasonsOpen}
                        className={clsx(styles.rateButton, reasonsOpen && styles.isOpen)}
                        disabled={busy !== null}
                        onClick={() => setReasonsOpen((open) => !open)}
                        type="button"
                    >
                        <Icon icon="thumbsDown" />
                        {t('page.dailyMix.dislike')}
                    </button>
                )}
            </div>
            {mix.rating === -1 && (
                <p className={styles.note}>
                    {t('page.dailyMix.dislikeRecorded', {
                        reasons: reasonText || t('page.dailyMix.disliked'),
                    })}
                </p>
            )}
            {reasonsOpen && mix.rating !== -1 && (
                <div className={styles.reasons}>
                    <p className={styles.note}>{t('page.dailyMix.reasonsPrompt')}</p>
                    {DAILY_MIX_REASONS.map((code) => (
                        <Checkbox
                            checked={reasons.includes(code)}
                            key={code}
                            label={t(`page.dailyMix.reason.${code}`)}
                            onChange={(e) => {
                                const checked = e.currentTarget.checked;
                                setReasons((prev) =>
                                    checked ? [...prev, code] : prev.filter((c) => c !== code),
                                );
                            }}
                        />
                    ))}
                    <Button
                        className={styles.reasonsSubmit}
                        loading={busy === 'rate-1'}
                        onClick={() => rate(-1, reasons)}
                        size="sm"
                        variant="default"
                    >
                        {t('page.dailyMix.submit')}
                    </Button>
                </div>
            )}
            {current && (
                <div className={styles.action}>
                    <Button
                        disabled={replacementsLeft <= 0 || (busy !== null && busy !== 'replace')}
                        leftSection={<Icon icon="refresh" />}
                        loading={busy === 'replace'}
                        onClick={replace}
                        variant="default"
                    >
                        {t('page.dailyMix.replace')}
                    </Button>
                    <span className={styles.note}>
                        {replacementsLeft > 0
                            ? t('page.dailyMix.replacementsLeft', { count: replacementsLeft })
                            : t('page.dailyMix.replacementsUsedUp')}
                    </span>
                </div>
            )}
            <div className={styles.action}>
                <Button
                    disabled={busy !== null && busy !== 'save'}
                    leftSection={<Icon icon="add" />}
                    loading={busy === 'save'}
                    onClick={save}
                    variant="default"
                >
                    {mix.savedPlaylistId ? t('page.dailyMix.saveAgain') : t('page.dailyMix.save')}
                </Button>
                {mix.savedPlaylistId ? (
                    <Link
                        className={styles.noteLink}
                        to={generatePath(AppRoute.PLAYLISTS_DETAIL_SONGS, {
                            playlistId: String(mix.savedPlaylistId),
                        })}
                    >
                        {t('page.dailyMix.viewSaved')}
                    </Link>
                ) : null}
            </div>
            <p className={styles.note}>{t('page.dailyMix.effectNote')}</p>
        </section>
    );
};

const DailyMixDetailRouteWithBoundary = () => (
    <PageErrorBoundary>
        <DailyMixDetailRoute />
    </PageErrorBoundary>
);

export default DailyMixDetailRouteWithBoundary;
