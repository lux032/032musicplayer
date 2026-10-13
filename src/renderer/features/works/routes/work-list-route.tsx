import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { m032ApiClient } from '/@/renderer/api/music032/music032-api';
import { queryKeys } from '/@/renderer/api/query-keys';
import { NativeScrollArea } from '/@/renderer/components/native-scroll-area/native-scroll-area';
import { workPosterPath } from '/@/renderer/features/home/music032/lib/format';
import { useMusic032HomePlay } from '/@/renderer/features/home/music032/use-music032-home-play';
import { AnimatedPage } from '/@/renderer/features/shared/components/animated-page';
import { LibraryContainer } from '/@/renderer/features/shared/components/library-container';
import { LibraryHeaderBar } from '/@/renderer/features/shared/components/library-header-bar';
import styles from '/@/renderer/features/shared/components/music032/music032-pages.module.css';
import {
    Music032PageEmpty,
    Music032PageError,
    Music032PageSkeleton,
} from '/@/renderer/features/shared/components/music032/music032-states';
import { WorkPosterCard } from '/@/renderer/features/shared/components/music032/work-poster-card';
import { PageErrorBoundary } from '/@/renderer/features/shared/components/page-error-boundary';
import { useCurrentServerWithCredential } from '/@/renderer/store';
import { M032Page, M032Work } from '/@/shared/api/music032/music032-types';
import { SegmentedControl } from '/@/shared/components/segmented-control/segmented-control';
import { Select } from '/@/shared/components/select/select';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { TextInput } from '/@/shared/components/text-input/text-input';

const PAGE_SIZE = 60;
const WORK_TYPES = ['anime', 'drama', 'movie', 'game', 'commercial', 'other'] as const;
const SORTS = ['title', 'year', 'updated'] as const;

const WorkListRoute = () => {
    const { t } = useTranslation();
    const server = useCurrentServerWithCredential();
    const { playWorks } = useMusic032HomePlay();

    const [search, setSearch] = useState('');
    const [type, setType] = useState('');
    const [sort, setSort] = useState<string>('title');

    const [debouncedSearch, setDebouncedSearch] = useState('');
    useEffect(() => {
        const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => clearTimeout(id);
    }, [search]);

    const args = useMemo(() => ({ q: debouncedSearch, sort, type }), [debouncedSearch, sort, type]);

    const query = useInfiniteQuery({
        enabled: Boolean(server),
        getNextPageParam: (lastPage: M032Page<M032Work>, pages: M032Page<M032Work>[]) => {
            const loaded = pages.reduce((sum, page) => sum + page.items.length, 0);
            return loaded < lastPage.total ? loaded : undefined;
        },
        initialPageParam: 0,
        queryFn: ({ pageParam, signal }) =>
            m032ApiClient({ server, signal }).get<M032Page<M032Work>>('/works', {
                query: {
                    limit: PAGE_SIZE,
                    offset: pageParam as number,
                    q: args.q || undefined,
                    sort: args.sort || undefined,
                    type: args.type || undefined,
                },
            }),
        queryKey: queryKeys.works.list(server?.id || '', args),
        staleTime: 1000 * 60,
    });

    const works = useMemo(
        () => query.data?.pages.flatMap((page) => page.items) ?? [],
        [query.data],
    );
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

    return (
        <AnimatedPage>
            <NativeScrollArea
                pageHeaderProps={{
                    backgroundColor: 'var(--theme-colors-background)',
                    children: (
                        <LibraryHeaderBar>
                            <LibraryHeaderBar.Title>{t('page.works.title')}</LibraryHeaderBar.Title>
                        </LibraryHeaderBar>
                    ),
                    offset: 200,
                }}
            >
                <LibraryContainer>
                    <div className={styles.page} style={{ paddingTop: '3rem' }}>
                        <div className={styles.toolbar}>
                            <TextInput
                                aria-label={t('common.search', { postProcess: 'sentenceCase' })}
                                className={styles.search}
                                onChange={(e) => setSearch(e.currentTarget.value)}
                                placeholder={t('page.works.searchPlaceholder')}
                                value={search}
                            />
                            <Select
                                aria-label={t('page.works.filterType')}
                                data={[
                                    { label: t('page.home.music032.filterAll'), value: '' },
                                    ...WORK_TYPES.map((value) => ({
                                        label:
                                            value === 'anime'
                                                ? t('page.home.music032.filterAnime')
                                                : value === 'game'
                                                  ? t('page.home.music032.filterGame')
                                                  : value === 'movie'
                                                    ? t('page.home.music032.filterMovie')
                                                    : value === 'drama'
                                                      ? t('page.works.typeDrama')
                                                      : value === 'commercial'
                                                        ? t('page.works.typeCommercial')
                                                        : t('page.home.music032.workTypeOther'),
                                        value,
                                    })),
                                ]}
                                onChange={(value) => setType(value || '')}
                                value={type}
                            />
                            <SegmentedControl
                                aria-label={t('page.works.sort')}
                                data={SORTS.map((value) => ({
                                    label:
                                        value === 'title'
                                            ? t('page.works.sortTitle')
                                            : value === 'year'
                                              ? t('page.works.sortYear')
                                              : t('page.works.sortUpdated'),
                                    value,
                                }))}
                                onChange={setSort}
                                value={sort}
                            />
                            <span className={styles.spacer} />
                            {total !== undefined && (
                                <span className={styles.sectionCount}>
                                    {t('page.works.count', { count: total })}
                                </span>
                            )}
                        </div>
                        {query.isPending ? (
                            <Music032PageSkeleton />
                        ) : query.isError ? (
                            <Music032PageError onRetry={() => query.refetch()} />
                        ) : works.length === 0 ? (
                            <Music032PageEmpty
                                hint={t('page.works.emptyHint')}
                                title={t('page.works.empty')}
                            />
                        ) : (
                            <>
                                <div className={styles.posterGrid}>
                                    {works.map((work) => (
                                        <WorkPosterCard
                                            key={work.id}
                                            onPlay={() => playWorks([work.id])}
                                            posterPath={workPosterPath(work.id, work.posterUrl)}
                                            subtitle={
                                                work.translatedTitle ||
                                                work.readingTitle ||
                                                undefined
                                            }
                                            title={work.title}
                                            to={`/library/works/${work.id}`}
                                            trackCount={work.trackCount}
                                            workId={work.id}
                                            workType={work.type}
                                            year={work.year}
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

const WorkListRouteWithBoundary = () => (
    <PageErrorBoundary>
        <WorkListRoute />
    </PageErrorBoundary>
);

export default WorkListRouteWithBoundary;
