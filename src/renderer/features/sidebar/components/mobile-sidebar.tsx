import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './mobile-sidebar.module.css';

import { useInternetRadioSupported } from '/@/renderer/features/radio/hooks/use-radio-supported';
import {
    insertMusic032SidebarItems,
    Music032SidebarItem,
    useMusic032SidebarItems,
} from '/@/renderer/features/shared/hooks/use-music032-sidebar-items';
import { ActionBar } from '/@/renderer/features/sidebar/components/action-bar';
import { SidebarIcon } from '/@/renderer/features/sidebar/components/sidebar-icon';
import { SidebarItem } from '/@/renderer/features/sidebar/components/sidebar-item';
import {
    SidebarPlaylistAddDragContext,
    SidebarPlaylistList,
    SidebarSharedPlaylistList,
    useSidebarPlaylistAddDragMonitor,
} from '/@/renderer/features/sidebar/components/sidebar-playlist-list';
import { useSidebarItems, useSidebarPlaylistList } from '/@/renderer/store/settings.store';
import { Accordion } from '/@/shared/components/accordion/accordion';
import { Group } from '/@/shared/components/group/group';
import { ScrollArea } from '/@/shared/components/scroll-area/scroll-area';
import { Text } from '/@/shared/components/text/text';

const MobileSidebarPlaylistSection = () => {
    const isAddDragActive = useSidebarPlaylistAddDragMonitor();

    return (
        <SidebarPlaylistAddDragContext.Provider value={isAddDragActive}>
            <SidebarPlaylistList />
            <SidebarSharedPlaylistList />
        </SidebarPlaylistAddDragContext.Provider>
    );
};

export const MobileSidebar = () => {
    const { t } = useTranslation();
    const sidebarPlaylistList = useSidebarPlaylistList();

    const translatedSidebarItemMap = useMemo(
        () => ({
            Albums: t('page.sidebar.albums'),
            Artists: t('page.sidebar.albumArtists'),
            'Artists-all': t('page.sidebar.artists'),
            Favorites: t('page.sidebar.favorites'),
            Home: t('page.sidebar.home'),
            'Now Playing': t('page.sidebar.nowPlaying'),
            Playlists: t('page.sidebar.playlists'),
            Search: t('page.sidebar.search'),
            Settings: t('page.sidebar.settings'),
            Tracks: t('page.sidebar.tracks'),
        }),
        [t],
    );

    const sidebarItems = useSidebarItems();
    const radioSupported = useInternetRadioSupported();
    const music032Items = useMusic032SidebarItems();

    const sidebarItemsWithRoute: Music032SidebarItem[] = useMemo(() => {
        if (!sidebarItems) return [];

        const items = sidebarItems
            .filter((item) => !item.disabled && (item.id !== 'Radio' || radioSupported))
            .map((item) => ({
                ...item,
                label:
                    translatedSidebarItemMap[item.id as keyof typeof translatedSidebarItemMap] ??
                    item.label,
            }));

        return insertMusic032SidebarItems(items, music032Items);
    }, [music032Items, radioSupported, sidebarItems, translatedSidebarItemMap]);

    return (
        <div className={styles.container} id="mobile-sidebar">
            <Group grow id="global-search-container" style={{ flexShrink: 0 }}>
                <ActionBar />
            </Group>
            <ScrollArea allowDragScroll className={styles.scrollArea}>
                <Accordion
                    classNames={{
                        content: styles.accordionContent,
                        control: styles.accordionControl,
                        item: styles.accordionItem,
                        root: styles.accordionRoot,
                    }}
                    defaultValue={['library', 'playlists']}
                    multiple
                >
                    <Accordion.Item value="library">
                        <Accordion.Control>
                            <Text fw={600} variant="secondary">
                                {t('page.sidebar.myLibrary')}
                            </Text>
                        </Accordion.Control>
                        <Accordion.Panel>
                            {sidebarItemsWithRoute.map((item) => {
                                return (
                                    <SidebarItem
                                        key={`sidebar-${item.id}`}
                                        onClick={item.onClick}
                                        to={item.route}
                                    >
                                        <Group gap="sm">
                                            <SidebarIcon route={item.route} />
                                            {item.label}
                                        </Group>
                                    </SidebarItem>
                                );
                            })}
                        </Accordion.Panel>
                    </Accordion.Item>
                    {sidebarPlaylistList && <MobileSidebarPlaylistSection />}
                </Accordion>
            </ScrollArea>
        </div>
    );
};
