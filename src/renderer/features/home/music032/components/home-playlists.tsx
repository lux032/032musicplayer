import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { m032Context } from '/@/renderer/api/music032/music032-api';
import { DataRow, MemoizedItemCard } from '/@/renderer/components/item-card/item-card';
import { useDefaultItemListControls } from '/@/renderer/components/item-list/helpers/item-list-controls';
import { HomeSection } from '/@/renderer/features/home/music032/components/home-section';
import styles from '/@/renderer/features/home/music032/music032-home.module.css';
import { AppRoute } from '/@/renderer/router/routes';
import { useCurrentServerWithCredential } from '/@/renderer/store';
import { m032Normalize } from '/@/shared/api/music032/music032-normalize';
import { M032Playlist } from '/@/shared/api/music032/music032-types';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Icon } from '/@/shared/components/icon/icon';
import { LibraryItem, Playlist } from '/@/shared/types/domain-types';

/** 歌单货架：横向滚动，卡片复用 feishin 的播放/右键菜单/跳转。 */
export const HomePlaylists = ({ playlists }: { playlists: M032Playlist[] }) => {
    const { t } = useTranslation();
    const server = useCurrentServerWithCredential();
    const controls = useDefaultItemListControls();
    const shelfRef = useRef<HTMLDivElement>(null);

    const items = useMemo(() => {
        const ctx = m032Context(server);
        return playlists.map((playlist) => m032Normalize.playlist(ctx, playlist));
    }, [playlists, server]);

    const rows: DataRow[] = useMemo(
        () => [
            { format: (data) => (data as Playlist).name, id: 'name' },
            {
                format: (data) =>
                    t('page.home.music032.tracksCount', {
                        count: (data as Playlist).songCount || 0,
                    }),
                id: 'meta',
                isMuted: true,
            },
        ],
        [t],
    );

    const scrollShelf = (dir: -1 | 1) => {
        const shelf = shelfRef.current;
        if (shelf) shelf.scrollBy({ behavior: 'smooth', left: dir * shelf.clientWidth * 0.8 });
    };

    return (
        <HomeSection
            count={t('page.home.music032.playlistCount', { count: items.length })}
            title={t('page.home.music032.playlistsTitle')}
            tools={
                <>
                    <ActionIcon aria-label="prev" onClick={() => scrollShelf(-1)} variant="subtle">
                        <Icon icon="arrowLeftS" />
                    </ActionIcon>
                    <ActionIcon aria-label="next" onClick={() => scrollShelf(1)} variant="subtle">
                        <Icon icon="arrowRightS" />
                    </ActionIcon>
                    <Link className={styles.sectionLink} to={AppRoute.PLAYLISTS}>
                        {t('page.home.music032.allPlaylists')}
                        <Icon icon="arrowRightS" />
                    </Link>
                </>
            }
        >
            <div className={styles.shelf} ref={shelfRef}>
                {items.map((playlist) => (
                    <MemoizedItemCard
                        controls={controls}
                        data={playlist}
                        enableDrag={false}
                        enableExpansion={false}
                        imageFetchPriority="low"
                        itemType={LibraryItem.PLAYLIST}
                        key={playlist.id}
                        rows={rows}
                        type="poster"
                        withControls
                    />
                ))}
            </div>
        </HomeSection>
    );
};
