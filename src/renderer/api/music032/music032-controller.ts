import i18n from '/@/i18n/i18n';
import {
    M032_MAX_PAGE_SIZE,
    m032ApiClient,
    M032ApiClient,
    m032Context,
    m032RawRequest,
    Music032ApiError,
} from '/@/renderer/api/music032/music032-api';
import { logger } from '/@/renderer/utils/logger';
import {
    M032Context,
    m032MediaUrl,
    m032Normalize,
} from '/@/shared/api/music032/music032-normalize';
import {
    M032Album,
    M032AlbumDetail,
    M032Artist,
    M032ArtistDetail,
    M032Capabilities,
    M032Lyrics,
    M032Page,
    M032Playlist,
    M032PlaylistDetail,
    M032SimilarTrack,
    M032Track,
} from '/@/shared/api/music032/music032-types';
import { sortAlbumList, sortSongList } from '/@/shared/api/utils';
import {
    Album,
    AlbumArtistListSort,
    AlbumListSort,
    ArtistListSort,
    InternalControllerEndpoint,
    LibraryItem,
    Playlist,
    PlaylistListSort,
    ServerListItemWithCredential,
    Song,
    SongListSort,
    SortOrder,
} from '/@/shared/types/domain-types';
import { ServerFeature } from '/@/shared/types/features-types';

/** apiRevision this client implements (playback session protocol). */
export const M032_API_REVISION = 3;

type Server = null | ServerListItemWithCredential;

const unsupported = (endpoint: string): never => {
    throw new Error(
        i18n.t('error.endpointNotImplementedError', {
            endpoint,
            serverType: '032 Music Server',
        }) as string,
    );
};

const first = (ids?: string[]) => (ids && ids.length > 0 ? ids[0] : undefined);

/** Fetches every page of a paginated 032 list endpoint. */
const fetchAll = async <T>(
    client: M032ApiClient,
    path: string,
    query: Record<string, number | string | undefined> = {},
): Promise<T[]> => {
    const items: T[] = [];
    let offset = 0;
    for (;;) {
        const page = await client.get<M032Page<T>>(path, {
            query: { ...query, limit: M032_MAX_PAGE_SIZE, offset },
        });
        items.push(...page.items);
        offset += page.items.length;
        if (page.items.length === 0 || offset >= page.total) return items;
    }
};

/**
 * Fetches one feishin page (startIndex/limit, limit -1 = everything) from an
 * 032 list endpoint, splitting it into requests of at most 500 items.
 */
const fetchPage = async <T>(
    client: M032ApiClient,
    path: string,
    query: Record<string, number | string | undefined>,
    startIndex: number,
    limit?: number,
): Promise<{ items: T[]; total: number }> => {
    const wanted = limit === undefined || limit < 0 ? Infinity : limit;
    const items: T[] = [];
    let offset = startIndex;
    let total = 0;
    for (;;) {
        const size = Math.min(M032_MAX_PAGE_SIZE, wanted - items.length);
        const page = await client.get<M032Page<T>>(path, {
            query: { ...query, limit: Math.max(1, size), offset },
        });
        total = page.total;
        items.push(...page.items.slice(0, Math.max(0, wanted - items.length)));
        offset += page.items.length;
        if (page.items.length === 0 || items.length >= wanted || offset >= total) {
            return { items, total };
        }
    }
};

const countOf = async (
    client: M032ApiClient,
    path: string,
    query: Record<string, number | string | undefined>,
) => (await client.get<M032Page<unknown>>(path, { query: { ...query, limit: 1 } })).total;

// 032 sorts have a fixed direction per key; sortOrder cannot be honoured
// until the server adds an order parameter (see MUSIC032_CHANGES.md, C list).
const ALBUM_SORT: Partial<Record<AlbumListSort, string>> = {
    [AlbumListSort.RECENTLY_ADDED]: 'added',
    [AlbumListSort.RECENTLY_PLAYED]: 'recentlyPlayed',
    [AlbumListSort.RELEASE_DATE]: 'date',
    [AlbumListSort.YEAR]: 'year',
};

const SONG_SORT: Partial<Record<SongListSort, string>> = {
    [SongListSort.NAME]: 'title',
    [SongListSort.PLAY_COUNT]: 'plays',
    [SongListSort.RECENTLY_PLAYED]: 'recentlyPlayed',
    [SongListSort.RELEASE_DATE]: 'date',
    [SongListSort.RELEASE_YEAR]: 'year',
    [SongListSort.YEAR]: 'year',
};

const ARTIST_SORT: Partial<Record<AlbumArtistListSort | ArtistListSort, string>> = {
    [AlbumArtistListSort.ALBUM_COUNT]: 'albums',
    [AlbumArtistListSort.SONG_COUNT]: 'tracks',
};

const albumQuery = (query: {
    artistIds?: string[];
    favorite?: boolean;
    genreIds?: string[];
    maxYear?: number;
    minYear?: number;
    searchTerm?: string;
    sortBy?: AlbumListSort;
}) => ({
    artist: first(query.artistIds),
    genre: first(query.genreIds),
    q: query.searchTerm || undefined,
    sort: query.sortBy ? ALBUM_SORT[query.sortBy] : undefined,
    // /albums only filters an exact year.
    year: query.minYear && query.minYear === query.maxYear ? query.minYear : undefined,
});

const songQuery = (query: {
    albumArtistIds?: string[];
    artistIds?: string[];
    favorite?: boolean;
    genreIds?: string[];
    maxYear?: number;
    minYear?: number;
    searchTerm?: string;
    sortBy?: SongListSort;
}) => ({
    artist: first(query.artistIds) ?? first(query.albumArtistIds),
    genre: first(query.genreIds),
    q: query.searchTerm || undefined,
    sort: query.sortBy ? SONG_SORT[query.sortBy] : undefined,
    yearFrom: query.minYear || undefined,
    yearTo: query.maxYear || undefined,
});

const artistQuery = (
    role: 'album' | 'all',
    query: { favorite?: boolean; searchTerm?: string; sortBy?: string },
) => ({
    favorite: query.favorite ? 'true' : undefined,
    q: query.searchTerm || undefined,
    role,
    sort: query.sortBy ? ARTIST_SORT[query.sortBy as AlbumArtistListSort] : undefined,
});

const sliceFor = <T>(items: T[], startIndex: number, limit?: number) =>
    items.slice(startIndex, limit === undefined || limit < 0 ? undefined : startIndex + limit);

const matchesText = (needle: string | undefined, ...haystack: (null | string | undefined)[]) => {
    if (!needle) return true;
    const n = needle.toLocaleLowerCase();
    return haystack.some((h) => h?.toLocaleLowerCase().includes(n));
};

const hasGenre = (genres: { name: string }[], genre?: string) =>
    !genre || genres.some((g) => g.name.toLocaleLowerCase() === genre.toLocaleLowerCase());

const inYearRange = (year: null | number, minYear?: number, maxYear?: number) =>
    (!minYear || (year ?? 0) >= minYear) && (!maxYear || (year ?? 0) <= maxYear);

// 032's /albums and /tracks silently ignore favorite=true (only /artists
// honours it), so favorite views read /favorites/*. Those endpoints only page,
// so filters, sorting and paging are applied here; favorite sets are small.
const favoriteAlbums = async (
    client: M032ApiClient,
    ctx: M032Context,
    query: {
        artistIds?: string[];
        genreIds?: string[];
        maxYear?: number;
        minYear?: number;
        searchTerm?: string;
        sortBy?: AlbumListSort;
        sortOrder?: SortOrder;
    },
): Promise<Album[]> => {
    let items = (await fetchAll<M032Album>(client, '/favorites/albums')).map((item) =>
        m032Normalize.album(ctx, item),
    );
    const artistId = first(query.artistIds);
    if (artistId) {
        const ids = new Set(
            (await fetchAll<M032Album>(client, '/albums', { artist: artistId })).map((a) =>
                String(a.id),
            ),
        );
        items = items.filter((a) => ids.has(a.id));
    }
    items = items.filter(
        (a) =>
            hasGenre(a.genres, first(query.genreIds)) &&
            inYearRange(a.releaseYear, query.minYear, query.maxYear) &&
            matchesText(query.searchTerm, a.name, a.albumArtistName),
    );
    return query.sortBy
        ? sortAlbumList(items, query.sortBy, query.sortOrder ?? SortOrder.ASC)
        : items;
};

const favoriteSongs = async (
    client: M032ApiClient,
    ctx: M032Context,
    query: {
        albumArtistIds?: string[];
        albumIds?: string[];
        artistIds?: string[];
        genreIds?: string[];
        maxYear?: number;
        minYear?: number;
        searchTerm?: string;
        sortBy?: SongListSort;
        sortOrder?: SortOrder;
    },
): Promise<Song[]> => {
    const albumIds = query.albumIds?.length ? new Set(query.albumIds) : null;
    const artistId = first(query.artistIds) ?? first(query.albumArtistIds);
    const items = (await fetchAll<M032Track>(client, '/favorites/tracks'))
        .map((item) => m032Normalize.song(ctx, item))
        .filter(
            (s) =>
                (!albumIds || albumIds.has(s.albumId)) &&
                (!artistId ||
                    [
                        ...s.artists,
                        ...s.albumArtists,
                        ...Object.values(s.participants ?? {}).flat(),
                    ].some((a) => a.id === artistId)) &&
                hasGenre(s.genres, first(query.genreIds)) &&
                inYearRange(s.releaseYear, query.minYear, query.maxYear) &&
                matchesText(query.searchTerm, s.name, s.album, s.artistName),
        );
    return query.sortBy
        ? sortSongList(items, query.sortBy, query.sortOrder ?? SortOrder.ASC)
        : items;
};

type AlbumFilterQuery = {
    artistIds?: string[];
    compilation?: boolean;
    favorite?: boolean;
    genreIds?: string[];
    maxYear?: number;
    minYear?: number;
    searchTerm?: string;
};

/** An album list scoped to exactly one artist and nothing else: that artist's discography. */
const discographyArtistId = (query: AlbumFilterQuery) =>
    query.artistIds?.length === 1 &&
    !query.favorite &&
    !query.searchTerm &&
    !query.genreIds?.length &&
    !query.minYear &&
    !query.maxYear &&
    query.compilation === undefined
        ? query.artistIds[0]
        : undefined;

// /albums?artist= matches any track role, so it cannot tell personal releases
// from guest spots. /artists/{id} carries the same releases (with relation) the
// 032 web artist page groups; albums only reached through composer/lyricist
// credits are kept as relation=credit so they stay visible.
const artistDiscography = async (
    client: M032ApiClient,
    ctx: M032Context,
    artistId: string,
): Promise<Album[]> => {
    const [detail, matching] = await Promise.all([
        client.get<M032ArtistDetail>(`/artists/${artistId}`),
        fetchAll<M032Album>(client, '/albums', { artist: artistId }),
    ]);
    const releases: Album[] = detail.releases.map((release) => ({
        ...m032Normalize.album(ctx, release),
        _m032Relation: release.relation as Album['_m032Relation'],
    }));
    const seen = new Set(releases.map((album) => album.id));
    const credits: Album[] = matching
        .filter((album) => !seen.has(String(album.id)))
        .map((album) => ({ ...m032Normalize.album(ctx, album), _m032Relation: 'credit' }));
    return [...releases, ...credits];
};

const getPlaylistDetail = (client: M032ApiClient, id: string) =>
    client.get<M032PlaylistDetail>(`/playlists/${id}`);

const sortPlaylists = (items: Playlist[], sortBy: PlaylistListSort, sortOrder: SortOrder) => {
    const dir = sortOrder === SortOrder.DESC ? -1 : 1;
    const key = (p: Playlist): number | string => {
        switch (sortBy) {
            case PlaylistListSort.DURATION:
                return p.duration ?? 0;
            case PlaylistListSort.SONG_COUNT:
                return p.songCount ?? 0;
            default:
                return p.name.toLocaleLowerCase();
        }
    };
    return [...items].sort((a, b) => (key(a) > key(b) ? dir : key(a) < key(b) ? -dir : 0));
};

const similarTracks = async (client: M032ApiClient, songId: string, count?: number) => {
    try {
        const res = await client.get<{ items: M032SimilarTrack[] }>(`/tracks/${songId}/similar`, {
            query: { limit: Math.min(100, Math.max(1, count || 30)) },
        });
        return res.items.map((item) => item.track);
    } catch (error) {
        // Similarity is optional: degrade to an empty mix rather than failing the view.
        logger.warn('032 similar tracks unavailable', {
            error: error instanceof Error ? error.message : String(error),
            songId,
        });
        return [];
    }
};

const TRANSCODE_BITRATES: Record<'mp3' | 'ogg', number[]> = {
    mp3: [128, 192, 256, 320],
    ogg: [64, 96, 128, 160, 192, 256],
};

const transcodeUrl = (
    server: Server,
    id: string,
    query: { bitrate?: number; format?: string; maxSampleRate?: number; startTime?: number },
) => {
    const ctx = m032Context(server);
    const requested = (query.format || 'mp3').toLowerCase();
    const format: 'flac' | 'mp3' | 'ogg' =
        requested === 'flac' ? 'flac' : requested === 'ogg' || requested === 'opus' ? 'ogg' : 'mp3';

    if (format === 'flac') {
        return m032MediaUrl(ctx, `/api/v1/tracks/${id}/transcode.flac`, {
            maxSampleRate: query.maxSampleRate && query.maxSampleRate <= 48000 ? 48000 : undefined,
        });
    }

    const allowed = TRANSCODE_BITRATES[format];
    const bitrate = query.bitrate
        ? [...allowed].reverse().find((b) => b <= query.bitrate!) || allowed[0]
        : undefined;
    return m032MediaUrl(ctx, `/api/v1/tracks/${id}/transcode.${format}`, {
        bitrate,
        offsetMs: query.startTime ? Math.round(query.startTime * 1000) : undefined,
    });
};

const verifyMediaToken = async (baseUrl: string, apiToken: string, mediaToken: string) => {
    const page = await m032RawRequest<M032Page<M032Track>>(baseUrl, apiToken, 'GET', '/tracks', {
        query: { limit: 1 },
    });
    const track = page.items[0];
    if (!track) {
        // Empty library: nothing to probe yet (needs a media ping endpoint server-side).
        logger.warn('032 media token not verified: library is empty');
        return;
    }
    const url = m032MediaUrl({ baseUrl, mediaToken, serverId: '' }, track.streamUrl)!;
    const res = await fetch(url, { headers: { Range: 'bytes=0-0' } });
    res.body?.cancel().catch(() => undefined);
    if (res.status === 401) {
        throw new Error(
            i18n.t('error.music032MediaTokenInvalid', { postProcess: 'sentenceCase' }) as string,
        );
    }
};

export const Music032Controller: InternalControllerEndpoint = {
    addToPlaylist: async ({ apiClientProps, body, query }) => {
        await m032ApiClient(apiClientProps).post(`/playlists/${query.id}/items/append`, {
            trackIds: body.songId.map(Number),
        });
        return null;
    },

    authenticate: async (url, body) => {
        const baseUrl = url.replace(/\/$/, '');
        const apiToken = String(body.token || body.password || '').trim();
        const mediaToken = String(body.mediaToken || '').trim();

        if (!apiToken || !mediaToken) {
            throw new Error(
                i18n.t('error.music032CredentialsRequired', {
                    postProcess: 'sentenceCase',
                }) as string,
            );
        }
        if (apiToken === mediaToken) {
            throw new Error(
                i18n.t('error.music032TokensMustDiffer', { postProcess: 'sentenceCase' }) as string,
            );
        }

        let capabilities: M032Capabilities;
        try {
            capabilities = await m032RawRequest<M032Capabilities>(
                baseUrl,
                apiToken,
                'GET',
                '/capabilities',
            );
        } catch (error) {
            if (error instanceof Music032ApiError && error.status === 401) {
                throw new Error(
                    i18n.t('error.music032ApiTokenInvalid', {
                        postProcess: 'sentenceCase',
                    }) as string,
                );
            }
            throw error;
        }

        if (capabilities.apiRevision !== M032_API_REVISION) {
            throw new Error(
                i18n.t('error.music032UnsupportedRevision', {
                    postProcess: 'sentenceCase',
                    revision: capabilities.apiRevision,
                }) as string,
            );
        }

        await verifyMediaToken(baseUrl, apiToken, mediaToken);

        return {
            credential: apiToken,
            isAdmin: true,
            mediaToken,
            userId: 'music032',
            // 032 is single-user and exposes no account name to API clients.
            username: '032',
        };
    },

    createFavorite: async ({ apiClientProps, query }) => {
        const client = m032ApiClient(apiClientProps);
        const segment = favoriteSegment(query.type);
        for (const id of query.id) {
            await client.put(`/${segment}/${id}/favorite`, undefined);
        }
        return null;
    },

    createInternetRadioStation: async () => unsupported('createInternetRadioStation'),

    createPlaylist: async ({ apiClientProps, body }) => {
        const playlist = await m032ApiClient(apiClientProps).post<M032Playlist>('/playlists', {
            description: body.comment || '',
            name: body.name,
        });
        return { id: String(playlist.id) };
    },

    deleteFavorite: async ({ apiClientProps, query }) => {
        const client = m032ApiClient(apiClientProps);
        const segment = favoriteSegment(query.type);
        for (const id of query.id) {
            await client.delete(`/${segment}/${id}/favorite`);
        }
        return null;
    },

    deleteInternetRadioStation: async () => unsupported('deleteInternetRadioStation'),

    deletePlaylist: async ({ apiClientProps, query }) => {
        await m032ApiClient(apiClientProps).delete(`/playlists/${query.id}`);
        return null;
    },

    deletePlaylistImage: async ({ apiClientProps, query }) => {
        await m032ApiClient(apiClientProps).delete(`/playlists/${query.id}/artwork`);
        return true;
    },

    getAlbumArtistDetail: async ({ apiClientProps, query }) => {
        const ctx = m032Context(apiClientProps.server);
        const res = await m032ApiClient(apiClientProps).get<M032ArtistDetail>(
            `/artists/${query.id}`,
        );
        return m032Normalize.albumArtist(ctx, res.artist);
    },

    getAlbumArtistInfo: async ({ apiClientProps, query }) => {
        const res = await m032ApiClient(apiClientProps).get<M032ArtistDetail>(
            `/artists/${query.id}`,
        );
        return {
            biography: res.artist.biography || null,
            imageUrl: m032MediaUrl(m032Context(apiClientProps.server), res.artist.imageUrl),
            similarArtists: null,
        };
    },

    getAlbumArtistList: async ({ apiClientProps, query }) => {
        const ctx = m032Context(apiClientProps.server);
        const { items, total } = await fetchPage<M032Artist>(
            m032ApiClient(apiClientProps),
            '/artists',
            artistQuery('album', query),
            query.startIndex,
            query.limit,
        );
        return {
            items: items.map((item) => m032Normalize.albumArtist(ctx, item)),
            startIndex: query.startIndex,
            totalRecordCount: total,
        };
    },

    getAlbumArtistListCount: async ({ apiClientProps, query }) =>
        countOf(m032ApiClient(apiClientProps), '/artists', artistQuery('album', query)),

    getAlbumDetail: async ({ apiClientProps, query }) => {
        const ctx = m032Context(apiClientProps.server);
        const client = m032ApiClient(apiClientProps);
        const res = await client.get<M032AlbumDetail>(`/albums/${query.id}`);
        // /albums/{id} embeds at most 500 tracks; /tracks pages through the rest
        // in the same disc/track order.
        const tracks =
            res.album.trackCount > res.tracks.length
                ? await fetchAll<M032Track>(client, '/tracks', { album: query.id })
                : res.tracks;
        return m032Normalize.album(ctx, res.album, tracks);
    },

    getAlbumInfo: async ({ apiClientProps, query }) => {
        const ctx = m032Context(apiClientProps.server);
        const res = await m032ApiClient(apiClientProps).get<M032AlbumDetail>(`/albums/${query.id}`);
        return {
            imageUrl: m032MediaUrl(ctx, res.album.artworkUrl),
            notes: res.album.review || null,
        };
    },

    getAlbumList: async ({ apiClientProps, query }) => {
        const ctx = m032Context(apiClientProps.server);
        if (query.favorite) {
            const all = await favoriteAlbums(m032ApiClient(apiClientProps), ctx, query);
            return {
                items: sliceFor(all, query.startIndex, query.limit),
                startIndex: query.startIndex,
                totalRecordCount: all.length,
            };
        }
        const artistId = discographyArtistId(query);
        if (artistId) {
            const all = await artistDiscography(m032ApiClient(apiClientProps), ctx, artistId);
            const sorted = query.sortBy
                ? sortAlbumList(all, query.sortBy, query.sortOrder ?? SortOrder.ASC)
                : all;
            return {
                items: sliceFor(sorted, query.startIndex, query.limit),
                startIndex: query.startIndex,
                totalRecordCount: sorted.length,
            };
        }
        const { items, total } = await fetchPage<M032Album>(
            m032ApiClient(apiClientProps),
            '/albums',
            albumQuery(query),
            query.startIndex,
            query.limit,
        );
        return {
            items: items.map((item) => m032Normalize.album(ctx, item)),
            startIndex: query.startIndex,
            totalRecordCount: total,
        };
    },

    getAlbumListCount: async ({ apiClientProps, query }) =>
        discographyArtistId(query)
            ? (
                  await artistDiscography(
                      m032ApiClient(apiClientProps),
                      m032Context(apiClientProps.server),
                      discographyArtistId(query)!,
                  )
              ).length
            : query.favorite
              ? (
                    await favoriteAlbums(
                        m032ApiClient(apiClientProps),
                        m032Context(apiClientProps.server),
                        query,
                    )
                ).length
              : countOf(m032ApiClient(apiClientProps), '/albums', albumQuery(query)),

    getAlbumRadio: async ({ apiClientProps, query }) => {
        const ctx = m032Context(apiClientProps.server);
        const client = m032ApiClient(apiClientProps);
        const album = await client.get<M032AlbumDetail>(`/albums/${query.albumId}`);
        const seed = album.tracks[0];
        if (!seed) return [];
        const tracks = await similarTracks(client, String(seed.id), query.count);
        return tracks.map((track) => m032Normalize.song(ctx, track));
    },

    getArtistList: async ({ apiClientProps, query }) => {
        const ctx = m032Context(apiClientProps.server);
        const { items, total } = await fetchPage<M032Artist>(
            m032ApiClient(apiClientProps),
            '/artists',
            artistQuery('all', query),
            query.startIndex,
            query.limit,
        );
        return {
            items: items.map((item) => m032Normalize.albumArtist(ctx, item)),
            startIndex: query.startIndex,
            totalRecordCount: total,
        };
    },

    getArtistListCount: async ({ apiClientProps, query }) =>
        countOf(m032ApiClient(apiClientProps), '/artists', artistQuery('all', query)),

    getArtistRadio: async ({ apiClientProps, query }) => {
        const ctx = m032Context(apiClientProps.server);
        const client = m032ApiClient(apiClientProps);
        const top = await client.get<M032Page<M032Track>>(`/artists/${query.artistId}/tracks`, {
            query: { limit: 1, sort: 'plays' },
        });
        const seed = top.items[0];
        if (!seed) return [];
        const tracks = await similarTracks(client, String(seed.id), query.count);
        return [seed, ...tracks].map((track) => m032Normalize.song(ctx, track));
    },

    getDownloadUrl: ({ apiClientProps, query }) =>
        m032MediaUrl(m032Context(apiClientProps.server), `/api/v1/tracks/${query.id}/stream`) || '',

    getFavoriteSongs: async ({ apiClientProps, query }) => {
        const all = await favoriteSongs(
            m032ApiClient(apiClientProps),
            m032Context(apiClientProps.server),
            { artistIds: query.artistId ? [query.artistId] : undefined },
        );
        return {
            items: sliceFor(all, 0, query.limit),
            startIndex: 0,
            totalRecordCount: all.length,
        };
    },

    getFolder: async () => unsupported('getFolder'),

    // Needs GET /api/v1/genres (C list); until then the genre view stays empty.
    getGenreList: async () => ({ items: [], startIndex: 0, totalRecordCount: 0 }),

    getImageRequest: ({ apiClientProps, query }) => {
        const url = Music032Controller.getImageUrl({ apiClientProps, query });
        return url ? { cacheKey: url, url } : null;
    },

    getImageUrl: ({ apiClientProps, baseUrl, query }) => {
        const ctx = m032Context(apiClientProps.server);
        // imageId carries the server-relative media path (see m032Normalize).
        const path = query.id.startsWith('/')
            ? query.id
            : query.itemType === LibraryItem.PLAYLIST
              ? `/api/v1/playlists/${query.id}/artwork`
              : query.itemType === LibraryItem.ALBUM_ARTIST || query.itemType === LibraryItem.ARTIST
                ? `/api/v1/artists/${query.id}/image`
                : null;
        // size 0 means "original" (fullScreenPlayer default); the server rejects size=0.
        return m032MediaUrl(baseUrl ? { ...ctx, baseUrl: baseUrl.replace(/\/$/, '') } : ctx, path, {
            size: query.size || undefined,
        });
    },

    getInternetRadioStations: async () => [],

    getLyrics: async ({ apiClientProps, query }) => {
        try {
            const res = await m032ApiClient(apiClientProps).get<M032Lyrics>(
                `/tracks/${query.songId}/lyrics`,
            );
            if (!res.synced) return res.lines.map((line) => line.text).join('\n');
            return res.lines.map((line) => ({ startMs: line.timeMs, text: line.text }));
        } catch (error) {
            if (error instanceof Music032ApiError && error.status === 404) return '';
            throw error;
        }
    },

    // 032 serves a single library.
    getMusicFolderList: async () => ({ items: [], startIndex: 0, totalRecordCount: 0 }),

    getPlaylistDetail: async ({ apiClientProps, query }) => {
        const ctx = m032Context(apiClientProps.server);
        const res = await getPlaylistDetail(m032ApiClient(apiClientProps), query.id);
        return m032Normalize.playlist(ctx, res.playlist, res.tracks);
    },

    getPlaylistList: async ({ apiClientProps, query }) => {
        const ctx = m032Context(apiClientProps.server);
        const all = (await fetchAll<M032Playlist>(m032ApiClient(apiClientProps), '/playlists'))
            .map((item) => m032Normalize.playlist(ctx, item))
            .filter(
                (p) =>
                    !query.searchTerm ||
                    p.name.toLocaleLowerCase().includes(query.searchTerm.toLocaleLowerCase()),
            );
        const sorted = sortPlaylists(all, query.sortBy, query.sortOrder);
        const end =
            query.limit === undefined || query.limit < 0
                ? undefined
                : query.startIndex + query.limit;
        return {
            items: sorted.slice(query.startIndex, end),
            startIndex: query.startIndex,
            totalRecordCount: sorted.length,
        };
    },

    getPlaylistListCount: async ({ apiClientProps, query }) =>
        (
            await Music032Controller.getPlaylistList({
                apiClientProps,
                query: { ...query, limit: -1, startIndex: 0 },
            })
        ).totalRecordCount ?? 0,

    getPlaylistSongIds: async ({ apiClientProps, query }) => {
        const res = await getPlaylistDetail(m032ApiClient(apiClientProps), query.id);
        return {
            items: res.tracks.map((t) => String(t.id)),
            startIndex: 0,
            totalRecordCount: res.tracks.length,
        };
    },

    getPlaylistSongList: async ({ apiClientProps, query }) => {
        const ctx = m032Context(apiClientProps.server);
        const res = await getPlaylistDetail(m032ApiClient(apiClientProps), query.id);
        return {
            items: res.tracks.map((track) => ({
                ...m032Normalize.song(ctx, track),
                _contextPlaylistId: query.id,
            })),
            startIndex: 0,
            totalRecordCount: res.tracks.length,
        };
    },

    getPlayQueue: async () => unsupported('getPlayQueue'),

    // Needs sort=random server-side for true randomness (C list). Until then:
    // sample from a random window of the filtered library.
    getRandomSongList: async ({ apiClientProps, query }) => {
        const ctx = m032Context(apiClientProps.server);
        const client = m032ApiClient(apiClientProps);
        const filters = {
            genre: query.genre || undefined,
            yearFrom: query.minYear || undefined,
            yearTo: query.maxYear || undefined,
        };
        const limit = Math.max(1, query.limit || 50);
        const total = await countOf(client, '/tracks', filters);
        const window = Math.min(M032_MAX_PAGE_SIZE, total);
        const offset = Math.floor(Math.random() * Math.max(1, total - window + 1));
        const page = await client.get<M032Page<M032Track>>('/tracks', {
            query: { ...filters, limit: window || 1, offset },
        });
        const shuffled = [...page.items];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const items = shuffled.slice(0, limit).map((track) => m032Normalize.song(ctx, track));
        return { items, startIndex: 0, totalRecordCount: items.length };
    },

    getRoles: async () => [],

    getScanStatus: async () => ({ count: 0, folderCount: 0, scanning: false }),

    getServerInfo: async ({ apiClientProps }) => {
        const capabilities =
            await m032ApiClient(apiClientProps).get<M032Capabilities>('/capabilities');
        const features: Partial<Record<ServerFeature, number[]>> = {
            [ServerFeature.TOP_SONGS_BY_ARTIST_ID]: [1],
        };
        if (capabilities.features.lyrics) {
            features[ServerFeature.LYRICS_SINGLE_STRUCTURED] = [1];
        }
        if (capabilities.features.playlistArtwork) {
            features[ServerFeature.PLAYLIST_IMAGE_UPLOAD] = [1];
        }
        return {
            features,
            id: apiClientProps.server?.id,
            version: `${capabilities.apiVersion}.${capabilities.apiRevision}`,
        };
    },

    getSimilarSongs: async ({ apiClientProps, query }) => {
        const ctx = m032Context(apiClientProps.server);
        const tracks = await similarTracks(
            m032ApiClient(apiClientProps),
            query.songId,
            query.count,
        );
        return tracks
            .filter((track) => String(track.id) !== query.songId)
            .map((track) => m032Normalize.song(ctx, track));
    },

    getSongDetail: async ({ apiClientProps, query }) => {
        const ctx = m032Context(apiClientProps.server);
        const track = await m032ApiClient(apiClientProps).get<M032Track>(`/tracks/${query.id}`);
        return m032Normalize.song(ctx, track);
    },

    getSongList: async ({ apiClientProps, query }) => {
        const ctx = m032Context(apiClientProps.server);
        const client = m032ApiClient(apiClientProps);
        const base = songQuery(query);

        if (query.favorite) {
            const all = await favoriteSongs(client, ctx, query);
            return {
                items: sliceFor(all, query.startIndex, query.limit),
                startIndex: query.startIndex,
                totalRecordCount: all.length,
            };
        }

        // 032 filters a single album per request; feishin asks for several when
        // playing an artist's whole discography.
        if (query.albumIds && query.albumIds.length > 1) {
            const perAlbum = await Promise.all(
                query.albumIds.map((album) =>
                    fetchAll<M032Track>(client, '/tracks', { ...base, album }),
                ),
            );
            const all = perAlbum.flat().map((track) => m032Normalize.song(ctx, track));
            const end =
                query.limit === undefined || query.limit < 0
                    ? undefined
                    : query.startIndex + query.limit;
            return {
                items: all.slice(query.startIndex, end),
                startIndex: query.startIndex,
                totalRecordCount: all.length,
            };
        }

        const { items, total } = await fetchPage<M032Track>(
            client,
            '/tracks',
            { ...base, album: first(query.albumIds) },
            query.startIndex,
            query.limit,
        );
        return {
            items: items.map((item) => m032Normalize.song(ctx, item)),
            startIndex: query.startIndex,
            totalRecordCount: total,
        };
    },

    getSongListCount: async ({ apiClientProps, query }) => {
        if (query.favorite || (query.albumIds && query.albumIds.length > 1)) {
            const res = await Music032Controller.getSongList({
                apiClientProps,
                query: { ...query, limit: -1, startIndex: 0 },
            });
            return res.totalRecordCount ?? 0;
        }
        return countOf(m032ApiClient(apiClientProps), '/tracks', {
            ...songQuery(query),
            album: first(query.albumIds),
        });
    },

    getStreamUrl: async ({ apiClientProps: { server }, query }) => {
        // Original file by default: that is what makes bit-perfect MPV output
        // possible. Only an explicit transcode setting switches to ffmpeg.
        if (query.transcode) {
            return transcodeUrl(server, query.id, query) || '';
        }
        return m032MediaUrl(m032Context(server), `/api/v1/tracks/${query.id}/stream`) || '';
    },

    getTopSongs: async ({ apiClientProps, query }) => {
        const ctx = m032Context(apiClientProps.server);
        const res = await m032ApiClient(apiClientProps).get<M032Page<M032Track>>(
            `/artists/${query.artistId}/tracks`,
            { query: { limit: Math.min(M032_MAX_PAGE_SIZE, query.limit || 50), sort: 'plays' } },
        );
        return {
            items: res.items.map((item) => m032Normalize.song(ctx, item)),
            startIndex: 0,
            totalRecordCount: res.total,
        };
    },

    getUserInfo: async ({ apiClientProps }) => ({
        id: apiClientProps.server?.userId || 'music032',
        isAdmin: true,
        name: apiClientProps.server?.username || '032',
    }),

    movePlaylistItem: async ({ apiClientProps, query }) => {
        const client = m032ApiClient(apiClientProps);
        const detail = await getPlaylistDetail(client, query.playlistId);
        const ids = detail.tracks.map((t) => t.id);
        const [moved] = ids.splice(query.startingIndex, 1);
        if (moved === undefined) return;
        ids.splice(query.endingIndex, 0, moved);
        await client.put(`/playlists/${query.playlistId}/order`, {
            expectedRevision: detail.playlist.revision,
            trackIds: ids,
        });
    },

    refreshItems: async () => unsupported('refreshItems'),

    removeFromPlaylist: async ({ apiClientProps, query }) => {
        const client = m032ApiClient(apiClientProps);
        const remove = async () => {
            const detail = await getPlaylistDetail(client, query.id);
            await client.post(`/playlists/${query.id}/items/remove`, {
                expectedRevision: detail.playlist.revision,
                trackIds: query.songId.map(Number),
            });
        };
        try {
            await remove();
        } catch (error) {
            // Another client edited the playlist in between: re-read the revision once.
            if (error instanceof Music032ApiError && error.code === 'playlist_conflict') {
                await remove();
            } else {
                throw error;
            }
        }
        return null;
    },

    replacePlaylist: async ({ apiClientProps, body, query }) => {
        await m032ApiClient(apiClientProps).put(`/playlists/${query.id}/items`, {
            trackIds: body.songId.map(Number),
        });
        return null;
    },

    savePlayQueue: async () => undefined,

    // Playback is reported by the dedicated session reporter
    // (features/player/hooks/use-music032-playback-reporter.ts); the generic
    // scrobble pipeline has no completion/skip/error semantics for 032.
    scrobble: async () => null,

    search: async ({ apiClientProps, query }) => {
        const ctx = m032Context(apiClientProps.server);
        const client = m032ApiClient(apiClientProps);
        const q = query.query?.trim();
        if (!q) return { albumArtists: [], albums: [], songs: [] };

        const page = <T>(path: string, limit?: number, offset?: number) =>
            limit === 0
                ? Promise.resolve({ items: [] as T[] })
                : client.get<M032Page<T>>(path, {
                      query: {
                          limit: Math.min(M032_MAX_PAGE_SIZE, limit || 20),
                          offset: offset || 0,
                          q,
                      },
                  });

        const [artists, albums, songs] = await Promise.all([
            page<M032Artist>('/artists', query.albumArtistLimit, query.albumArtistStartIndex),
            page<M032Album>('/albums', query.albumLimit, query.albumStartIndex),
            page<M032Track>('/tracks', query.songLimit, query.songStartIndex),
        ]);

        return {
            albumArtists: artists.items.map((item) => m032Normalize.albumArtist(ctx, item)),
            albums: albums.items.map((item) => m032Normalize.album(ctx, item)),
            songs: songs.items.map((item) => m032Normalize.song(ctx, item)),
        };
    },

    setPlaylistSongs: async ({ apiClientProps, body }) => {
        await m032ApiClient(apiClientProps).put(`/playlists/${body.id}/items`, {
            trackIds: body.songIds.map(Number),
        });
        return null;
    },

    startLibraryScan: async () => unsupported('startLibraryScan'),

    updateInternetRadioStation: async () => unsupported('updateInternetRadioStation'),

    updatePlaylist: async ({ apiClientProps, body, query }) => {
        await m032ApiClient(apiClientProps).patch(`/playlists/${query.id}`, {
            description: body.comment || '',
            name: body.name,
        });
        return null;
    },

    uploadPlaylistImage: async ({ apiClientProps, body, query }) => {
        const form = new FormData();
        form.append('image', new Blob([body.image as BlobPart]), 'artwork');
        await m032ApiClient(apiClientProps).put(`/playlists/${query.id}/artwork`, form);
        return true;
    },
};

function favoriteSegment(type: LibraryItem) {
    switch (type) {
        case LibraryItem.ALBUM:
            return 'albums';
        case LibraryItem.ALBUM_ARTIST:
        case LibraryItem.ARTIST:
            return 'artists';
        case LibraryItem.SONG:
            return 'tracks';
        default:
            return unsupported(`favorite:${type}`);
    }
}
