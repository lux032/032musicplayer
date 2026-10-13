import { keepPreviousData, queryOptions } from '@tanstack/react-query';

import { m032ApiClient } from '/@/renderer/api/music032/music032-api';
import { queryKeys } from '/@/renderer/api/query-keys';
import {
    M032AlbumWork,
    M032Page,
    M032Work,
    M032WorkDetail,
    M032WorkTrack,
} from '/@/shared/api/music032/music032-types';
import { ServerListItemWithCredential } from '/@/shared/types/domain-types';

const STALE_TIME = 1000 * 60;

export type M032WorksListArgs = {
    limit: number;
    offset: number;
    q: string;
    sort: string;
    type: string;
};

const client = (server: ServerListItemWithCredential, signal?: AbortSignal) =>
    m032ApiClient({ server, signal });

export const worksQueries = {
    albums: (server: ServerListItemWithCredential, workId: number) =>
        queryOptions({
            queryFn: ({ signal }) =>
                client(server, signal).get<{ items: M032AlbumWork[] }>(`/works/${workId}/albums`),
            queryKey: queryKeys.works.albums(server.id, workId),
            staleTime: STALE_TIME,
        }),
    detail: (server: ServerListItemWithCredential, workId: number) =>
        queryOptions({
            queryFn: ({ signal }) => client(server, signal).get<M032WorkDetail>(`/works/${workId}`),
            queryKey: queryKeys.works.detail(server.id, workId),
            staleTime: STALE_TIME,
        }),
    list: (server: ServerListItemWithCredential, args: M032WorksListArgs) =>
        queryOptions({
            placeholderData: keepPreviousData,
            queryFn: ({ signal }) =>
                client(server, signal).get<M032Page<M032Work>>('/works', {
                    query: {
                        limit: args.limit,
                        offset: args.offset,
                        q: args.q || undefined,
                        sort: args.sort || undefined,
                        type: args.type || undefined,
                    },
                }),
            queryKey: queryKeys.works.list(server.id, args),
            staleTime: STALE_TIME,
        }),
    tracks: (server: ServerListItemWithCredential, workId: number) =>
        queryOptions({
            queryFn: ({ signal }) =>
                client(server, signal).get<{ items: M032WorkTrack[] }>(`/works/${workId}/tracks`),
            queryKey: queryKeys.works.tracks(server.id, workId),
            staleTime: STALE_TIME,
        }),
};
