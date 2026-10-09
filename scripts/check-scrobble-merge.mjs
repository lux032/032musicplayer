// Run with: node scripts/check-scrobble-merge.mjs
// Exercise the actual hook callback bodies without React or backend dependencies.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(
    new URL('../src/renderer/features/player/hooks/use-scrobble.ts', import.meta.url),
    'utf8',
);
const callbackBody = (name) => {
    const start = source.indexOf(`    const ${name} = useCallback(`);
    assert.notEqual(start, -1);
    const bodyStart = source.indexOf(') => {', start) + 6;
    const bodyEnd = source.indexOf('\n        },\n        [', bodyStart);
    assert.notEqual(bodyEnd, -1);
    return source.slice(bodyStart, bodyEnd).replaceAll('error as Error', 'error');
};

const helpers = source
    .slice(source.indexOf('const getScrobbleMediaType ='), source.indexOf('export const useScrobble ='))
    .replaceAll('song?: QueueSong', 'song')
    .replaceAll('song: QueueSong', 'song')
    .replaceAll('hasSubmitted: boolean', 'hasSubmitted')
    .replaceAll('timestampSeconds: number', 'timestampSeconds')
    .replaceAll(": 'podcast' | 'song'", '');

const song = (type, extra = {}) => ({
    _itemType: 'song', _serverId: 'server', _serverType: type,
    _uniqueId: 'old', albumId: 'album', duration: 180000, id: 'old', ...extra,
});

function run(type, { submitted = false, resumable = false, sameItem = false } = {}) {
    const events = [];
    const previousSong = song(type, { isResumable: resumable });
    const currentSong = song(type, { _uniqueId: sameItem ? 'old' : 'new', id: 'new', isResumable: resumable });
    const context = {
        ServerType: { JELLYFIN: 'jellyfin', PLEX: 'plex' },
        ServerFeature: { REPORT_PLAYBACK: 'report' },
        PlayerStatus: { PLAYING: 'playing' },
        getServerById: () => ({}), hasFeature: () => false,
        usePlayerStore: { getState: () => ({ getCurrentSong: () => currentSong, player: { status: 'playing' } }) },
        isScrobbleEnabled: true, isPrivateModeEnabled: false, playbackRate: 1,
        sendScrobble: { mutate: ({ query }) => events.push(query) },
        scrobbleSettings: { notify: false },
        logger: { info() {}, debug() {} }, flushScrobbleDebug() {},
        clearTimeout() {}, setTimeout: (fn) => { fn(); return 1; },
        checkScrobbleConditions: () => false,
        SCROBBLE_TRACK_BEGIN_SEC: 5, SCROBBLE_RESTART_PREVIOUS_MIN_SEC: 10, MAX_LISTEN_DELTA_SEC: 5,
        properties: { timestamp: 20, song: currentSong }, prev: { timestamp: 19 },
    };
    for (const [name, value] of Object.entries({
        isCurrentSongScrobbledRef: submitted, listenedMsRef: 0, lastListenSampleTimeRef: 19,
        lastProgressEventRef: 0, previousTimestampRef: 20, previousSongRef: previousSong,
        stopPositionRef: 20, songChangeTimeoutRef: undefined,
        minimumModeRef: 'both', scrobbleAtDurationMsRef: 30000, scrobbleAtPercentageRef: 75,
    })) context[name] = { current: value };
    vm.createContext(context);
    vm.runInContext(helpers, context);
    vm.runInContext(`(() => {${callbackBody('handleScrobbleFromProgress')} })()`, context);
    const progress = events.splice(0);
    vm.runInContext(`(() => {${callbackBody('handleScrobbleFromSongChange')} })()`, context);
    return { progress, events };
}

for (const [type, resumable, submitted, expectedProgress, expectedEvents] of [
    ['plex', false, false, 1, ['stop', 'start']],
    ['plex', false, true, 0, ['start']],
    ['jellyfin', true, false, 1, ['stop', 'start']],
    ['jellyfin', false, false, 0, ['start']],
]) {
    const { progress, events } = run(type, { resumable, submitted });
    assert.equal(progress.length, expectedProgress, `${type} progress`);
    assert.deepEqual(events.map((query) => query.event), expectedEvents, `${type} song change`);
    assert.equal(events.at(-1).duration, 180000);
    if (progress.length) {
        assert.equal(progress[0].position, type === 'plex' ? 20000 : 200000000);
        assert.equal(progress[0].duration, 180000);
    }
    if (events[0].event === 'stop') {
        assert.equal(events[0].id, 'old');
        assert.equal(events[0].position, type === 'plex' ? 20000 : 200000000);
    }
}
assert.deepEqual(run('plex', { sameItem: true }).events.map((query) => query.event), ['start']);
console.log('Scrobble merge checks passed.');
