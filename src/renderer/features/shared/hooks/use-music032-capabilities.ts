import { queryOptions, useQuery } from '@tanstack/react-query';

import { m032ApiClient } from '/@/renderer/api/music032/music032-api';
import { queryKeys } from '/@/renderer/api/query-keys';
import { useCurrentServerWithCredential } from '/@/renderer/store';
import { M032Capabilities } from '/@/shared/api/music032/music032-types';
import { ServerListItemWithCredential, ServerType } from '/@/shared/types/domain-types';

const STALE_TIME = 1000 * 60 * 5;

export const capabilitiesQuery = (server: ServerListItemWithCredential) =>
    queryOptions({
        queryFn: ({ signal }) =>
            m032ApiClient({ server, signal }).get<M032Capabilities>('/capabilities'),
        queryKey: queryKeys.music032.capabilities(server.id),
        staleTime: STALE_TIME,
    });

/** 032 服务端能力位（/api/v1/capabilities）；非 032 服务端返回空 query。 */
export const useMusic032Capabilities = () => {
    const server = useCurrentServerWithCredential();
    const isMusic032 = server?.type === ServerType.MUSIC032;

    return useQuery({
        ...(isMusic032 && server
            ? capabilitiesQuery(server)
            : { enabled: false, queryKey: ['noop'] as const }),
        enabled: isMusic032,
    });
};

/**
 * 系列接口是否可用（能力位 features.series）。能力位还没加载到时按可用处理，
 * 系列页自身会对 404 降级为"在网页中打开"。
 */
export const useMusic032SeriesSupported = (): boolean => {
    const query = useMusic032Capabilities();
    if (!query.data) return true;
    return Boolean(query.data.features?.series);
};

/**
 * 每日推荐是否可用（能力位 features.dailyMixes）。能力位未加载时按不可用处理，
 * 主页不为旧服务端发多余请求。
 */
export const useMusic032DailyMixesSupported = (): boolean => {
    const query = useMusic032Capabilities();
    return Boolean(query.data?.features?.dailyMixes);
};

/** 在线歌词（网易云、LRCLIB）是否可用：可以搜索、手动选择、清除歌词（能力位 features.lyricsOnline）。 */
export const useMusic032OnlineLyricsSupported = (): boolean => {
    const query = useMusic032Capabilities();
    return Boolean(query.data?.features?.lyricsOnline);
};

/**
 * 歌词翻译是否可用（能力位 features.lyricsTranslation）：服务端配置了模型并开启翻译后为真。
 * 模型设置只在服务端；能力位未加载时按不可用处理。
 */
export const useMusic032LyricsTranslationSupported = (): boolean => {
    const query = useMusic032Capabilities();
    return Boolean(query.data?.features?.lyricsTranslation);
};
