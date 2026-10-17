import { queryOptions } from '@tanstack/react-query';

import { m032ApiClient } from '/@/renderer/api/music032/music032-api';
import { queryKeys } from '/@/renderer/api/query-keys';
import { queryClient } from '/@/renderer/lib/react-query';
import {
    M032DailyMix,
    M032DailyMixDetail,
    M032DailyMixList,
    M032Playlist,
} from '/@/shared/api/music032/music032-types';
import { ServerListItemWithCredential } from '/@/shared/types/domain-types';

const STALE_TIME = 1000 * 60;
/** While today's mixes are generating the list is polled this often, at most POLL_LIMIT times. */
const POLL_MILLIS = 5000;
const POLL_LIMIT = 24;

const client = (server: ServerListItemWithCredential, signal?: AbortSignal) =>
    m032ApiClient({ server, signal });

export const dailyMixQueries = {
    detail: (server: ServerListItemWithCredential, id: number) =>
        queryOptions({
            queryFn: ({ signal }) =>
                client(server, signal).get<M032DailyMixDetail>(`/daily-mixes/${id}`),
            queryKey: queryKeys.dailyMixes.detail(server.id, id),
            staleTime: STALE_TIME,
        }),
    /** Today's mixes. HTTP 202 (status generating) still resolves; it is polled until ready. */
    list: (server: ServerListItemWithCredential) =>
        queryOptions({
            queryFn: ({ signal }) => client(server, signal).get<M032DailyMixList>('/daily-mixes'),
            queryKey: queryKeys.dailyMixes.list(server.id),
            refetchInterval: (query) =>
                query.state.data?.status === 'generating' &&
                query.state.dataUpdateCount < POLL_LIMIT
                    ? POLL_MILLIS
                    : false,
            retry: false,
            staleTime: STALE_TIME,
        }),
};

export const invalidateDailyMixes = (serverId: string) =>
    queryClient.invalidateQueries({ queryKey: queryKeys.dailyMixes.root(serverId) });

/** value: 1 like, -1 dislike (optional reasons), 0 clears the rating. */
export const rateDailyMix = (
    server: ServerListItemWithCredential,
    id: number,
    value: -1 | 0 | 1,
    reasons: string[] = [],
) =>
    client(server).put<M032DailyMix>(`/daily-mixes/${id}/rating`, {
        reasons: value === -1 ? reasons : [],
        value,
    });

/** 换一个: replaces today's mix with a new theme. 429 replacement_limit when used up. */
export const regenerateDailyMix = (server: ServerListItemWithCredential, id: number) =>
    client(server).post<M032DailyMix>(`/daily-mixes/${id}/regenerate`, {});

export const saveDailyMix = (server: ServerListItemWithCredential, id: number) =>
    client(server).post<{ playlist: M032Playlist }>(`/daily-mixes/${id}/save`, {});

/** 不再推荐: excludes a track from future daily mixes (takes effect on the next generation). */
export const setRecommendationBlock = (
    server: ServerListItemWithCredential,
    trackId: number,
    blocked: boolean,
) =>
    blocked
        ? client(server).put(`/tracks/${trackId}/recommendation-block`, {})
        : client(server).delete(`/tracks/${trackId}/recommendation-block`);

/** Dislike reasons accepted by the server (storage.DailyMixRatingReasons). */
export const DAILY_MIX_REASONS = ['repetitive', 'theme', 'tracks', 'flow', 'mismatch'] as const;
