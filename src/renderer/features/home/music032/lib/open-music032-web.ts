import { useCallback } from 'react';
import { generatePath, useNavigate } from 'react-router';

import { m032Context } from '/@/renderer/api/music032/music032-api';
import { AppRoute } from '/@/renderer/router/routes';
import { ServerListItemWithCredential } from '/@/shared/types/domain-types';

/**
 * 在系统浏览器里打开 032 网页端的某个页面（main 进程的 setWindowOpenHandler
 * 会把 window.open 交给默认浏览器）。作品和系列在客户端内已有页面，
 * 本函数只保留给"在网页中打开"（编辑、管理）、播放记录、待审核等入口。
 */
export const openMusic032WebPath = (server: null | ServerListItemWithCredential, path: string) => {
    const baseUrl = m032Context(server).baseUrl;
    if (!baseUrl) return;
    window.open(`${baseUrl}${path}`, '_blank', 'noopener');
};

/** 打开作品：客户端内的作品详情页。 */
export const useOpenMusic032Work = () => {
    const navigate = useNavigate();
    return useCallback(
        (workId: number) =>
            navigate(generatePath(AppRoute.LIBRARY_WORKS_DETAIL, { workId: String(workId) })),
        [navigate],
    );
};

/** 打开系列：系列页落地前暂时仍打开网页（后续提交替换为客户端路由）。 */
export const openMusic032Series = (server: null | ServerListItemWithCredential, seriesId: number) =>
    openMusic032WebPath(server, `/admin/series/${seriesId}`);
