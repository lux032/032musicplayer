// ponytail: session-scoped source → track ids map, filled when a work/series is
// expanded for playback; capped at 200 entries. Cards of sources played from
// other surfaces stay unmarked until the backend exposes track → works (C11).
const MAX_SOURCES = 200;
const sourceTracks = new Map<string, Set<number>>();
const listeners = new Set<() => void>();
let version = 0;

const emit = () => {
    version += 1;
    listeners.forEach((listener) => listener());
};

const record = (key: string, trackIds: Iterable<number>) => {
    if (sourceTracks.has(key)) sourceTracks.delete(key);
    sourceTracks.set(key, new Set(trackIds));
    while (sourceTracks.size > MAX_SOURCES) {
        const oldest = sourceTracks.keys().next().value;
        if (oldest === undefined) break;
        sourceTracks.delete(oldest);
    }
    emit();
};

export const recordWorkTracks = (workId: number, trackIds: Iterable<number>) =>
    record(`work:${workId}`, trackIds);

export const recordSeriesTracks = (seriesId: number, trackIds: Iterable<number>) =>
    record(`series:${seriesId}`, trackIds);

export const workContainsTrack = (workId: number, trackId: number): boolean =>
    sourceTracks.get(`work:${workId}`)?.has(trackId) ?? false;

export const seriesContainsTrack = (seriesId: number, trackId: number): boolean =>
    sourceTracks.get(`series:${seriesId}`)?.has(trackId) ?? false;

export const subscribePlayingSource = (callback: () => void) => {
    listeners.add(callback);
    return () => {
        listeners.delete(callback);
    };
};

export const getPlayingSourceVersion = () => version;
