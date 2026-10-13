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
    /** Human-readable totalBytes, e.g. "1.2 GB". */
    totalSize?: string;
    trackCount: number;
    updatedAt: string;
    version: string;
    year: number;
};

export type M032AlbumDetail = {
    album: M032Album;
    tracks: M032Track[];
};

export type M032AlbumWork = {
    albumId: number;
    albumRole?: string;
    albumType?: string;
    artist?: string;
    artworkUrl?: string;
    discCount?: number;
    role: string;
    season: number;
    source: string;
    title: string;
    trackCount?: number;
    trackRoles?: string[];
    workId: number;
    year?: number;
};

/** GET /api/v1/albums/{id}/works: one row per work (album-level link or first linked track). */
export type M032AlbumWorkLink = {
    id: number;
    role: string;
    source: string;
    title: string;
    trackId?: number;
    trackTitle?: string;
    type: string;
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

export type M032HomeAlbumPane = {
    album: M032Album;
    focus: string;
    noteTime: string;
    play: M032PlayRef;
    previewDurationMillis: number;
    resume: M032PlaybackRecord | null;
    tracks: M032Track[];
};

export type M032HomeChronicle = {
    result: M032HomeChronicleResult;
    selectedYear: number;
    years: { count: number; year: number }[];
};

export type M032HomeChronicleResult = {
    albums: M032Album[];
    total: number;
    year: number;
};

export type M032HomeResponse = {
    chronicle: M032HomeChronicle | null;
    empty: boolean;
    generatedAt: string;
    playlists: M032Playlist[];
    recentAlbums: M032Album[];
    resume: M032PlaybackRecord[];
    rotationDay: string;
    songs: M032RotationPage<M032HomeSongRow>;
    spotlight: M032HomeSpotlight | null;
    stats: {
        albums: number;
        lastScanAt: string;
        pendingReviewCount: number;
        tracks: number;
        works: number;
    };
    works: M032RotationPage<M032HomeWorkCard>;
};

export type M032HomeSeriesPane = {
    albumCount: number;
    albums: { album: M032AlbumWork; play: M032PlayRef; workId: number; workTitle: string }[];
    isSeries: boolean;
    play: M032PlayRef;
    seriesId: number;
    title: string;
    trackTotal: number;
    workIds: number[];
    works: { roleCounts: M032RoleCount[]; work: M032Work }[];
    yearFrom: number;
    yearTo: number;
};

export type M032HomeSongRow = {
    play: M032PlayRef;
    role: string;
    track: M032Track;
    work: { id: number; title: string; year: number };
};

export type M032HomeSpotlight = {
    defaultTab: string;
    listening: M032HomeAlbumPane | null;
    random: M032HomeAlbumPane | null;
    recent: M032HomeAlbumPane | null;
    series: M032HomeSeriesPane | null;
    tabs: string[];
};

export type M032HomeWorkCard = {
    artworkUrl: string;
    coverUrl: string;
    id: number;
    play: M032PlayRef;
    posterUrl: string;
    roleCounts: M032RoleCount[];
    series: null | { id: number; title: string };
    title: string;
    trackCount: number;
    workType: string;
    year: number;
};

export type M032Lyrics = {
    lines: { text: string; timeMs: number }[];
    synced: boolean;
};

// ---------------------------------------------------------------------------
// Home API (/api/v1/home*, docs/api/home.md in 032music-server)
// ---------------------------------------------------------------------------

export type M032Page<T> = {
    items: T[];
    limit: number;
    offset: number;
    total: number;
};

export type M032PlaybackRecord = {
    durationMillis: number;
    lastPlayedAt: string;
    playCount: number;
    positionMillis: number;
    skipCount?: number;
    state?: string;
    track: M032Track;
    trackId: number;
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

export type M032PlayRef = {
    id: number;
    type: M032PlayType;
};

export type M032PlayType = 'album' | 'playlist' | 'series' | 'track' | 'work';

export type M032RoleCount = {
    count: number;
    role: string;
};

export type M032RotationPage<T> = {
    batch: number;
    count: number;
    generation: string;
    items: T[];
    pages: number;
    renewed: boolean;
    type?: string;
};

/** GET /api/v1/series 的条目 / 详情里的 series 对象。 */
export type M032Series = {
    createdAt: string;
    id: number;
    memberCount: number;
    posterUrl: string;
    representativeWorkId: number;
    title: string;
    titleSource: 'auto' | 'manual' | string;
    typeCounts: { count: number; type: string }[];
    updatedAt: string;
};

/** GET /api/v1/series/{id}/albums 的条目（与主页 spotlight.series.albums[] 相同）。 */
export type M032SeriesAlbumEntry = {
    album: M032AlbumWork;
    play: M032PlayRef;
    workId: number;
    workTitle: string;
};

/** GET /api/v1/series/{id}。 */
export type M032SeriesDetail = {
    members: M032SeriesMember[];
    play: M032PlayRef;
    series: M032Series;
    stats: {
        albumCount: number;
        memberCount: number;
        trackCount: number;
        yearFrom: number;
        yearTo: number;
    };
};

/** GET /api/v1/series/{id} 的成员作品（字段与主页 WorkCard 对齐）。 */
export type M032SeriesMember = {
    id: number;
    play: M032PlayRef;
    posterUrl: string;
    readingTitle: string;
    source: 'auto' | 'manual' | string;
    title: string;
    trackCount: number;
    translatedTitle: string;
    workType: string;
    year: number;
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

export type M032Work = {
    createdAt: string;
    externalId: string;
    id: number;
    origin?: string;
    posterUrl: string;
    readingTitle: string;
    title: string;
    trackCount: number;
    translatedTitle: string;
    type: string;
    typeLocked: boolean;
    updatedAt: string;
    year: number;
};

/** GET /api/v1/works/{id}：Work + 详情扩展字段。 */
export type M032WorkDetail = M032Work & {
    bangumiSubjectId: string;
    posterApiUrl: string;
    series: M032WorkSeriesRef | null;
    seriesLocked: boolean;
};

/** GET /api/v1/works/{id} 里所属系列的扩展字段（能力位 workSeriesInfo）。 */
export type M032WorkSeriesRef = {
    id: number;
    memberCount: number;
    position: number;
    source: string;
    title: string;
    titleSource: string;
};

export type M032WorkTrack = M032Track & {
    role: string;
    season: number;
    sequence: number;
    source: string;
};
