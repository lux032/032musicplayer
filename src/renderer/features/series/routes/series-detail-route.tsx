import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { generatePath, useParams } from 'react-router';

import { Music032ApiError } from '/@/renderer/api/music032/music032-api';
import { ItemImage } from '/@/renderer/components/item-image/item-image';
import { getTitlePath } from '/@/renderer/components/item-list/helpers/get-title-path';
import { NativeScrollArea } from '/@/renderer/components/native-scroll-area/native-scroll-area';
import { workPosterPath, workTypeLongLabel } from '/@/renderer/features/home/music032/lib/format';
import { openMusic032WebPath } from '/@/renderer/features/home/music032/lib/open-music032-web';
import { useSeriesPlayState } from '/@/renderer/features/home/music032/lib/playing-source';
import { useMusic032HomePlay } from '/@/renderer/features/home/music032/use-music032-home-play';
import { seriesQueries } from '/@/renderer/features/series/api/series-api';
import { SeriesUnsupported } from '/@/renderer/features/series/routes/series-list-route';
import { AnimatedPage } from '/@/renderer/features/shared/components/animated-page';
import { LibraryContainer } from '/@/renderer/features/shared/components/library-container';
import { LibraryHeaderBar } from '/@/renderer/features/shared/components/library-header-bar';
import { Music032AlbumCard } from '/@/renderer/features/shared/components/music032/music032-album-card';
import styles from '/@/renderer/features/shared/components/music032/music032-pages.module.css';
import {
    Music032PageEmpty,
    Music032PageError,
    Music032PageNotFound,
    Music032PageSkeleton,
} from '/@/renderer/features/shared/components/music032/music032-states';
import { WorkPosterCard } from '/@/renderer/features/shared/components/music032/work-poster-card';
import { PageErrorBoundary } from '/@/renderer/features/shared/components/page-error-boundary';
import { PlayingIndicator } from '/@/renderer/features/shared/components/playing-indicator/playing-indicator';
import { useMusic032SeriesSupported } from '/@/renderer/features/shared/hooks/use-music032-capabilities';
import { AppRoute } from '/@/renderer/router/routes';
import { useCurrentServerWithCredential } from '/@/renderer/store';
import { M032SeriesMember } from '/@/shared/api/music032/music032-types';
import { Button } from '/@/shared/components/button/button';
import { Icon } from '/@/shared/components/icon/icon';
import { LibraryItem } from '/@/shared/types/domain-types';
import { Play } from '/@/shared/types/types';

/** 按网页规则分组：按成员顺序遍历，每种类型第一次出现时开组。 */
const groupMembersByType = (members: M032SeriesMember[]) => {
    const groups: { members: M032SeriesMember[]; type: string }[] = [];
    for (const member of members) {
        const group = groups.find((g) => g.type === member.workType);
        if (group) group.members.push(member);
        else groups.push({ members: [member], type: member.workType });
    }
    return groups;
};

const SeriesDetailRoute = () => {
    const { t } = useTranslation();
    const { seriesId = '' } = useParams();
    const id = Number(seriesId);
    const server = useCurrentServerWithCredential();
    const seriesSupported = useMusic032SeriesSupported();
    const { playAlbum, playSeries, playWorks } = useMusic032HomePlay();

    const enabled = Boolean(server) && Number.isFinite(id) && seriesSupported;
    const detailQuery = useQuery({
        ...(server && enabled
            ? seriesQueries.detail(server, id)
            : { enabled: false, queryKey: ['noop'] as const }),
        enabled,
    });
    const albumsQuery = useQuery({
        ...(server && enabled
            ? seriesQueries.albums(server, id)
            : { enabled: false, queryKey: ['noop'] as const }),
        enabled,
    });

    const detail = detailQuery.data;
    const playState = useSeriesPlayState(server?.id, id);

    const groups = useMemo(() => (detail ? groupMembersByType(detail.members) : []), [detail]);
    const showGroupHeads = groups.length > 1;

    const isUnsupported =
        !seriesSupported ||
        (detailQuery.error instanceof Music032ApiError &&
            detailQuery.error.status === 404 &&
            !detail);

    if (
        detailQuery.error instanceof Music032ApiError &&
        detailQuery.error.status === 404 &&
        detailQuery.data === undefined &&
        seriesSupported
    ) {
        // 404 可能是"系列不存在"，也可能是旧服务端根本没有系列接口：
        // 有能力位但详情 404 按 not_found 处理；没有能力位走 unsupported。
        return (
            <AnimatedPage>
                <LibraryContainer>
                    <div className={styles.page} style={{ paddingTop: '3rem' }}>
                        <Music032PageNotFound
                            backTo={AppRoute.LIBRARY_SERIES}
                            backToLabel={t('page.series.backToSeries')}
                            hint={t('page.series.notFoundHint')}
                            onOpenWeb={() =>
                                openMusic032WebPath(server ?? null, `/admin/series/${seriesId}`)
                            }
                            openWebLabel={t('page.series.openInWeb')}
                            title={t('page.series.notFound')}
                        />
                    </div>
                </LibraryContainer>
            </AnimatedPage>
        );
    }

    const stats = detail?.stats;
    const series = detail?.series;

    return (
        <AnimatedPage key={`series-detail-${seriesId}`}>
            <NativeScrollArea
                pageHeaderProps={{
                    backgroundColor: 'var(--theme-colors-background)',
                    children: (
                        <LibraryHeaderBar>
                            <LibraryHeaderBar.Title>{series?.title || ''}</LibraryHeaderBar.Title>
                        </LibraryHeaderBar>
                    ),
                    offset: 200,
                }}
            >
                <LibraryContainer>
                    <div className={styles.page} style={{ paddingTop: '3rem' }}>
                        {isUnsupported ? (
                            <SeriesUnsupported />
                        ) : detailQuery.isPending ? (
                            <Music032PageSkeleton />
                        ) : detailQuery.isError || !detail || !series ? (
                            <Music032PageError onRetry={() => detailQuery.refetch()} />
                        ) : (
                            <>
                                <section className={styles.hero}>
                                    <div className={styles.heroPoster}>
                                        {series.posterUrl ? (
                                            <ItemImage
                                                containerClassName={styles.imgBox}
                                                id={workPosterPath(
                                                    series.representativeWorkId,
                                                    series.posterUrl,
                                                )}
                                                itemType={LibraryItem.ALBUM}
                                                size={768}
                                            />
                                        ) : (
                                            <span className={styles.placeholder}>作</span>
                                        )}
                                    </div>
                                    <div className={styles.heroBody}>
                                        <h1 className={styles.heroTitle}>
                                            {playState && (
                                                <PlayingIndicator
                                                    className={styles.currentMark}
                                                    state={playState}
                                                />
                                            )}{' '}
                                            {series.title}
                                        </h1>
                                        <div className={styles.heroFacts}>
                                            <span>
                                                {t('page.series.memberCount', {
                                                    count: stats?.memberCount ?? series.memberCount,
                                                })}
                                            </span>
                                            {series.titleSource === 'manual' && (
                                                <span className={styles.renamedBadge}>
                                                    {t('page.series.renamedBadge')}
                                                </span>
                                            )}
                                            {stats && stats.yearFrom > 0 && (
                                                <span>
                                                    {t('page.series.yearRange', {
                                                        from: stats.yearFrom,
                                                        to: stats.yearTo,
                                                    })}
                                                </span>
                                            )}
                                            {stats && (
                                                <span>
                                                    {t('page.home.music032.albumCount', {
                                                        count: stats.albumCount,
                                                    })}{' '}
                                                    ·{' '}
                                                    {t('page.works.tracksCount', {
                                                        count: stats.trackCount,
                                                    })}
                                                </span>
                                            )}
                                        </div>
                                        <div className={styles.heroActions}>
                                            <Button
                                                leftSection={<Icon icon="mediaPlay" />}
                                                onClick={() => playSeries(id)}
                                                variant="default"
                                            >
                                                {t('page.series.playAll')}
                                            </Button>
                                            <Button
                                                leftSection={<Icon icon="playlistAdd" />}
                                                onClick={() => playSeries(id, Play.LAST)}
                                                variant="subtle"
                                            >
                                                {t('page.series.addToQueue')}
                                            </Button>
                                            <Button
                                                leftSection={<Icon icon="externalLink" />}
                                                onClick={() =>
                                                    openMusic032WebPath(
                                                        server ?? null,
                                                        `/admin/series/${id}`,
                                                    )
                                                }
                                                variant="subtle"
                                            >
                                                {t('page.series.openInWeb')}
                                            </Button>
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <div className={styles.sectionHead}>
                                        <h2>{t('page.series.membersTitle')}</h2>
                                        <span className={styles.sectionCount}>
                                            {t('page.series.memberCount', {
                                                count: detail.members.length,
                                            })}
                                        </span>
                                    </div>
                                    {detail.members.length === 0 ? (
                                        <Music032PageEmpty title={t('page.series.empty')} />
                                    ) : (
                                        groups.map((group) => (
                                            <div key={group.type || 'unknown'}>
                                                {showGroupHeads && (
                                                    <h3 className={styles.typeGroupHead}>
                                                        {workTypeLongLabel(t, group.type)}
                                                    </h3>
                                                )}
                                                <div className={styles.posterGrid}>
                                                    {group.members.map((member) => (
                                                        <WorkPosterCard
                                                            key={member.id}
                                                            onPlay={() => playWorks([member.id])}
                                                            posterPath={workPosterPath(
                                                                member.id,
                                                                member.posterUrl,
                                                            )}
                                                            subtitle={
                                                                member.translatedTitle ||
                                                                member.readingTitle ||
                                                                undefined
                                                            }
                                                            title={member.title}
                                                            to={generatePath(
                                                                AppRoute.LIBRARY_WORKS_DETAIL,
                                                                { workId: String(member.id) },
                                                            )}
                                                            trackCount={member.trackCount}
                                                            workId={member.id}
                                                            workType={member.workType}
                                                            year={member.year}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </section>

                                <section>
                                    <div className={styles.sectionHead}>
                                        <h2>{t('page.series.albumsTitle')}</h2>
                                        <span className={styles.sectionCount}>
                                            {t('page.home.music032.albumCount', {
                                                count: albumsQuery.data?.items.length ?? 0,
                                            })}
                                        </span>
                                    </div>
                                    {albumsQuery.isError ? (
                                        <Music032PageError onRetry={() => albumsQuery.refetch()} />
                                    ) : (albumsQuery.data?.items.length ?? 0) === 0 ? (
                                        <Music032PageEmpty title={t('page.works.albumsEmpty')} />
                                    ) : (
                                        <div className={styles.posterGrid}>
                                            {albumsQuery.data!.items.map((entry) => (
                                                <Music032AlbumCard
                                                    albumId={String(entry.album.albumId)}
                                                    artist={entry.album.artist}
                                                    artworkUrl={entry.album.artworkUrl}
                                                    key={entry.album.albumId}
                                                    meta={[
                                                        entry.workTitle,
                                                        entry.album.year || null,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' · ')}
                                                    onPlay={() =>
                                                        playAlbum(String(entry.album.albumId))
                                                    }
                                                    title={entry.album.title}
                                                    to={
                                                        getTitlePath(
                                                            LibraryItem.ALBUM,
                                                            String(entry.album.albumId),
                                                        ) || '#'
                                                    }
                                                />
                                            ))}
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

const SeriesDetailRouteWithBoundary = () => (
    <PageErrorBoundary>
        <SeriesDetailRoute />
    </PageErrorBoundary>
);

export default SeriesDetailRouteWithBoundary;
