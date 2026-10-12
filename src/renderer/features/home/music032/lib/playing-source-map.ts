// ponytail: session-scoped work → track ids map, filled when a work/series is
// expanded for playback; capped at 200 entries. Cards of works played from
// other surfaces stay unmarked until the backend exposes track → works (C11).
const MAX_SOURCES = 200;
const workTracks = new Map<number, Set<number>>();
const listeners = new Set<() => void>();
let version = 0;

const emit = () => {
    version += 1;
    listeners.forEach((listener) => listener());
};

export const recordWorkTracks = (workId: number, trackIds: Iterable<number>) => {
    if (workTracks.has(workId)) workTracks.delete(workId);
    workTracks.set(workId, new Set(trackIds));
    while (workTracks.size > MAX_SOURCES) {
        const oldest = workTracks.keys().next().value;
        if (oldest === undefined) break;
        workTracks.delete(oldest);
    }
    emit();
};

export const workContainsTrack = (workId: number, trackId: number): boolean =>
    workTracks.get(workId)?.has(trackId) ?? false;

export const subscribePlayingSource = (callback: () => void) => {
    listeners.add(callback);
    return () => {
        listeners.delete(callback);
    };
};

export const getPlayingSourceVersion = () => version;
