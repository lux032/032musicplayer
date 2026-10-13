import { keepPreviousData, queryOptions } from '@tanstack/react-query';

import { m032ApiClient } from '/@/renderer/api/music032/music032-api';
import { queryKeys } from '/@/renderer/api/query-keys';
import {
    M032Page,
    M032Series,
    M032SeriesAlbumEntry,
    M032SeriesDetail,
    M032WorkTrack,
} from '/@/shared/api/music032/music032-types';
import { ServerListItemWithCredential } from '/@/shared/types/domain-types';

const STALE_TIME = 1000 * 60;

export type M032SeriesListArgs = {
    limit: number;
    offset: number;
    q: string;
};

const client = (server: ServerListItemWithCredential, signal?: AbortSignal) =>
    m032ApiClient({ server, signal });

export const seriesQueries = {
    albums: (server: ServerListItemWithCredential, seriesId: number) =>
        queryOptions({
            queryFn: ({ signal }) =>
                client(server, signal).get<{ items: M032SeriesAlbumEntry[] }>(
                    `/series/${seriesId}/albums`,
                ),
            queryKey: queryKeys.series.albums(server.id, seriesId),
            staleTime: STALE_TIME,
        }),
    detail: (server: ServerListItemWithCredential, seriesId: number) =>
        queryOptions({
            queryFn: ({ signal }) =>
                client(server, signal).get<M032SeriesDetail>(`/series/${seriesId}`),
            queryKey: queryKeys.series.detail(server.id, seriesId),
            staleTime: STALE_TIME,
        }),
    list: (server: ServerListItemWithCredential, args: M032SeriesListArgs) =>
        queryOptions({
            placeholderData: keepPreviousData,
            queryFn: ({ signal }) =>
                client(server, signal).get<M032Page<M032Series>>('/series', {
                    query: { limit: args.limit, offset: args.offset, q: args.q || undefined },
                }),
            queryKey: queryKeys.series.list(server.id, args),
            staleTime: STALE_TIME,
        }),
};

/** 系列全部曲目（播放全部用，不走缓存）。 */
export const fetchMusic032SeriesTracks = (server: ServerListItemWithCredential, seriesId: number) =>
    client(server).get<{ items: M032WorkTrack[] }>(`/series/${seriesId}/tracks`);
