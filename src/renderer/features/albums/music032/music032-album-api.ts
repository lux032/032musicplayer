import { queryOptions, useQueries, useQuery } from '@tanstack/react-query';
import { TFunction } from 'i18next';
import { useMemo } from 'react';

import { m032ApiClient } from '/@/renderer/api/music032/music032-api';
import { queryKeys } from '/@/renderer/api/query-keys';
import { workPosterPath, workRoleLabel } from '/@/renderer/features/home/music032/lib/format';
import { worksQueries } from '/@/renderer/features/works/api/works-api';
import {
    M032AlbumDetail,
    M032AlbumWork,
    M032AlbumWorkLink,
    M032Track,
    M032WorkDetail,
    M032WorkTrack,
} from '/@/shared/api/music032/music032-types';
import { ServerListItemWithCredential } from '/@/shared/types/domain-types';

const STALE_TIME = 1000 * 60;

export const music032AlbumQueries = {
    detail: (server: ServerListItemWithCredential, albumId: string) =>
        queryOptions({
            queryFn: ({ signal }) =>
                m032ApiClient({ server, signal }).get<M032AlbumDetail>(`/albums/${albumId}`),
            queryKey: queryKeys.albums.music032Detail(server.id, albumId),
            staleTime: STALE_TIME,
        }),
    works: (server: ServerListItemWithCredential, albumId: string) =>
        queryOptions({
            queryFn: ({ signal }) =>
                m032ApiClient({ server, signal }).get<{ items: M032AlbumWorkLink[] }>(
                    `/albums/${albumId}/works`,
                ),
            queryKey: queryKeys.albums.music032Works(server.id, albumId),
            staleTime: STALE_TIME,
        }),
};

// storage.WorkRoleRank order.
const ROLE_RANK = ['op', 'ed', 'insert', 'theme', 'character', 'image_song', 'ost'];
const roleRank = (role: string) => {
    const index = ROLE_RANK.indexOf(role);
    return index < 0 ? ROLE_RANK.length : index;
};

/** workAlbumUsageLabel in 032music-server: album-level OST plus distinct track usages. */
export const workUsageLabel = (t: TFunction, albumRole: string, trackRoles: string[]) => {
    const parts: string[] = albumRole === 'ost' ? ['OST'] : [];
    for (const role of [...trackRoles].sort((a, b) => roleRank(a) - roleRank(b))) {
        if (!role || role === 'other') continue;
        const label = workRoleLabel(t, role);
        if (!parts.includes(label)) parts.push(label);
    }
    return parts.join(' · ');
};

export type Music032AlbumWorkView = {
    albumRole: string;
    id: number;
    posterPath: string;
    title: string;
    /** Linked tracks of this album, in album order, with their usage label. */
    tracks: { id: number; label: string; title: string }[];
    translatedTitle: string;
    type: string;
    /** Capsule label: "OST · OP" etc.; empty when the link carries no usage. */
    usage: string;
    year: number;
};

/** Song id -> works the track is used in (web: TrackTieups). */
export type Music032TrackTieups = Map<string, { label: string; work: Music032AlbumWorkView }[]>;

const dataOnly = (results: { data?: unknown }[]) => results.map((result) => result.data);

/**
 * Works linked to an album, shaped like the 032 web album page (capsules +
 * inspector). Per-work detail/albums/tracks reuse the work page query cache.
 */
export const useMusic032AlbumWorks = (
    server: ServerListItemWithCredential,
    albumId: string,
    albumTracks: M032Track[],
    t: TFunction,
) => {
    const linksQuery = useQuery(music032AlbumQueries.works(server, albumId));
    const links = useMemo(() => linksQuery.data?.items ?? [], [linksQuery.data]);

    const perWork = useQueries({
        // Stable combine keeps the result referentially stable between renders.
        combine: dataOnly,
        queries: links.flatMap((link) => [
            worksQueries.detail(server, link.id),
            worksQueries.albums(server, link.id),
            worksQueries.tracks(server, link.id),
        ]),
    });

    const works = useMemo<Music032AlbumWorkView[]>(() => {
        const album = Number(albumId);
        const order = new Map(albumTracks.map((track, index) => [track.id, index]));
        return links.map((link, index) => {
            const detail = perWork[index * 3] as M032WorkDetail | undefined;
            const albums = perWork[index * 3 + 1] as undefined | { items: M032AlbumWork[] };
            const tracks = perWork[index * 3 + 2] as undefined | { items: M032WorkTrack[] };

            const albumLink = albums?.items.find((item) => item.albumId === album);
            const albumRole = albumLink ? albumLink.albumRole || albumLink.role : '';
            // source=album rows are the whole-album link itself, not a track usage.
            const usages = (tracks?.items ?? []).filter(
                (track) => track.albumId === album && track.source !== 'album',
            );
            const byTrack = new Map<number, { roles: string[]; title: string }>();
            for (const usage of usages) {
                const entry = byTrack.get(usage.id) ?? { roles: [], title: usage.title };
                entry.roles.push(usage.role);
                byTrack.set(usage.id, entry);
            }
            const linkedTracks = [...byTrack.entries()]
                .sort(([a], [b]) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
                .map(([id, entry]) => ({
                    id,
                    label: workUsageLabel(t, '', entry.roles) || t('page.works.albumRoleOther'),
                    title: entry.title,
                }));

            return {
                albumRole,
                id: link.id,
                posterPath: workPosterPath(link.id, detail?.posterApiUrl || detail?.posterUrl),
                title: detail?.title || link.title,
                tracks: linkedTracks,
                translatedTitle: detail?.translatedTitle || '',
                type: detail?.type || link.type,
                usage: workUsageLabel(
                    t,
                    albumRole,
                    usages.map((u) => u.role),
                ),
                year: detail?.year || 0,
            };
        });
    }, [albumId, albumTracks, links, perWork, t]);

    const trackTieups = useMemo(() => {
        const map: Music032TrackTieups = new Map();
        for (const work of works) {
            for (const track of work.tracks) {
                const key = String(track.id);
                map.set(key, [...(map.get(key) ?? []), { label: track.label, work }]);
            }
        }
        return map;
    }, [works]);

    return { isLoading: linksQuery.isLoading, trackTieups, works };
};
