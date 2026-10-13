import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { generatePath, Link, useParams } from 'react-router';

import { m032Context, Music032ApiError } from '/@/renderer/api/music032/music032-api';
import { ItemImage } from '/@/renderer/components/item-image/item-image';
import { getTitlePath } from '/@/renderer/components/item-list/helpers/get-title-path';
import { NativeScrollArea } from '/@/renderer/components/native-scroll-area/native-scroll-area';
import {
    workAlbumRoleLabel,
    workPosterPath,
    workRoleSequenceLabel,
    workSourceLabel,
    workTypeLongLabel,
} from '/@/renderer/features/home/music032/lib/format';
import { openMusic032WebPath } from '/@/renderer/features/home/music032/lib/open-music032-web';
import { useMusic032HomePlay } from '/@/renderer/features/home/music032/use-music032-home-play';
import { AnimatedPage } from '/@/renderer/features/shared/components/animated-page';
import { LibraryContainer } from '/@/renderer/features/shared/components/library-container';
import { LibraryHeaderBar } from '/@/renderer/features/shared/components/library-header-bar';
import { Music032AlbumCard } from '/@/renderer/features/shared/components/music032/music032-album-card';
import styles from '/@/renderer/features/shared/components/music032/music032-pages.module.css';
import { Music032SongRow } from '/@/renderer/features/shared/components/music032/music032-song-row';
import {
    Music032PageEmpty,
    Music032PageError,
    Music032PageNotFound,
    Music032PageSkeleton,
} from '/@/renderer/features/shared/components/music032/music032-states';
import { PageErrorBoundary } from '/@/renderer/features/shared/components/page-error-boundary';
import { worksQueries } from '/@/renderer/features/works/api/works-api';
import { AppRoute } from '/@/renderer/router/routes';
import { useCurrentServerWithCredential } from '/@/renderer/store';
import { m032Normalize } from '/@/shared/api/music032/music032-normalize';
import { M032WorkTrack } from '/@/shared/api/music032/music032-types';
import { Button } from '/@/shared/components/button/button';
import { Icon } from '/@/shared/components/icon/icon';
import { LibraryItem, Song } from '/@/shared/types/domain-types';

const WorkDetailRoute = () => {
    const { t } = useTranslation();
    const { workId = '' } = useParams();
    const id = Number(workId);
    const server = useCurrentServerWithCredential();
    const { appendWorks, playAlbum, playSongs, playWorks } = useMusic032HomePlay();

    const enabled = Boolean(server) && Number.isFinite(id);
    const detailQuery = useQuery({
        ...(server && enabled
            ? worksQueries.detail(server, id)
            : { enabled: false, queryKey: ['noop'] as const }),
        enabled,
    });
    const albumsQuery = useQuery({
        ...(server && enabled
            ? worksQueries.albums(server, id)
            : { enabled: false, queryKey: ['noop'] as const }),
        enabled,
    });
    const tracksQuery = useQuery({
        ...(server && enabled
            ? worksQueries.tracks(server, id)
            : { enabled: false, queryKey: ['noop'] as const }),
        enabled,
    });

    const work = detailQuery.data;
    const albums = useMemo(() => albumsQuery.data?.items ?? [], [albumsQuery.data]);
    const tracks = useMemo(() => tracksQuery.data?.items ?? [], [tracksQuery.data]);

    // 数据拼法见 works.md：专辑内用途 = albumId 属于关联专辑且 source != album；
    // 收录于精选集 = albumId 不属于任何关联专辑。
    const relatedAlbumIds = useMemo(() => new Set(albums.map((a) => a.albumId)), [albums]);

    const usageByAlbum = useMemo(() => {
        const map = new Map<number, M032WorkTrack[]>();
        for (const track of tracks) {
            if (!relatedAlbumIds.has(track.albumId) || track.source === 'album') continue;
            const list = map.get(track.albumId) ?? [];
            list.push(track);
            map.set(track.albumId, list);
        }
        return map;
    }, [relatedAlbumIds, tracks]);

    const collectedTracks = useMemo(
        () => tracks.filter((track) => !relatedAlbumIds.has(track.albumId)),
        [relatedAlbumIds, tracks],
    );

    const collectedSongs = useMemo(() => {
        const ctx = m032Context(server);
        const map = new Map<number, Song>();
        for (const track of collectedTracks) {
            map.set(track.id, m032Normalize.song(ctx, track));
        }
        return map;
    }, [collectedTracks, server]);

    if (detailQuery.error instanceof Music032ApiError && detailQuery.error.status === 404) {
        return (
            <AnimatedPage>
                <LibraryContainer>
                    <div className={styles.page} style={{ paddingTop: '3rem' }}>
                        <Music032PageNotFound
                            backTo={AppRoute.LIBRARY_WORKS}
                            backToLabel={t('page.works.backToWorks')}
                            hint={t('page.works.notFoundHint')}
                            onOpenWeb={() =>
                                openMusic032WebPath(server ?? null, `/admin/works/${workId}`)
                            }
                            openWebLabel={t('page.works.openInWeb')}
                            title={t('page.works.notFound')}
                        />
                    </div>
                </LibraryContainer>
            </AnimatedPage>
        );
    }

    const series = work?.series ?? null;

    return (
        <AnimatedPage key={`work-detail-${workId}`}>
            <NativeScrollArea
                pageHeaderProps={{
                    backgroundColor: 'var(--theme-colors-background)',
                    children: (
                        <LibraryHeaderBar>
                            <LibraryHeaderBar.Title>{work?.title || ''}</LibraryHeaderBar.Title>
                        </LibraryHeaderBar>
                    ),
                    offset: 200,
                }}
            >
                <LibraryContainer>
                    <div className={styles.page} style={{ paddingTop: '3rem' }}>
                        {detailQuery.isPending ? (
                            <Music032PageSkeleton />
                        ) : detailQuery.isError || !work ? (
                            <Music032PageError onRetry={() => detailQuery.refetch()} />
                        ) : (
                            <>
                                <section className={styles.hero}>
                                    <div className={styles.heroPoster}>
                                        <ItemImage
                                            containerClassName={styles.imgBox}
                                            id={workPosterPath(
                                                work.id,
                                                work.posterApiUrl || work.posterUrl,
                                            )}
                                            itemType={LibraryItem.ALBUM}
                                            size={768}
                                        />
                                    </div>
                                    <div className={styles.heroBody}>
                                        <h1 className={styles.heroTitle}>{work.title}</h1>
                                        {work.translatedTitle && (
                                            <h2 className={styles.heroSubtitle}>
                                                {work.translatedTitle}
                                            </h2>
                                        )}
                                        {work.readingTitle && (
                                            <p className={styles.heroReading}>
                                                {work.readingTitle}
                                            </p>
                                        )}
                                        <div className={styles.heroFacts}>
                                            {work.type && (
                                                <span>{workTypeLongLabel(t, work.type)}</span>
                                            )}
                                            {work.year > 0 && <span>{work.year}</span>}
                                            <span>
                                                {t('page.works.albumsCount', {
                                                    count: albums.length,
                                                })}
                                            </span>
                                            <span>
                                                {t('page.works.tracksCount', {
                                                    count: work.trackCount,
                                                })}
                                            </span>
                                            {work.bangumiSubjectId && (
                                                <a
                                                    href={`https://bgm.tv/subject/${work.bangumiSubjectId}`}
                                                    rel="noopener noreferrer"
                                                    target="_blank"
                                                >
                                                    {t('page.works.bangumiLink')} ↗
                                                </a>
                                            )}
                                        </div>
                                        <div className={styles.heroActions}>
                                            <Button
                                                leftSection={<Icon icon="mediaPlay" />}
                                                onClick={() => playWorks([work.id])}
                                                variant="default"
                                            >
                                                {t('page.works.playAll')}
                                            </Button>
                                            <Button
                                                leftSection={<Icon icon="playlistAdd" />}
                                                onClick={() => appendWorks([work.id])}
                                                variant="subtle"
                                            >
                                                {t('page.works.addToQueue')}
                                            </Button>
                                            <Button
                                                leftSection={<Icon icon="externalLink" />}
                                                onClick={() =>
                                                    openMusic032WebPath(
                                                        server ?? null,
                                                        `/admin/works/${work.id}`,
                                                    )
                                                }
                                                variant="subtle"
                                            >
                                                {t('page.works.openInWeb')}
                                            </Button>
                                        </div>
                                    </div>
                                </section>

                                {series && (
                                    <Link
                                        className={styles.seriesBanner}
                                        to={generatePath(AppRoute.LIBRARY_SERIES_DETAIL, {
                                            seriesId: String(series.id),
                                        })}
                                    >
                                        <span className={styles.seriesBadge}>
                                            {t('page.works.seriesBadge')}
                                        </span>
                                        <span className={styles.seriesTitle}>{series.title}</span>
                                        <span className={styles.seriesMeta}>
                                            {t('page.works.seriesPosition', {
                                                count: series.memberCount,
                                                position: series.position,
                                            })}
                                        </span>
                                    </Link>
                                )}

                                <section>
                                    <div className={styles.sectionHead}>
                                        <h2>{t('page.works.albumsTitle')}</h2>
                                        <span className={styles.sectionCount}>
                                            {t('page.works.albumsCount', { count: albums.length })}
                                        </span>
                                    </div>
                                    {albumsQuery.isError ? (
                                        <Music032PageError onRetry={() => albumsQuery.refetch()} />
                                    ) : albums.length === 0 ? (
                                        <Music032PageEmpty title={t('page.works.albumsEmpty')} />
                                    ) : (
                                        <div className={styles.albumGrid}>
                                            {albums.map((album) => {
                                                const usage = usageByAlbum.get(album.albumId) ?? [];
                                                const albumPath = getTitlePath(
                                                    LibraryItem.ALBUM,
                                                    String(album.albumId),
                                                );
                                                return (
                                                    <div
                                                        className={styles.albumBlock}
                                                        key={album.albumId}
                                                    >
                                                        <Music032AlbumCard
                                                            albumId={String(album.albumId)}
                                                            artist={album.artist}
                                                            artworkUrl={album.artworkUrl}
                                                            meta={[
                                                                album.year || null,
                                                                workAlbumRoleLabel(
                                                                    t,
                                                                    album.albumRole || album.role,
                                                                ),
                                                                workSourceLabel(t, album.source),
                                                            ]
                                                                .filter(Boolean)
                                                                .join(' · ')}
                                                            onPlay={() =>
                                                                playAlbum(String(album.albumId))
                                                            }
                                                            roleLabel={workAlbumRoleLabel(
                                                                t,
                                                                album.albumRole || album.role,
                                                            )}
                                                            title={album.title}
                                                            to={albumPath || '#'}
                                                        />
                                                        {usage.length > 0 && (
                                                            <div className={styles.usageList}>
                                                                <p className={styles.usageTitle}>
                                                                    {t('page.works.trackUsage')}
                                                                </p>
                                                                {usage.map((track) => (
                                                                    <div
                                                                        className={styles.usageRow}
                                                                        key={`${track.id}-${track.role}-${track.sequence}`}
                                                                    >
                                                                        <span
                                                                            className={styles.t}
                                                                            title={track.title}
                                                                        >
                                                                            {track.title}
                                                                        </span>
                                                                        <span
                                                                            className={clsx(
                                                                                styles.roleTag,
                                                                            )}
                                                                        >
                                                                            {workRoleSequenceLabel(
                                                                                t,
                                                                                track.role,
                                                                                track.sequence,
                                                                            )}
                                                                        </span>
                                                                        <span
                                                                            className={styles.src}
                                                                        >
                                                                            {workSourceLabel(
                                                                                t,
                                                                                track.source,
                                                                            )}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </section>

                                <section>
                                    <div className={styles.sectionHead}>
                                        <div>
                                            <h2>{t('page.works.collectedTitle')}</h2>
                                            <p className={styles.sectionHint}>
                                                {t('page.works.collectedHint')}
                                            </p>
                                        </div>
                                        <span className={styles.sectionCount}>
                                            {t('page.works.tracksCount', {
                                                count: collectedTracks.length,
                                            })}
                                        </span>
                                    </div>
                                    {tracksQuery.isError ? (
                                        <Music032PageError onRetry={() => tracksQuery.refetch()} />
                                    ) : collectedTracks.length === 0 ? (
                                        <Music032PageEmpty title={t('page.works.collectedEmpty')} />
                                    ) : (
                                        <div className={styles.trackList}>
                                            {collectedTracks.map((track) => {
                                                const song = collectedSongs.get(track.id);
                                                if (!song) return null;
                                                return (
                                                    <Music032SongRow
                                                        key={track.id}
                                                        onPlay={() =>
                                                            playSongs(
                                                                [...collectedSongs.values()],
                                                                song.id,
                                                            )
                                                        }
                                                        role={track.role}
                                                        sequence={track.sequence}
                                                        song={song}
                                                    />
                                                );
                                            })}
                                        </div>
                                    )}
                                </section>
                            </>
                        )}
                    </div>
                </LibraryContainer>
            </NativeScrollArea>
        </AnimatedPage>
    );
};

const WorkDetailRouteWithBoundary = () => (
    <PageErrorBoundary>
        <WorkDetailRoute />
    </PageErrorBoundary>
);

export default WorkDetailRouteWithBoundary;
