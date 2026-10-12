import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { m032Context } from '/@/renderer/api/music032/music032-api';
import { DataRow } from '/@/renderer/components/item-card/item-card';
import { useDefaultItemListControls } from '/@/renderer/components/item-list/helpers/item-list-controls';
import { music032HomeQueries } from '/@/renderer/features/home/music032/api/music032-home-api';
import { HomeAlbumCard } from '/@/renderer/features/home/music032/components/home-album-card';
import {
    HomeInlineEmpty,
    HomeSection,
    HomeSectionError,
} from '/@/renderer/features/home/music032/components/home-section';
import styles from '/@/renderer/features/home/music032/music032-home.module.css';
import { AppRoute } from '/@/renderer/router/routes';
import { useCurrentServerWithCredential } from '/@/renderer/store';
import { m032Normalize } from '/@/shared/api/music032/music032-normalize';
import { M032HomeChronicle } from '/@/shared/api/music032/music032-types';
import { Icon } from '/@/shared/components/icon/icon';
import { Album } from '/@/shared/types/domain-types';

/** 编年：按发行年份的柱状图，点击柱子切换那一年入库的专辑。 */
export const HomeChronicle = ({ chronicle }: { chronicle: M032HomeChronicle }) => {
    const { t } = useTranslation();
    const server = useCurrentServerWithCredential();
    const controls = useDefaultItemListControls();
    const [selectedYear, setSelectedYear] = useState(chronicle.selectedYear);

    const query = useQuery({
        ...(server
            ? music032HomeQueries.chronicle(server, selectedYear)
            : { enabled: false, queryKey: ['noop'] as const }),
        enabled: Boolean(server),
        ...(selectedYear === chronicle.selectedYear ? { initialData: chronicle.result } : {}),
    });

    const maxCount = useMemo(
        () => Math.max(1, ...chronicle.years.map((y) => y.count)),
        [chronicle.years],
    );

    const result = query.data;

    const items = useMemo(() => {
        const ctx = m032Context(server);
        return (result?.albums || []).map((album) => m032Normalize.album(ctx, album));
    }, [result, server]);

    const rows: DataRow[] = useMemo(
        () => [
            { format: (data) => (data as Album).name, id: 'name' },
            {
                format: (data) => (data as Album).albumArtistName,
                id: 'artists',
                isMuted: true,
            },
        ],
        [],
    );

    return (
        <HomeSection
            count={t('page.home.music032.chronicleHint')}
            title={t('page.home.music032.chronicle')}
        >
            <div
                aria-label={t('page.home.music032.chronicle')}
                className={styles.yearChart}
                role="group"
            >
                {chronicle.years.map(({ count, year }) => (
                    <button
                        aria-label={`${year} · ${count}`}
                        aria-pressed={year === selectedYear}
                        className={styles.yearBar}
                        key={year}
                        onClick={() => setSelectedYear(year)}
                        style={
                            {
                                '--h': `${Math.max(3, Math.round((count / maxCount) * 100))}%`,
                            } as React.CSSProperties
                        }
                        type="button"
                    >
                        <b>{count}</b>
                        <i />
                    </button>
                ))}
            </div>
            <div aria-hidden className={styles.yearAxis}>
                {chronicle.years.map(({ year }, index) => (
                    <span
                        className={
                            year === selectedYear
                                ? styles.on
                                : index % 2 !== 0
                                  ? styles.dim
                                  : undefined
                        }
                        key={year}
                    >
                        {year}
                    </span>
                ))}
            </div>
            {query.isError ? (
                <HomeSectionError onRetry={() => query.refetch()} />
            ) : !result || result.albums.length === 0 ? (
                <HomeInlineEmpty
                    hint={t('page.home.music032.chronicleEmptyHint')}
                    title={t('page.home.music032.chronicleEmpty', { year: selectedYear })}
                />
            ) : (
                <>
                    <div className={styles.sectionHead}>
                        <h3 className={styles.sectionTitle} style={{ fontSize: '1.05rem' }}>
                            {t('page.home.music032.chronicleYear', { year: result.year })}
                        </h3>
                        <span className={styles.sectionCount}>
                            {t('page.home.music032.albumCount', { count: result.total })}
                        </span>
                        <div className={styles.sectionTools}>
                            <Link className={styles.sectionLink} to={AppRoute.LIBRARY_ALBUMS}>
                                {t('page.home.music032.viewAll')}
                                <Icon icon="arrowRightS" />
                            </Link>
                        </div>
                    </div>
                    <div className={styles.shelf}>
                        {items.map((album) => (
                            <HomeAlbumCard
                                album={album}
                                controls={controls}
                                key={album.id}
                                rows={rows}
                            />
                        ))}
                    </div>
                </>
            )}
        </HomeSection>
    );
};
