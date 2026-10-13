import { MouseEventHandler, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { openMusic032WebPath } from '/@/renderer/features/home/music032/lib/open-music032-web';
import { useMusic032SeriesSupported } from '/@/renderer/features/shared/hooks/use-music032-capabilities';
import { AppRoute } from '/@/renderer/router/routes';
import { useCurrentServerWithCredential } from '/@/renderer/store';
import { SidebarItemType } from '/@/renderer/store/settings.store';
import { ServerType } from '/@/shared/types/domain-types';

export type Music032SidebarItem = SidebarItemType & {
    onClick?: MouseEventHandler;
};

const LIBRARY_ANCHOR_IDS = new Set(['Albums', 'Artists', 'Artists-all', 'Tracks']);

/** 把 032 注入项插到最后一个曲库入口（专辑/曲目/艺术家）之后，找不到就追加到末尾。 */
export const insertMusic032SidebarItems = (
    items: Music032SidebarItem[],
    music032Items: Music032SidebarItem[],
): Music032SidebarItem[] => {
    if (!music032Items.length) return items;
    const anchorIndex = items.findLastIndex((item) => LIBRARY_ANCHOR_IDS.has(item.id));
    const next = [...items];
    next.splice(anchorIndex >= 0 ? anchorIndex + 1 : next.length, 0, ...music032Items);
    return next;
};

/**
 * MUSIC032 专属的侧边栏注入项（作品、系列、播放记录），不进用户的 sidebarItems 持久化
 * 设置。后端没有系列接口时（能力位缺失），系列入口直接打开网页端。
 */
export const useMusic032SidebarItems = (): Music032SidebarItem[] => {
    const { t } = useTranslation();
    const server = useCurrentServerWithCredential();
    const seriesSupported = useMusic032SeriesSupported();

    return useMemo(() => {
        if (server?.type !== ServerType.MUSIC032) return [];

        const items: Music032SidebarItem[] = [
            {
                disabled: false,
                id: 'M032Works',
                label: t('page.sidebar.works'),
                route: AppRoute.LIBRARY_WORKS,
            },
        ];

        if (seriesSupported) {
            items.push({
                disabled: false,
                id: 'M032Series',
                label: t('page.sidebar.series'),
                route: AppRoute.LIBRARY_SERIES,
            });
        } else {
            items.push({
                disabled: false,
                id: 'M032Series',
                label: t('page.sidebar.series'),
                onClick: (e) => {
                    e.preventDefault();
                    openMusic032WebPath(server, '/admin/series');
                },
                route: AppRoute.LIBRARY_SERIES,
            });
        }

        items.push({
            disabled: false,
            id: 'M032PlaybackHistory',
            label: t('page.sidebar.playbackHistory'),
            route: AppRoute.LIBRARY_PLAYBACK_HISTORY,
        });

        return items;
    }, [server, seriesSupported, t]);
};
