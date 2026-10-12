import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ItemImage } from '/@/renderer/components/item-image/item-image';
import { music032HomeQueries } from '/@/renderer/features/home/music032/api/music032-home-api';
import {
    HomeInlineEmpty,
    HomeSection,
    HomeSectionError,
} from '/@/renderer/features/home/music032/components/home-section';
import { workRoleLabel, workTypeLabel } from '/@/renderer/features/home/music032/lib/format';
import { openMusic032Work } from '/@/renderer/features/home/music032/lib/open-music032-web';
import styles from '/@/renderer/features/home/music032/music032-home.module.css';
import { useMusic032HomePlay } from '/@/renderer/features/home/music032/use-music032-home-play';
import { useCurrentServerWithCredential } from '/@/renderer/store';
import { M032HomeWorkCard, M032RotationPage } from '/@/shared/api/music032/music032-types';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Button } from '/@/shared/components/button/button';
import { Icon } from '/@/shared/components/icon/icon';
import { SegmentedControl } from '/@/shared/components/segmented-control/segmented-control';
import { toast } from '/@/shared/components/toast/toast';
import { LibraryItem } from '/@/shared/types/domain-types';

const WORK_FILTERS = ['all', 'anime', 'game', 'movie'] as const;

/** 按作品漫游：类型筛选 + 换一批（每日轮换，generation 过期以服务端为准）。 */
export const HomeWorksRotation = ({ initial }: { initial: M032RotationPage<M032HomeWorkCard> }) => {
    const { t } = useTranslation();
    const server = useCurrentServerWithCredential();
    const { playWorks } = useMusic032HomePlay();
    const shelfRef = useRef<HTMLDivElement>(null);

    const [args, setArgs] = useState({
        batch: initial.batch,
        generation: initial.generation,
        type: initial.type || 'all',
    });

    const isInitialPage =
        args.batch === initial.batch &&
        args.generation === initial.generation &&
        args.type === (initial.type || 'all');

    const query = useQuery({
        ...(server
            ? music032HomeQueries.works(server, args)
            : { enabled: false, queryKey: ['noop'] as const }),
        enabled: Boolean(server),
        ...(isInitialPage ? { initialData: initial } : {}),
    });

    const page = query.data;
    const renewedGenerationRef = useRef<string>('');

    // generation 过期：以服务端返回的新批次为准，并提示一次。
    useEffect(() => {
        if (!page?.renewed || renewedGenerationRef.current === page.generation) return;
        renewedGenerationRef.current = page.generation;
        toast.info({ message: t('page.home.music032.renewNotice') });
        setArgs((prev) => ({ ...prev, batch: page.batch, generation: page.generation }));
    }, [page, t]);

    const handleFilter = (type: string) => {
        setArgs({ batch: 0, generation: page?.generation || initial.generation, type });
    };

    const handleNextBatch = () => {
        if (!page) return;
        setArgs((prev) => ({ ...prev, batch: page.batch + 1 }));
    };

    const scrollShelf = (dir: -1 | 1) => {
        const shelf = shelfRef.current;
        if (shelf) shelf.scrollBy({ behavior: 'smooth', left: dir * shelf.clientWidth * 0.8 });
    };

    return (
        <HomeSection
            count={t('page.home.music032.worksCount', { count: page?.count ?? initial.count })}
            title={t('page.home.music032.worksTitle')}
            tools={
                <>
                    <SegmentedControl
                        data={WORK_FILTERS.map((value) => ({
                            label:
                                value === 'all'
                                    ? t('page.home.music032.filterAll')
                                    : workTypeLabel(t, value),
                            value,
                        }))}
                        onChange={handleFilter}
                        value={args.type}
                    />
                    {(page?.pages ?? 0) > 1 && (
                        <Button
                            leftSection={<Icon icon="refresh" />}
                            onClick={handleNextBatch}
                            size="sm"
                            variant="subtle"
                        >
                            {t('page.home.music032.nextBatch')}
                        </Button>
                    )}
                    <ActionIcon aria-label="prev" onClick={() => scrollShelf(-1)} variant="subtle">
                        <Icon icon="arrowLeftS" />
                    </ActionIcon>
                    <ActionIcon aria-label="next" onClick={() => scrollShelf(1)} variant="subtle">
                        <Icon icon="arrowRightS" />
                    </ActionIcon>
                </>
            }
        >
            {query.isError ? (
                <HomeSectionError onRetry={() => query.refetch()} />
            ) : !page || page.items.length === 0 ? (
                <HomeInlineEmpty
                    hint={t('page.home.music032.worksEmptyHint')}
                    title={t('page.home.music032.worksEmpty')}
                />
            ) : (
                <div aria-busy={query.isFetching} className={styles.worksShelf} ref={shelfRef}>
                    {page.items.map((work) => (
                        <WorkCard key={work.id} onPlay={() => playWorks([work.id])} work={work} />
                    ))}
                </div>
            )}
        </HomeSection>
    );
};

const WorkCard = ({ onPlay, work }: { onPlay: () => void; work: M032HomeWorkCard }) => {
    const { t } = useTranslation();
    const server = useCurrentServerWithCredential();

    return (
        <article className={styles.workCard}>
            <div className={styles.workArt}>
                {work.artworkUrl && (
                    <ItemImage
                        containerClassName={styles.imgBox}
                        id={work.artworkUrl}
                        itemType={LibraryItem.ALBUM}
                        size={256}
                    />
                )}
                <button
                    aria-label={t('player.play')}
                    className={styles.workPlay}
                    onClick={onPlay}
                    type="button"
                >
                    <Icon icon="mediaPlay" />
                </button>
            </div>
            <div className={styles.workBody}>
                <span className={styles.workType}>
                    {workTypeLabel(t, work.workType)}
                    {work.year > 0 && ` · ${work.year}`}
                </span>
                <button
                    className={styles.workTitle}
                    onClick={() => openMusic032Work(server ?? null, work.id)}
                    title={work.title}
                    type="button"
                >
                    {work.title}
                </button>
                {work.roleCounts.length > 0 && (
                    <div className={styles.workRoles}>
                        {work.roleCounts.map((rc) => (
                            <span key={rc.role}>
                                {workRoleLabel(t, rc.role)} {rc.count}
                            </span>
                        ))}
                    </div>
                )}
                {work.series && (
                    <span className={styles.workSeries} title={work.series.title}>
                        {t('page.home.music032.seriesKind')}：{work.series.title}
                    </span>
                )}
            </div>
        </article>
    );
};
