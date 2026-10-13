import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { ItemImage } from '/@/renderer/components/item-image/item-image';
import { getTitlePath } from '/@/renderer/components/item-list/helpers/get-title-path';
import {
    SpotlightPaneProps,
    SpotlightTabs,
} from '/@/renderer/features/home/music032/components/home-spotlight';
import { workTypeLabel } from '/@/renderer/features/home/music032/lib/format';
import {
    openMusic032WebPath,
    useOpenMusic032Series,
    useOpenMusic032Work,
} from '/@/renderer/features/home/music032/lib/open-music032-web';
import styles from '/@/renderer/features/home/music032/music032-home.module.css';
import { useMusic032HomePlay } from '/@/renderer/features/home/music032/use-music032-home-play';
import { useCurrentServerWithCredential } from '/@/renderer/store';
import { M032HomeSeriesPane } from '/@/shared/api/music032/music032-types';
import { Button } from '/@/shared/components/button/button';
import { Icon } from '/@/shared/components/icon/icon';
import { LibraryItem } from '/@/shared/types/domain-types';

interface SpotlightSeriesPaneComponentProps extends SpotlightPaneProps {
    pane: M032HomeSeriesPane;
}

/** 作品聚焦页签：系列（或关联曲目最多的单部作品）。 */
export const SpotlightSeriesPane = ({
    activeTab,
    onSwitchTab,
    pane,
    tabs,
}: SpotlightSeriesPaneComponentProps) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const server = useCurrentServerWithCredential();
    const openSeries = useOpenMusic032Series();
    const openWork = useOpenMusic032Work();
    const { playWorks } = useMusic032HomePlay();

    const fanArtworks = pane.albums
        .slice(0, 3)
        .map((entry) => entry.album.artworkUrl)
        .filter((url): url is string => Boolean(url));

    const yearRange =
        pane.yearFrom > 0 && pane.yearTo > 0
            ? pane.yearFrom === pane.yearTo
                ? String(pane.yearFrom)
                : `${pane.yearFrom}-${pane.yearTo}`
            : null;

    const openTitleTarget = () => {
        if (pane.isSeries) {
            openSeries(pane.seriesId);
        } else if (pane.works[0]) {
            openWork(pane.works[0].work.id);
        }
    };

    return (
        <section className={styles.hero}>
            <div aria-hidden className={styles.heroBg}>
                {fanArtworks[0] && (
                    <ItemImage
                        containerClassName={styles.imgBox}
                        id={fanArtworks[0]}
                        itemType={LibraryItem.ALBUM}
                        size={512}
                    />
                )}
            </div>
            <div className={styles.heroInner}>
                <div className={`${styles.heroArt} ${styles.isFan}`}>
                    <div className={styles.heroFan}>
                        {fanArtworks.map((url) => (
                            <ItemImage
                                containerClassName={styles.imgBox}
                                id={url}
                                itemType={LibraryItem.ALBUM}
                                key={url}
                                size={512}
                            />
                        ))}
                    </div>
                </div>
                <div className={styles.heroInfo}>
                    <SpotlightTabs activeTab={activeTab} onSwitchTab={onSwitchTab} tabs={tabs} />
                    <h2 className={styles.heroTitle} title={pane.title}>
                        {pane.title}
                    </h2>
                    <p className={styles.heroBy}>
                        {pane.isSeries
                            ? t('page.home.music032.seriesKind')
                            : t('page.home.music032.workKind')}
                        {' · '}
                        {t('page.home.music032.worksCount', { count: pane.works.length })}
                    </p>
                    <ul className={styles.heroFacts}>
                        <li>
                            {t('page.home.music032.relatedAlbumsCount', { count: pane.albumCount })}
                        </li>
                        <li>
                            {t('page.home.music032.relatedTracksCount', { count: pane.trackTotal })}
                        </li>
                        {yearRange && <li>{yearRange}</li>}
                    </ul>
                    <div className={styles.heroChips}>
                        {pane.works.map(({ work }) => (
                            <button
                                className={styles.heroChip}
                                key={work.id}
                                onClick={() => openWork(work.id)}
                                type="button"
                            >
                                {work.title}
                                <b>
                                    {workTypeLabel(t, work.type)}
                                    {work.year > 0 && ` · ${work.year}`}
                                </b>
                            </button>
                        ))}
                    </div>
                    <div className={styles.heroActions}>
                        <Button
                            leftSection={<Icon fill="contrast" icon="mediaPlay" />}
                            onClick={() => playWorks(pane.workIds)}
                            variant="filled"
                        >
                            {pane.isSeries
                                ? t('page.home.music032.playSeriesAll')
                                : t('page.home.music032.playWorkAll')}
                        </Button>
                        <Button onClick={openTitleTarget} variant="default">
                            {pane.isSeries
                                ? t('page.home.music032.viewSeries')
                                : t('page.home.music032.viewWork')}
                        </Button>
                        <button
                            className={`${styles.sectionLink} ${styles.heroDetailLink}`}
                            onClick={() => openMusic032WebPath(server ?? null, '/admin/works')}
                            type="button"
                        >
                            {t('page.home.music032.allWorks')}
                            <Icon icon="arrowRightS" />
                        </button>
                    </div>
                </div>
                {pane.albums.length > 0 && (
                    <aside
                        aria-label={t('page.home.music032.relatedAlbums')}
                        className={styles.heroSide}
                    >
                        <div className={styles.heroSideHead}>
                            <h3>{t('page.home.music032.relatedAlbums')}</h3>
                            <span>
                                {t('page.home.music032.albumCount', { count: pane.albumCount })}
                            </span>
                        </div>
                        <ol className={styles.heroTracks}>
                            {pane.albums.map((entry) => {
                                const albumPath = getTitlePath(
                                    LibraryItem.ALBUM,
                                    String(entry.album.albumId),
                                );
                                return (
                                    <li key={entry.album.albumId}>
                                        <button
                                            aria-label={entry.album.title}
                                            className={styles.heroAlbumRow}
                                            onClick={() => albumPath && navigate(albumPath)}
                                            type="button"
                                        >
                                            {entry.album.artworkUrl ? (
                                                <ItemImage
                                                    containerClassName={styles.imgBox}
                                                    id={entry.album.artworkUrl}
                                                    itemType={LibraryItem.ALBUM}
                                                    size={256}
                                                />
                                            ) : (
                                                <span className={styles.heroAlbumPlaceholder}>
                                                    032
                                                </span>
                                            )}
                                            <span className={styles.t}>
                                                <b title={entry.album.title}>{entry.album.title}</b>
                                                <small>
                                                    {entry.workTitle} ·{' '}
                                                    {t('page.home.music032.tracksCount', {
                                                        count: entry.album.trackCount || 0,
                                                    })}
                                                </small>
                                            </span>
                                            <span className={styles.d}>
                                                {entry.album.year || ''}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ol>
                        {pane.isSeries && (
                            <button
                                className={`${styles.sectionLink} ${styles.heroSideLink}`}
                                onClick={() => openSeries(pane.seriesId)}
                                type="button"
                            >
                                {t('page.home.music032.viewSeries')}
                                <Icon icon="arrowRightS" />
                            </button>
                        )}
                    </aside>
                )}
            </div>
        </section>
    );
};
