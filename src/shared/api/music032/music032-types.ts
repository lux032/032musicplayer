// Wire types for 032 Music Server API v1 (apiRevision 3).
// Source of truth: internal/storage/*.go and internal/http/*.go in 032music-server.

export type M032Album = {
    addedAt: string;
    albumType: string;
    artist: string;
    artists?: M032ArtistRef[];
    artworkUrl: string;
    bootleg: boolean;
    catalogNumber: string;
    compilation: boolean;
    country: string;
    discCount: number;
    formats: string;
    genres: string;
    id: number;
    isFavorite: boolean;
    label: string;
    lastPlayedAt?: string;
    live: boolean;
    originalReleaseDate: string;
    performedBy: string;
    releaseDate: string;
    releaseKind: string;
    review: string;
    title: string;
    totalBytes: number;
    trackCount: number;
    updatedAt: string;
    version: string;
    year: number;
};

export type M032AlbumDetail = {
    album: M032Album;
    tracks: M032Track[];
};

export type M032ApiErrorBody = {
    error?: { code?: string; message?: string };
};

export type M032Artist = {
    albumCount: number;
    id: number;
    imageUrl: string;
    isFavorite: boolean;
    name: string;
    trackCount: number;
};

export type M032ArtistDetail = {
    albums: M032Album[];
    artist: M032Artist & {
        aliases: string[];
        artistType: string;
        biography: string;
        biographySource: string;
        country: string;
        mergedFrom: number;
    };
    releases: (M032Album & { relation: string })[];
    topTracks: M032Track[];
    topTracksArePopular: boolean;
    tracksTotal: number;
};

export type M032ArtistRef = {
    id: number;
    name: string;
};

export type M032Capabilities = {
    apiRevision: number;
    apiVersion: string;
    features: Record<string, boolean>;
    transcode?: {
        available: boolean;
        formats: Partial<Record<'flac' | 'mp3' | 'ogg', M032TranscodeFormat>>;
    };
};

export type M032Lyrics = {
    lines: { text: string; timeMs: number }[];
    synced: boolean;
};

export type M032Page<T> = {
    items: T[];
    limit: number;
    offset: number;
    total: number;
};

export type M032Playlist = {
    artworkUrl?: string;
    createdAt: string;
    description: string;
    hasCustomArtwork: boolean;
    id: number;
    itemCount: number;
    name: string;
    revision: number;
    updatedAt: string;
};

export type M032PlaylistDetail = {
    playlist: M032Playlist;
    tracks: M032Track[];
};

export type M032PlaylistItemResult = {
    added: number;
    removed: number;
    revision: number;
    skippedDuplicate: number;
    skippedInvalid: number;
    total: number;
};

export type M032SimilarTrack = {
    distance: number;
    reasons: string[];
    score: number;
    track: M032Track;
};

export type M032Status = {
    status: string;
    version: string;
};

export type M032Track = {
    addedAt: string;
    album: string;
    albumId: number;
    arranger: string;
    artist: string;
    artists?: M032ArtistRef[];
    artworkUrl: string;
    bitDepth?: number;
    bitrateKbps?: number;
    channels?: number;
    codec?: string;
    composer: string;
    container: string;
    credits?: M032TrackCredit[];
    discNumber: number;
    durationMillis: number;
    fileSize: number;
    genres: string;
    id: number;
    isFavorite: boolean;
    lastPlayedAt?: string;
    lyricist: string;
    mimeType: string;
    missing?: boolean;
    playCount: number;
    positionMillis: number;
    relativePath: string;
    sampleRate?: number;
    streamUrl: string;
    title: string;
    trackNumber: number;
    trackType: string;
    updatedAt: string;
    year: number;
};

export type M032TrackCredit = {
    artists: M032ArtistRef[];
    role: string;
};

export type M032TranscodeFormat = {
    available: boolean;
    bitrates?: number[];
    default?: number;
    maxSampleRates?: number[];
};
