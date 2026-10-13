import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { m032Context } from '/@/renderer/api/music032/music032-api';
import { DataRow, getDataRows } from '/@/renderer/components/item-card/item-card';
import { useDefaultItemListControls } from '/@/renderer/components/item-list/helpers/item-list-controls';
import { HomeAlbumCard } from '/@/renderer/features/home/music032/components/home-album-card';
import { HomeSection } from '/@/renderer/features/home/music032/components/home-section';
import styles from '/@/renderer/features/home/music032/music032-home.module.css';
import { AppRoute } from '/@/renderer/router/routes';
import { useCurrentServerWithCredential } from '/@/renderer/store';
import { formatDateRelative } from '/@/renderer/utils/format';
import { m032Normalize } from '/@/shared/api/music032/music032-normalize';
import { M032Album } from '/@/shared/api/music032/music032-types';
import { Icon } from '/@/shared/components/icon/icon';
import { Album } from '/@/shared/types/domain-types';

/** 最近添加：入库时间倒序的专辑网格，列数随宽度 3 → 6。 */
export const HomeRecentAlbums = ({ albums }: { albums: M032Album[] }) => {
    const { t } = useTranslation();
    const server = useCurrentServerWithCredential();
    const controls = useDefaultItemListControls();

    const items = useMemo(() => {
        const ctx = m032Context(server);
        return albums.map((album) => m032Normalize.album(ctx, album));
    }, [albums, server]);

    const rows: DataRow[] = useMemo(
        () => [
            {
                format: (data) => (data as Album).name,
                id: 'name',
            },
            // feishin's album artist row: each artist links to its detail page.
            getDataRows('poster').find((row) => row.id === 'albumArtists')!,
            {
                format: (data) =>
                    t('page.home.music032.addedAt', {
                        time: formatDateRelative((data as Album).createdAt),
                    }),
                id: 'addedAt',
                isMuted: true,
            },
        ],
        [t],
    );

    return (
        <HomeSection
            title={t('page.home.music032.recentAlbums')}
            tools={
                <Link className={styles.sectionLink} to={AppRoute.LIBRARY_ALBUMS}>
                    {t('page.home.music032.viewAll')}
                    <Icon icon="arrowRightS" />
                </Link>
            }
        >
            <div className={styles.recentGrid}>
                {items.map((album) => (
                    <HomeAlbumCard album={album} controls={controls} key={album.id} rows={rows} />
                ))}
            </div>
        </HomeSection>
    );
};
