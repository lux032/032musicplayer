import { useQuery } from '@tanstack/react-query';
import { ReactNode, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { Music032ApiError } from '/@/renderer/api/music032/music032-api';
import { NativeScrollArea } from '/@/renderer/components/native-scroll-area/native-scroll-area';
import { dailyMixQueries } from '/@/renderer/features/daily-mix/api/daily-mix-api';
import { HomeDailyMixes } from '/@/renderer/features/daily-mix/components/home-daily-mixes';
import { music032HomeQueries } from '/@/renderer/features/home/music032/api/music032-home-api';
import { HomeChronicle } from '/@/renderer/features/home/music032/components/home-chronicle';
import { HomeFirstRun } from '/@/renderer/features/home/music032/components/home-first-run';
import { HomePlaylists } from '/@/renderer/features/home/music032/components/home-playlists';
import { HomeRecentAlbums } from '/@/renderer/features/home/music032/components/home-recent-albums';
import { HomeRecentPlayed } from '/@/renderer/features/home/music032/components/home-recent-played';
import {
    HomeResume,
    RESUME_VISIBLE_COUNT,
} from '/@/renderer/features/home/music032/components/home-resume';
import { HomeSectionError } from '/@/renderer/features/home/music032/components/home-section';
import { HomeSongsRotation } from '/@/renderer/features/home/music032/components/home-songs-rotation';
import { HomeSpotlight } from '/@/renderer/features/home/music032/components/home-spotlight';
import { HomeStatsFooter } from '/@/renderer/features/home/music032/components/home-stats-footer';
import { HomeWorksRotation } from '/@/renderer/features/home/music032/components/home-works-rotation';
import styles from '/@/renderer/features/home/music032/music032-home.module.css';
import { AnimatedPage } from '/@/renderer/features/shared/components/animated-page';
import { LibraryContainer } from '/@/renderer/features/shared/components/library-container';
import { LibraryHeaderBar } from '/@/renderer/features/shared/components/library-header-bar';
import { useMusic032DailyMixesSupported } from '/@/renderer/features/shared/hooks/use-music032-capabilities';
import { useCurrentServerWithCredential, useWindowSettings } from '/@/renderer/store';
import { Skeleton } from '/@/shared/components/skeleton/skeleton';
import { Platform } from '/@/shared/types/types';

const Music032HomeSkeleton = () => (
    <>
        <Skeleton borderRadius="20px" height={320} />
        <div className={styles.duo}>
            <Skeleton borderRadius="14px" height={280} />
            <Skeleton borderRadius="14px" height={280} />
        </div>
        <Skeleton borderRadius="14px" height={180} />
        <Skeleton borderRadius="14px" height={240} />
    </>
);

/** Left duo column height in rows (web homeColumnRows); 最近播放 keeps at least 2. */
const COLUMN_ROWS = 7;
const MIN_RECENT_ROWS = 2;
const NO_EXCLUDES: number[] = [];

/**
 * 032 主页。后端没有主页接口时（404）回退到 feishin 默认主页（fallback）。
 */
export const Music032HomeRoute = ({ fallback }: { fallback: ReactNode }) => {
    const { t } = useTranslation();
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const server = useCurrentServerWithCredential();
    const { windowBarStyle } = useWindowSettings();

    const query = useQuery({
        ...(server
            ? music032HomeQueries.overview(server)
            : { enabled: false, queryKey: ['noop'] as const }),
        enabled: Boolean(server),
    });

    // 今日推荐（能力位 features.dailyMixes）。有歌单时它占掉接着听的位置，
    // 最近播放缩到 max(2, 7 - 歌单数) 行，左栏总高度与网页一致。
    const dailyMixesSupported = useMusic032DailyMixesSupported();
    const mixesQuery = useQuery({
        ...(server && dailyMixesSupported
            ? dailyMixQueries.list(server)
            : { enabled: false, queryKey: ['noop'] as const }),
        enabled: Boolean(server) && dailyMixesSupported,
    });
    const mixes = mixesQuery.data?.items ?? [];
    const mixesGenerating = mixesQuery.data?.status === 'generating';
    const showMixes = mixes.length > 0;

    // 后端还没有主页接口：回退到 feishin 默认主页。
    if (
        query.error instanceof Music032ApiError &&
        (query.error.status === 404 || query.error.status === 501)
    ) {
        return <>{fallback}</>;
    }

    const data = query.data;

    return (
        <AnimatedPage>
            <NativeScrollArea
                pageHeaderProps={{
                    backgroundColor: 'var(--theme-colors-background)',
                    children: (
                        <LibraryHeaderBar>
                            <LibraryHeaderBar.Title>{t('page.home.title')}</LibraryHeaderBar.Title>
                        </LibraryHeaderBar>
                    ),
                    offset: 200,
                }}
                ref={scrollAreaRef}
            >
                <LibraryContainer>
                    <div
                        className={styles.page}
                        style={{
                            paddingBottom: '5rem',
                            paddingLeft: '2rem',
                            paddingRight: '2rem',
                            paddingTop: windowBarStyle === Platform.WEB ? '5rem' : '3rem',
                        }}
                    >
                        {query.isPending ? (
                            <Music032HomeSkeleton />
                        ) : query.isError || !data ? (
                            <HomeSectionError onRetry={() => query.refetch()} />
                        ) : data.empty ? (
                            <HomeFirstRun />
                        ) : (
                            <>
                                {data.spotlight && <HomeSpotlight spotlight={data.spotlight} />}
                                <div className={styles.duo}>
                                    <div className={styles.duoMain}>
                                        {(showMixes || mixesGenerating) && (
                                            <HomeDailyMixes
                                                generating={mixesGenerating}
                                                mixes={mixes}
                                            />
                                        )}
                                        {showMixes ? (
                                            <HomeRecentPlayed
                                                count={Math.max(
                                                    MIN_RECENT_ROWS,
                                                    COLUMN_ROWS - mixes.length,
                                                )}
                                                excludeTrackIds={NO_EXCLUDES}
                                            />
                                        ) : (
                                            <>
                                                <HomeRecentPlayed
                                                    excludeTrackIds={data.resume
                                                        .slice(0, RESUME_VISIBLE_COUNT)
                                                        .map((r) => r.trackId)}
                                                />
                                                <HomeResume records={data.resume} />
                                            </>
                                        )}
                                    </div>
                                    {data.recentAlbums.length > 0 && (
                                        <HomeRecentAlbums albums={data.recentAlbums} />
                                    )}
                                </div>
                                {data.works.count > 0 && <HomeWorksRotation initial={data.works} />}
                                {data.songs.count > 0 && <HomeSongsRotation initial={data.songs} />}
                                {data.chronicle && <HomeChronicle chronicle={data.chronicle} />}
                                {data.playlists.length > 0 && (
                                    <HomePlaylists playlists={data.playlists} />
                                )}
                                <HomeStatsFooter stats={data.stats} />
                            </>
                        )}
                    </div>
                </LibraryContainer>
            </NativeScrollArea>
        </AnimatedPage>
    );
};
