import { m032Context } from '/@/renderer/api/music032/music032-api';
import { ServerListItemWithCredential } from '/@/shared/types/domain-types';

/**
 * 在系统浏览器里打开 032 网页端的某个页面（main 进程的 setWindowOpenHandler
 * 会把 window.open 交给默认浏览器）。作品和系列在客户端里还没有页面，
 * 本阶段统一从这里跳网页；将来有了客户端内的作品页，只改这一个文件。
 */
export const openMusic032WebPath = (server: null | ServerListItemWithCredential, path: string) => {
    const baseUrl = m032Context(server).baseUrl;
    if (!baseUrl) return;
    window.open(`${baseUrl}${path}`, '_blank', 'noopener');
};

export const openMusic032Work = (server: null | ServerListItemWithCredential, workId: number) =>
    openMusic032WebPath(server, `/admin/works/${workId}`);

export const openMusic032Series = (server: null | ServerListItemWithCredential, seriesId: number) =>
    openMusic032WebPath(server, `/admin/series/${seriesId}`);
