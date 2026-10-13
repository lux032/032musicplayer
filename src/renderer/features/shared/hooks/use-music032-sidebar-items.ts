import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { AppRoute } from '/@/renderer/router/routes';
import { useCurrentServerWithCredential } from '/@/renderer/store';
import { SidebarItemType } from '/@/renderer/store/settings.store';
import { ServerType } from '/@/shared/types/domain-types';

export type Music032SidebarItem = SidebarItemType & {
    onClick?: React.MouseEventHandler;
};

/**
 * MUSIC032 专属的侧边栏注入项（作品、系列），不进用户的 sidebarItems 持久化
 * 设置。后端没有系列接口时（能力位缺失），系列入口直接打开网页端。
 */
export const useMusic032SidebarItems = (): Music032SidebarItem[] => {
    const { t } = useTranslation();
    const server = useCurrentServerWithCredential();

    return useMemo(() => {
        if (server?.type !== ServerType.MUSIC032) return [];

        return [
            {
                disabled: false,
                id: 'M032Works',
                label: t('page.sidebar.works'),
                route: AppRoute.LIBRARY_WORKS,
            },
        ];
    }, [server, t]);
};
