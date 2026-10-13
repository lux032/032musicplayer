import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { generatePath, Link } from 'react-router';

import { m032ApiClient, Music032ApiError } from '/@/renderer/api/music032/music032-api';
import { queryKeys } from '/@/renderer/api/query-keys';
import { ItemImage } from '/@/renderer/components/item-image/item-image';
import { NativeScrollArea } from '/@/renderer/components/native-scroll-area/native-scroll-area';
import { workPosterPath, workTypeLongLabel } from '/@/renderer/features/home/music032/lib/format';
import { openMusic032WebPath } from '/@/renderer/features/home/music032/lib/open-music032-web';
import { AnimatedPage } from '/@/renderer/features/shared/components/animated-page';
import { LibraryContainer } from '/@/renderer/features/shared/components/library-container';
import { LibraryHeaderBar } from '/@/renderer/features/shared/components/library-header-bar';
import styles from '/@/renderer/features/shared/components/music032/music032-pages.module.css';
import {
    Music032PageEmpty,
    Music032PageError,
    Music032PageSkeleton,
} from '/@/renderer/features/shared/components/music032/music032-states';
import { PageErrorBoundary } from '/@/renderer/features/shared/components/page-error-boundary';
import { useMusic032SeriesSupported } from '/@/renderer/features/shared/hooks/use-music032-capabilities';
import { AppRoute } from '/@/renderer/router/routes';
import { useCurrentServerWithCredential } from '/@/renderer/store';
import { M032Page, M032Series } from '/@/shared/api/music032/music032-types';
import { Button } from '/@/shared/components/button/button';
import { Icon } from '/@/shared/components/icon/icon';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { TextInput } from '/@/shared/components/text-input/text-input';
import { LibraryItem } from '/@/shared/types/domain-types';

const PAGE_SIZE = 50;

/** 系列接口缺失（能力位或 404）时的降级块：引导去网页端。 */
export const SeriesUnsupported = () => {
    const { t } = useTranslation();
    const server = useCurrentServerWithCredential();
    return (
        <div className={styles.stateBlock}>
            <h2>{t('page.series.unsupported')}</h2>
            <p>{t('page.series.unsupportedHint')}</p>
            <div className={styles.stateActions}>
                <Button
                    leftSection={<Icon icon="externalLink" />}
                    onClick={() => openMusic032WebPath(server ?? null, '/admin/series')}
                    variant="default"
                >
                    {t('page.series.openInWeb')}
                </Button>
            </div>
        </div>
    );
};

const SeriesListRoute = () => {
    const { t } = useTranslation();
    const server = useCurrentServerWithCredential();
    const seriesSupported = useMusic032SeriesSupported();

    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    useEffect(() => {
        const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => clearTimeout(id);
    }, [search]);

    const enabled = Boolean(server) && seriesSupported;

    const query = useInfiniteQuery({
        enabled,
        getNextPageParam: (lastPage: M032Page<M032Series>, pages: M032Page<M032Series>[]) => {
            const loaded = pages.reduce((sum, page) => sum + page.items.length, 0);
            return loaded < lastPage.total ? loaded : undefined;
        },
        initialPageParam: 0,
        queryFn: ({ pageParam, signal }) =>
            m032ApiClient({ server, signal }).get<M032Page<M032Series>>('/series', {
                query: {
                    limit: PAGE_SIZE,
                    offset: pageParam as number,
                    q: debouncedSearch || undefined,
                },
            }),
        queryKey: queryKeys.series.list(server?.id || '', {
            limit: PAGE_SIZE,
            q: debouncedSearch,
        }),
        staleTime: 1000 * 60,
    });

    const series = useMemo(
        () => query.data?.pages.flatMap((page) => page.items) ?? [],
        [query.data],
    );
    const total = query.data?.pages[0]?.total;

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

    const isUnsupported =
        !seriesSupported || (query.error instanceof Music032ApiError && query.error.status === 404);

    return (
        <AnimatedPage>
            <NativeScrollArea
                pageHeaderProps={{
                    backgroundColor: 'var(--theme-colors-background)',
                    children: (
                        <LibraryHeaderBar>
                            <LibraryHeaderBar.Title>
                                {t('page.series.title')}
                            </LibraryHeaderBar.Title>
                        </LibraryHeaderBar>
                    ),
                    offset: 200,
                }}
            >
                <LibraryContainer>
                    <div className={styles.page} style={{ paddingTop: '3rem' }}>
                        <h1 className={styles.pageTitle}>{t('page.series.title')}</h1>
                        {isUnsupported ? (
                            <SeriesUnsupported />
                        ) : (
                            <>
                                <div className={styles.toolbar}>
                                    <TextInput
                                        aria-label={t('common.search', {
                                            postProcess: 'sentenceCase',
                                        })}
                                        className={styles.search}
                                        onChange={(e) => setSearch(e.currentTarget.value)}
                                        placeholder={t('page.series.searchPlaceholder')}
                                        value={search}
                                    />
                                    <span className={styles.spacer} />
                                    {total !== undefined && (
                                        <span className={styles.sectionCount}>
                                            {t('page.series.count', { count: total })}
                                        </span>
                                    )}
                                </div>
                                {query.isPending ? (
                                    <Music032PageSkeleton />
                                ) : query.isError ? (
                                    <Music032PageError onRetry={() => query.refetch()} />
                                ) : series.length === 0 ? (
                                    <Music032PageEmpty
                                        hint={t('page.series.emptyHint')}
                                        title={t('page.series.empty')}
                                    />
                                ) : (
                                    <>
                                        <div className={styles.seriesRows}>
                                            {series.map((entry) => (
                                                <SeriesRow entry={entry} key={entry.id} />
                                            ))}
                                        </div>
                                        <div ref={sentinelRef} />
                                        {isFetchingNextPage && <Spinner container />}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </LibraryContainer>
            </NativeScrollArea>
        </AnimatedPage>
    );
};

const SeriesRow = ({ entry }: { entry: M032Series }) => {
    const { t } = useTranslation();
    const typeSpread = entry.typeCounts
        .map((tc) => `${workTypeLongLabel(t, tc.type)} ${tc.count}`)
        .join(' · ');

    return (
        <Link
            className={styles.seriesRow}
            to={generatePath(AppRoute.LIBRARY_SERIES_DETAIL, { seriesId: String(entry.id) })}
        >
            <div className={styles.seriesRowPoster}>
                {entry.posterUrl ? (
                    <ItemImage
                        containerClassName={styles.imgBox}
                        id={workPosterPath(entry.representativeWorkId, entry.posterUrl)}
                        itemType={LibraryItem.ALBUM}
                        size={360}
                    />
                ) : (
                    <span className={styles.placeholder}>作</span>
                )}
            </div>
            <div className={styles.seriesRowInfo}>
                <span className={styles.seriesRowTitle}>
                    {entry.title}
                    {entry.titleSource === 'manual' && (
                        <span className={styles.renamedBadge}>{t('page.series.renamedBadge')}</span>
                    )}
                </span>
                <span className={styles.seriesRowMeta}>
                    {t('page.series.memberCount', { count: entry.memberCount })}
                    {typeSpread ? ` · ${typeSpread}` : ''}
                </span>
            </div>
            <Icon icon="arrowRightS" />
        </Link>
    );
};

const SeriesListRouteWithBoundary = () => (
    <PageErrorBoundary>
        <SeriesListRoute />
    </PageErrorBoundary>
);

export default SeriesListRouteWithBoundary;
