import { queryOptions } from '@tanstack/react-query';

import { api } from '/@/renderer/api';
import { m032ApiClient, Music032ApiError } from '/@/renderer/api/music032/music032-api';
import { queryKeys } from '/@/renderer/api/query-keys';
import { getDefaultStructuredIndex } from '/@/renderer/features/lyrics/api/lyrics-utils';
import { QueryHookArgs } from '/@/renderer/lib/react-query';
import { getServerById } from '/@/renderer/store';
import { M032Lyrics, M032LyricsSearchResult } from '/@/shared/api/music032/music032-types';
import { hasFeature } from '/@/shared/api/utils';
import {
    FullLyricsMetadata,
    InternetProviderLyricSearchResponse,
    LyricGetQuery,
    LyricSearchQuery,
    LyricSource,
    LyricsQuery,
    LyricsResponse,
    QueueSong,
    ServerListItemWithCredential,
    ServerType,
    StructuredLyric,
    SynchronizedLyrics,
} from '/@/shared/types/domain-types';
import { ServerFeature } from '/@/shared/types/features-types';

/**
 * Lyrics come from the 032 server, which resolves them (manual choice, sidecar
 * .lrc, embedded tag, cached / freshly fetched online lyrics) for every client.
 * The client only displays them and forwards search / pick / clear actions.
 */
export type LyricsQueryResult = {
    local: FullLyricsMetadata | null | StructuredLyric[];
    selected: FullLyricsMetadata | null | StructuredLyric;
    selectedOffsetMs: null | number;
    selectedStructuredIndex: number;
    selectedSynced: boolean;
};

// Match LRC lyrics format by https://github.com/ustbhuangyi/lyric-parser
// [mm:ss.SSS] text
const timeExp = /\[(\d{2,}):(\d{2})(?:\.(\d{2,3}))?]([^\n]+)(\n|$)/g;

const formatLyrics = (lyrics: string) => {
    const synchronizedLines = lyrics.matchAll(timeExp);
    const formattedLyrics: SynchronizedLyrics = [];

    for (const line of synchronizedLines) {
        const [, minute, sec, ms, text] = line;
        const minutes = parseInt(minute, 10);
        const seconds = parseInt(sec, 10);
        const milis = ms?.length === 3 ? parseInt(ms, 10) : parseInt(ms, 10) * 10;

        const timeInMilis = (minutes * 60 + seconds) * 1000 + milis;

        formattedLyrics.push({ startMs: timeInMilis, text });
    }

    if (formattedLyrics.length > 0) return formattedLyrics;

    // If no synchronized lyrics were found, return the original lyrics
    return lyrics;
};

export const formatLyricsForDisplay = formatLyrics;

/** Same mapping as the 032 controller's getLyrics: synced → lines with startMs, else plain text. */
const m032LyricsResponse = (res: Pick<M032Lyrics, 'lines' | 'synced'>): LyricsResponse =>
    res.synced
        ? res.lines.map((line) => ({ startMs: line.timeMs, text: line.text }))
        : res.lines.map((line) => line.text).join('\n');

export function computeSelectedFromResult(
    result: Pick<LyricsQueryResult, 'local'>,
    selectedStructuredIndex: number,
): {
    selected: FullLyricsMetadata | null | StructuredLyric;
    selectedSynced: boolean;
} {
    const { local } = result;

    if (Array.isArray(local) && local.length > 0) {
        const item = local[Math.min(selectedStructuredIndex, local.length - 1)];
        return { selected: item, selectedSynced: item.synced };
    }

    if (local != null && !Array.isArray(local) && 'lyrics' in local && local.lyrics) {
        return { selected: local, selectedSynced: Array.isArray(local.lyrics) };
    }

    return { selected: null, selectedSynced: false };
}

const fetchMusic032Lyrics = async (
    server: ServerListItemWithCredential,
    song: QueueSong,
    signal?: AbortSignal,
): Promise<FullLyricsMetadata | null> => {
    let res: M032Lyrics;
    try {
        res = await m032ApiClient({ server, signal }).get<M032Lyrics>(`/tracks/${song.id}/lyrics`);
    } catch (error) {
        if (error instanceof Music032ApiError && error.status === 404) return null;
        throw error;
    }
    if (!res.lines.length) return null;
    const isOnline = res.source === LyricSource.NETEASE || res.source === LyricSource.LRCLIB;
    return {
        artist: (isOnline && res.remoteArtist) || song.artists?.[0]?.name,
        lyrics: m032LyricsResponse(res),
        name: (isOnline && res.remoteTitle) || song.name,
        remote: isOnline,
        source: res.sourceName || res.source || server.name,
    };
};

export async function fetchLocalLyrics(params: {
    serverId: string;
    signal?: AbortSignal;
    song: QueueSong;
}): Promise<FullLyricsMetadata | null | StructuredLyric[]> {
    const { serverId, signal, song } = params;

    const server = getServerById(serverId);
    if (!server) throw new Error('Server not found');

    if (server.type === ServerType.MUSIC032) {
        return fetchMusic032Lyrics(server, song, signal);
    }

    if (hasFeature(server, ServerFeature.LYRICS_MULTIPLE_STRUCTURED)) {
        const subsonicLyrics = await api.controller
            .getStructuredLyrics({
                apiClientProps: { serverId, signal },
                query: { songId: song.id },
            })
            .catch(console.error);
        if (subsonicLyrics?.length) return subsonicLyrics;
    } else if (hasFeature(server, ServerFeature.LYRICS_SINGLE_STRUCTURED)) {
        const jfLyrics = await api.controller
            .getLyrics({
                apiClientProps: { serverId, signal },
                query: { songId: song.id },
            })
            .catch((err) => console.error(err));
        if (jfLyrics) {
            return {
                artist: song.artists?.[0]?.name,
                lyrics: jfLyrics,
                name: song.name,
                remote: false,
                source: server?.name ?? 'music server',
            };
        }
    } else if (song.lyrics) {
        return {
            artist: song.artists?.[0]?.name,
            lyrics: formatLyrics(song.lyrics),
            name: song.name,
            remote: false,
            source: server?.name ?? 'music server',
        };
    }
    return null;
}

export function getDisplayOffset(
    selected: FullLyricsMetadata | null | StructuredLyric,
    storedOffsetMs: null | number,
    selectedStructuredIndex: number,
    local: FullLyricsMetadata | null | StructuredLyric[],
    defaultOffsetMs = 0,
): number {
    if (selected && 'offsetMs' in selected && selected.offsetMs != null) {
        return selected.offsetMs;
    }

    if (Array.isArray(local) && local.length > 0) {
        const item = local[Math.min(selectedStructuredIndex, local.length - 1)];
        if (item.offsetMs != null) {
            return item.offsetMs;
        }
    }

    return storedOffsetMs ?? defaultOffsetMs;
}

/** Use one search result as this track's lyrics on the server (all clients). */
export const bindTrackLyrics = (
    server: ServerListItemWithCredential,
    songId: string,
    pick: { artist: string; id: string; name: string; source: string },
) => m032ApiClient({ server }).put<M032Lyrics>(`/tracks/${songId}/lyrics/source`, pick);

/** Drop the online lyrics of a track on the server and stop automatic lookups for it. */
export const clearTrackLyrics = (server: ServerListItemWithCredential, songId: string) =>
    m032ApiClient({ server }).delete(`/tracks/${songId}/lyrics/source`);

const emptyResult = (): LyricsQueryResult => ({
    local: null,
    selected: null,
    selectedOffsetMs: null,
    selectedStructuredIndex: 0,
    selectedSynced: false,
});

const requireServer = (serverId: string) => {
    const server = getServerById(serverId);
    if (!server) throw new Error('Server not found');
    return server;
};

const NO_LYRICS_STALE_MS = 30 * 1000;
const FOUND_LYRICS_STALE_MS = 12 * 60 * 60 * 1000;

export const lyricsQueries = {
    search: (args: QueryHookArgs<LyricSearchQuery>) => {
        return queryOptions({
            gcTime: 1000 * 60 * 1,
            queryFn: async ({ signal }): Promise<InternetProviderLyricSearchResponse[]> => {
                const { artist, duration, name } = args.query;
                if (!artist && !name) return [];
                const res = await m032ApiClient({
                    server: requireServer(args.serverId),
                    signal,
                }).get<{ results: M032LyricsSearchResult[] }>('/lyrics/search', {
                    query: {
                        artist,
                        durationMs: duration ? Math.round(duration * 1000) : undefined,
                        name,
                    },
                });
                return res.results.map((r) => ({
                    artist: r.artist,
                    id: r.id,
                    isSync: r.synced,
                    name: r.name,
                    score: r.score,
                    source: r.source as LyricSource,
                }));
            },
            queryKey: queryKeys.songs.lyricsSearch(args.query),
            staleTime: 1000 * 60 * 1,
            ...args.options,
        });
    },
    songLyrics: (args: QueryHookArgs<LyricsQuery>, song: QueueSong | undefined) => {
        const lyricsKey = queryKeys.songs.lyrics(args.serverId, args.query);
        return queryOptions({
            gcTime: Infinity,
            queryFn: async ({ signal }): Promise<LyricsQueryResult> => {
                if (!song) return emptyResult();

                const local = await fetchLocalLyrics({ serverId: args.serverId, signal, song });
                const selectedStructuredIndex =
                    Array.isArray(local) && local.length > 0 ? getDefaultStructuredIndex(local) : 0;
                const { selected, selectedSynced } = computeSelectedFromResult(
                    { local },
                    selectedStructuredIndex,
                );
                return {
                    ...emptyResult(),
                    local,
                    selected,
                    selectedStructuredIndex,
                    selectedSynced,
                };
            },
            queryKey: lyricsKey,
            // Results are persisted across restarts. Found lyrics are refreshed after
            // FOUND_LYRICS_STALE_MS so picks on other devices and admin changes arrive;
            // "no lyrics" is asked again on the next visit, since the server may find
            // them later (a lookup that failed transiently, a pick elsewhere).
            staleTime: (query) =>
                query.state.data?.selected ? FOUND_LYRICS_STALE_MS : NO_LYRICS_STALE_MS,
            ...args.options,
        });
    },
    /** Preview of one search result (not saved). */
    songLyricsByRemoteId: (args: QueryHookArgs<Partial<LyricGetQuery>>) => {
        return queryOptions({
            gcTime: Infinity,
            queryFn: async ({ signal }): Promise<LyricsResponse | null> => {
                const q = args.query;
                if (!q?.remoteSongId || !q?.remoteSource) return null;
                try {
                    const res = await m032ApiClient({
                        server: requireServer(args.serverId),
                        signal,
                    }).get<M032Lyrics>(
                        `/lyrics/remote/${encodeURIComponent(q.remoteSource)}/${encodeURIComponent(q.remoteSongId)}`,
                    );
                    return m032LyricsResponse(res);
                } catch (error) {
                    if (error instanceof Music032ApiError && error.status === 404) return null;
                    throw error;
                }
            },
            queryKey: queryKeys.songs.lyricsByRemoteId({
                remoteSongId: args.query?.remoteSongId || '',
                remoteSource: args.query?.remoteSource as LyricSource,
            }),
            staleTime: Infinity,
            ...args.options,
        });
    },
};
