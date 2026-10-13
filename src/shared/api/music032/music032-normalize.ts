import {
    M032Album,
    M032Artist,
    M032ArtistRef,
    M032Playlist,
    M032Track,
} from '/@/shared/api/music032/music032-types';
import {
    Album,
    AlbumArtist,
    Genre,
    LibraryItem,
    Playlist,
    RelatedArtist,
    ServerType,
    Song,
} from '/@/shared/types/domain-types';

export type M032Context = {
    baseUrl: string;
    mediaToken: string;
    serverId: string;
};

/**
 * Turns a server-relative media path (artwork, artist image, stream) into an
 * absolute URL carrying the media token. The API token is never placed in a URL.
 */
export const m032MediaUrl = (
    ctx: M032Context,
    path: null | string | undefined,
    params: Record<string, number | string | undefined> = {},
): null | string => {
    if (!path) return null;

    const url = new URL(path, `${ctx.baseUrl}/`);
    url.searchParams.set('mediaToken', ctx.mediaToken);
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
    }
    return url.toString();
};

const nullIfEmpty = (value: null | string | undefined) => (value ? value : null);

const toIsoOrNow = (value: null | string | undefined) => value || new Date().toISOString();

const genres = (ctx: M032Context, csv: string | undefined): Genre[] =>
    (csv || '')
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => ({
            _itemType: LibraryItem.GENRE,
            _serverId: ctx.serverId,
            _serverType: ServerType.MUSIC032,
            albumCount: null,
            // 032 filters genres by name, so the name doubles as the id.
            id: name,
            imageId: null,
            imageUrl: null,
            name,
            songCount: null,
        }));

const relatedArtist = (ref: M032ArtistRef): RelatedArtist => ({
    id: String(ref.id),
    imageId: null,
    imageUrl: null,
    name: ref.name,
    userFavorite: false,
    userRating: null,
});

const nameOnlyArtist = (name: string): RelatedArtist[] =>
    name ? [{ ...relatedArtist({ id: 0, name }), id: '' }] : [];

const parseYear = (date: string | undefined) => {
    const year = Number((date || '').slice(0, 4));
    return Number.isFinite(year) && year > 0 ? year : null;
};

const normalizeSong = (ctx: M032Context, item: M032Track, albumArtists?: RelatedArtist[]): Song => {
    const artists = item.artists?.length
        ? item.artists.map(relatedArtist)
        : nameOnlyArtist(item.artist);
    const participants: Record<string, RelatedArtist[]> = {};
    for (const credit of item.credits || []) {
        if (credit.artists?.length) {
            participants[credit.role] = credit.artists.map(relatedArtist);
        }
    }
    const year = item.year > 0 ? item.year : null;
    const resolvedAlbumArtists = albumArtists?.length ? albumArtists : artists;

    return {
        _itemType: LibraryItem.SONG,
        _serverId: ctx.serverId,
        _serverType: ServerType.MUSIC032,
        album: item.album || null,
        albumArtistName: resolvedAlbumArtists.map((a) => a.name).join(', '),
        albumArtists: resolvedAlbumArtists,
        albumId: String(item.albumId),
        artistName: item.artist,
        artists,
        bitDepth: item.bitDepth || null,
        bitRate: item.bitrateKbps || 0,
        blurHash: null,
        bpm: null,
        channels: item.channels || null,
        codec: item.codec || null,
        comment: null,
        compilation: null,
        container: item.codec || item.container || null,
        createdAt: toIsoOrNow(item.addedAt),
        date: year ? String(year) : null,
        discNumber: item.discNumber || 1,
        discSubtitle: null,
        duration: item.durationMillis || 0,
        explicitStatus: null,
        folderId: null,
        gain: null,
        genres: genres(ctx, item.genres),
        id: String(item.id),
        imageId: nullIfEmpty(item.artworkUrl),
        imageUrl: null,
        lastPlayedAt: nullIfEmpty(item.lastPlayedAt),
        libraryId: null,
        libraryName: null,
        lyrics: null,
        mbzAlbumId: null,
        mbzAlbumType: null,
        mbzRecordingId: null,
        mbzReleaseGroupId: null,
        mbzTrackId: null,
        missing: item.missing ?? null,
        name: item.title,
        originalDate: null,
        originalYear: year,
        participants: Object.keys(participants).length ? participants : null,
        path: nullIfEmpty(item.relativePath),
        peak: null,
        playCount: item.playCount || 0,
        // 032 playlists never hold the same track twice, so the track id is
        // a stable playlist item id.
        playlistItemId: String(item.id),
        releaseDate: null,
        releaseYear: year,
        sampleRate: item.sampleRate || null,
        size: item.fileSize || 0,
        sortName: item.title,
        tags: null,
        thumbHash: null,
        trackNumber: item.trackNumber || 0,
        trackSubtitle: null,
        updatedAt: toIsoOrNow(item.updatedAt),
        userFavorite: Boolean(item.isFavorite),
        userRating: null,
        year,
    };
};

const normalizeAlbum = (ctx: M032Context, item: M032Album, tracks?: M032Track[]): Album => {
    const albumArtists = item.artists?.length
        ? item.artists.map(relatedArtist)
        : nameOnlyArtist(item.artist);
    const songs = tracks?.map((track) => normalizeSong(ctx, track, albumArtists));
    const duration = tracks ? tracks.reduce((sum, t) => sum + (t.durationMillis || 0), 0) : null;
    const releaseYear = item.year > 0 ? item.year : parseYear(item.releaseDate);
    // releaseKind already folds in manual edits and inference; empty means unknown.
    const releaseKind = item.releaseKind || item.albumType;

    return {
        _itemType: LibraryItem.ALBUM,
        _serverId: ctx.serverId,
        _serverType: ServerType.MUSIC032,
        albumArtistName: item.artist,
        albumArtists,
        artists: albumArtists,
        blurHash: null,
        comment: nullIfEmpty(item.review),
        createdAt: toIsoOrNow(item.addedAt),
        discs: null,
        dominantColor: null,
        duration,
        explicitStatus: null,
        gain: null,
        genres: genres(ctx, item.genres),
        id: String(item.id),
        imageId: nullIfEmpty(item.artworkUrl),
        imageUrl: null,
        isCompilation: item.compilation,
        lastPlayedAt: nullIfEmpty(item.lastPlayedAt),
        mbzId: null,
        mbzReleaseGroupId: null,
        missing: null,
        name: item.title,
        originalDate: nullIfEmpty(item.originalReleaseDate),
        originalYear: parseYear(item.originalReleaseDate),
        participants: null,
        peak: null,
        playCount: null,
        ratedAt: null,
        recordLabels: item.label ? [item.label] : [],
        releaseDate: nullIfEmpty(item.releaseDate) ?? (releaseYear ? String(releaseYear) : null),
        releaseType: nullIfEmpty(releaseKind),
        releaseTypes: releaseKind ? [releaseKind] : [],
        releaseYear,
        size: item.totalBytes || null,
        songCount: item.trackCount ?? songs?.length ?? null,
        songs,
        sortName: item.title,
        starredAt: null,
        tags: null,
        thumbHash: null,
        trackYearRange: null,
        updatedAt: toIsoOrNow(item.updatedAt),
        userFavorite: Boolean(item.isFavorite),
        userRating: null,
        version: nullIfEmpty(item.version),
    };
};

const normalizeAlbumArtist = (
    ctx: M032Context,
    item: M032Artist & { biography?: string },
): AlbumArtist => ({
    _itemType: LibraryItem.ALBUM_ARTIST,
    _serverId: ctx.serverId,
    _serverType: ServerType.MUSIC032,
    albumCount: item.albumCount ?? null,
    biography: nullIfEmpty(item.biography),
    blurHash: null,
    dominantColor: null,
    duration: null,
    genres: [],
    id: String(item.id),
    imageId: nullIfEmpty(item.imageUrl),
    imageUrl: null,
    lastPlayedAt: null,
    mbz: null,
    missing: null,
    name: item.name,
    playCount: null,
    ratedAt: null,
    similarArtists: null,
    songCount: item.trackCount ?? null,
    starredAt: null,
    thumbHash: null,
    userFavorite: Boolean(item.isFavorite),
    userRating: null,
});

const normalizePlaylist = (
    ctx: M032Context,
    item: M032Playlist,
    tracks?: M032Track[],
): Playlist => ({
    _itemType: LibraryItem.PLAYLIST,
    _serverId: ctx.serverId,
    _serverType: ServerType.MUSIC032,
    blurHash: null,
    description: nullIfEmpty(item.description),
    dominantColor: null,
    duration: tracks ? tracks.reduce((sum, t) => sum + (t.durationMillis || 0), 0) : null,
    evaluatedAt: null,
    genres: [],
    id: String(item.id),
    imageId: item.artworkUrl || `/api/v1/playlists/${item.id}/artwork`,
    imageUrl: null,
    name: item.name,
    owner: null,
    ownerId: null,
    public: null,
    rules: null,
    size: null,
    songCount: item.itemCount ?? tracks?.length ?? null,
    sync: null,
    thumbHash: null,
});

export const m032Normalize = {
    album: normalizeAlbum,
    albumArtist: normalizeAlbumArtist,
    playlist: normalizePlaylist,
    song: normalizeSong,
};
