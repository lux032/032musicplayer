import { keepPreviousData, queryOptions } from '@tanstack/react-query';

import { m032ApiClient } from '/@/renderer/api/music032/music032-api';
import { queryKeys } from '/@/renderer/api/query-keys';
import {
    M032HomeAlbumPane,
    M032HomeChronicleResult,
    M032HomeResponse,
    M032HomeSongRow,
    M032HomeWorkCard,
    M032RotationPage,
    M032WorkTrack,
} from '/@/shared/api/music032/music032-types';
import { ServerListItemWithCredential } from '/@/shared/types/domain-types';

const STALE_TIME = 1000 * 60;

export type M032HomeSongsArgs = {
    batch: number;
    generation: string;
};

export type M032HomeWorksArgs = {
    batch: number;
    generation: string;
    type: string;
};

const client = (server: ServerListItemWithCredential, signal?: AbortSignal) =>
    m032ApiClient({ server, signal });

export const music032HomeQueries = {
    chronicle: (server: ServerListItemWithCredential, year: number) =>
        queryOptions({
            queryFn: ({ signal }) =>
                client(server, signal).get<M032HomeChronicleResult>('/home/chronicle', {
                    query: { year },
                }),
            queryKey: queryKeys.home.chronicle(server.id, year),
            staleTime: STALE_TIME,
        }),
    overview: (server: ServerListItemWithCredential) =>
        queryOptions({
            queryFn: ({ signal }) => client(server, signal).get<M032HomeResponse>('/home'),
            queryKey: queryKeys.home.overview(server.id),
            staleTime: STALE_TIME,
        }),
    songs: (server: ServerListItemWithCredential, args: M032HomeSongsArgs) =>
        queryOptions({
            placeholderData: keepPreviousData,
            queryFn: ({ signal }) =>
                client(server, signal).get<M032RotationPage<M032HomeSongRow>>('/home/songs', {
                    query: { batch: args.batch, generation: args.generation },
                }),
            queryKey: queryKeys.home.songs(server.id, args),
            staleTime: STALE_TIME,
        }),
    works: (server: ServerListItemWithCredential, args: M032HomeWorksArgs) =>
        queryOptions({
            placeholderData: keepPreviousData,
            queryFn: ({ signal }) =>
                client(server, signal).get<M032RotationPage<M032HomeWorkCard>>('/home/works', {
                    query: { batch: args.batch, generation: args.generation, type: args.type },
                }),
            queryKey: queryKeys.home.works(server.id, args),
            staleTime: STALE_TIME,
        }),
};

/** 换一张：随机聚焦页签的新专辑（不参与按天冻结，每次重新抽取）。 */
export const fetchMusic032SpotlightRandom = (
    server: ServerListItemWithCredential,
    exclude: number,
) =>
    client(server).get<M032HomeAlbumPane>('/home/spotlight/random', {
        query: { exclude: exclude || undefined },
    });

/** 一部作品的全部关联曲目（含用途角色），用于把作品/系列展开成播放队列。 */
export const fetchMusic032WorkTracks = (server: ServerListItemWithCredential, workId: number) =>
    client(server).get<{ items: M032WorkTrack[] }>(`/works/${workId}/tracks`);
