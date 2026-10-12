// Plain JavaScript cannot declare TypeScript return types.
/* eslint-disable @typescript-eslint/explicit-function-return-type */
// Run with: pnpm test:music032  (node --test, Node >= 22.18 strips TS types)
// Exercises the pure 032 playback session + adapter modules with a fake
// transport, clock and timers: no React, no network, no server.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createMusic032PlaybackAdapter } from '../../src/renderer/api/music032/music032-playback-adapter.ts';
import { createPlaybackSession } from '../../src/renderer/api/music032/music032-playback-session.ts';

const A = { durationMillis: 240000, trackId: 1, uniqueId: 'qa' };
const B = { durationMillis: 180000, trackId: 2, uniqueId: 'qb' };

const memoryStorage = () => {
    const map = new Map();
    return {
        getItem: (k) => (map.has(k) ? map.get(k) : null),
        map,
        removeItem: (k) => map.delete(k),
        setItem: (k, v) => map.set(k, String(v)),
    };
};

const createHarness = ({ respond, storage = memoryStorage() } = {}) => {
    const sent = [];
    const keepalive = [];
    const timers = new Map();
    let timerId = 0;
    let uuidN = 0;
    let clock = 1_000_000;

    const transport = async (body, { keepalive: isKeepalive }) => {
        (isKeepalive ? keepalive : sent).push(body);
        if (respond) {
            const custom = respond(body, sent);
            if (custom !== undefined) return custom;
        }
        return { json: { applied: true, state: body.state ?? 'playing' }, status: 200 };
    };

    let adapter;
    const session = createPlaybackSession({
        clearTimeout: (id) => timers.delete(id),
        getDurationMillis: () => adapter.getDurationMillis(),
        getPositionMillis: () => adapter.getPositionMillis(),
        retryDelaysMillis: [],
        setTimeout: (fn, ms) => {
            timerId += 1;
            timers.set(timerId, { fn, ms });
            return timerId;
        },
        storage,
        transport,
        uuid: () => `00000000-0000-4000-8000-${String(++uuidN).padStart(12, '0')}`,
    });
    adapter = createMusic032PlaybackAdapter({ now: () => clock, session });

    return {
        // Apply signals as one player-store action, then flush like the hook does.
        async act(fn) {
            fn(adapter);
            adapter.flush();
            await session.idle();
        },
        adapter,
        advance(ms) {
            clock += ms;
        },
        keepalive,
        async runTimers() {
            const due = [...timers.entries()];
            timers.clear();
            for (const [, t] of due) t.fn();
            await session.idle();
        },
        sent,
        session,
        storage,
        timers,
    };
};

const types = (events) => events.map((e) => `${e.type}:${e.trackId}`);
const ends = (events) => events.filter((e) => e.type === 'end');

/** Plays `track` from the start and moves the playhead to `positionSec`. */
const playTo = async (h, track, positionSec) => {
    await h.act((a) => {
        a.onTrackChange(track);
        a.onStatus('playing');
    });
    for (let s = 1; s <= positionSec; s += 1) {
        h.advance(1000);
        await h.act((a) => a.onProgress(s));
    }
};

describe('032 playback reporting', () => {
    test('normal completion: auto-advance ends with completed at the real final position', async () => {
        const h = createHarness();
        await playTo(h, A, 239);
        // mediaAutoNext: store resets timestamp to 0 and changes the track in one set().
        await h.act((a) => {
            a.onProgress(0);
            a.onTrackChange(B);
        });

        assert.deepEqual(types(h.sent), ['start:1', 'end:1', 'start:2']);
        const [end] = ends(h.sent);
        assert.equal(end.endReason, 'completed');
        assert.equal(end.positionMillis, 239000);
        assert.equal(end.durationMillis, A.durationMillis);
        const startB = h.sent[2];
        assert.equal(startB.positionMillis, 0);
        assert.equal(startB.durationMillis, B.durationMillis);
        assert.notEqual(startB.sessionId, h.sent[0].sessionId);
        assert.equal(startB.resumedFromSessionId, undefined);
    });

    test('track switch: user skip ends the old session with its own data, never the new track', async () => {
        const h = createHarness();
        await playTo(h, A, 42);
        // mediaNext: set() resets timestamp + changes track, MEDIA_NEXT is emitted after set().
        await h.act((a) => {
            a.onProgress(0);
            a.onTrackChange(B);
            a.onUserNavigate();
        });

        const [end] = ends(h.sent);
        assert.equal(end.trackId, A.trackId);
        assert.equal(end.endReason, 'skipped');
        assert.equal(end.positionMillis, 42000);
        assert.equal(end.durationMillis, A.durationMillis);
        assert.equal(end.sessionId, h.sent[0].sessionId);
        // The old end is delivered before the new start.
        assert.deepEqual(types(h.sent), ['start:1', 'end:1', 'start:2']);
    });

    test('next pressed close to the end is still a skip, not a loop restart', async () => {
        const h = createHarness();
        await playTo(h, A, 238);
        await h.act((a) => {
            a.onProgress(0);
            a.onTrackChange(B);
            a.onUserNavigate();
        });
        assert.deepEqual(types(h.sent), ['start:1', 'end:1', 'start:2']);
        assert.equal(ends(h.sent)[0].endReason, 'skipped');
        assert.equal(ends(h.sent)[0].positionMillis, 238000);
    });

    test('seek stays in the same session; "previous" restart is a seek, not a new play', async () => {
        const h = createHarness();
        await playTo(h, A, 30);
        await h.act((a) => {
            a.onProgress(120);
            a.onSeek(120);
        });
        h.advance(5000);
        // mediaPrevious after >10s only emits PLAYER_SEEK_TO_TIMESTAMP(0).
        await h.act((a) => a.onSeek(0));

        assert.deepEqual(types(h.sent), ['start:1', 'seek:1', 'seek:1']);
        assert.equal(h.sent[1].positionMillis, 120000);
        assert.equal(h.sent[2].positionMillis, 0);
        assert.ok(h.sent.every((e) => e.sessionId === h.sent[0].sessionId));
        assert.deepEqual(
            h.sent.map((e) => e.seq),
            [1, 2, 3],
        );
    });

    test('pause then resume reports both transitions at the right positions', async () => {
        const h = createHarness();
        await playTo(h, A, 10);
        await h.act((a) => a.onStatus('paused'));
        await h.act((a) => a.onStatus('playing'));

        assert.deepEqual(types(h.sent), ['start:1', 'pause:1', 'resume:1']);
        assert.equal(h.sent[1].positionMillis, 10000);
        assert.equal(h.sent[2].positionMillis, 10000);
    });

    test('heartbeat cadence: 15s while playing, 60s while paused, with the live position', async () => {
        const h = createHarness();
        await playTo(h, A, 20);
        assert.deepEqual(
            [...h.timers.values()].map((t) => t.ms),
            [15000],
        );
        await h.runTimers();
        const hb = h.sent.at(-1);
        assert.equal(hb.type, 'heartbeat');
        assert.equal(hb.state, 'playing');
        assert.equal(hb.positionMillis, 20000);

        await h.act((a) => a.onStatus('paused'));
        assert.deepEqual(
            [...h.timers.values()].map((t) => t.ms),
            [60000],
        );
    });

    test('repeat-one via MPV (PLAYER_REPEATED) counts as a new play', async () => {
        const h = createHarness();
        await playTo(h, A, 239);
        await h.act((a) => {
            a.onProgress(0);
            a.onRepeated();
        });

        assert.deepEqual(types(h.sent), ['start:1', 'end:1', 'start:1']);
        assert.equal(ends(h.sent)[0].endReason, 'completed');
        assert.equal(ends(h.sent)[0].positionMillis, 239000);
        const restart = h.sent[2];
        assert.notEqual(restart.sessionId, h.sent[0].sessionId);
        assert.equal(restart.resumedFromSessionId, undefined);
        assert.equal(restart.positionMillis, 0);
    });

    test('repeat-one via web <audio loop> is detected from the playhead wrapping', async () => {
        const h = createHarness();
        await playTo(h, A, 239);
        h.advance(1000);
        await h.act((a) => a.onProgress(0.4));
        h.advance(1000);
        await h.act((a) => a.onProgress(1.4));

        assert.deepEqual(types(h.sent), ['start:1', 'end:1', 'start:1']);
        assert.equal(ends(h.sent)[0].endReason, 'completed');
        // A later tick does not restart again.
        h.advance(1000);
        await h.act((a) => a.onProgress(2.4));
        assert.equal(h.sent.length, 3);
    });

    test('a backward seek near the end is not mistaken for a loop', async () => {
        const h = createHarness();
        await playTo(h, A, 235);
        await h.act((a) => {
            a.onProgress(1);
            a.onSeek(1);
        });
        h.advance(1000);
        await h.act((a) => a.onProgress(2));
        assert.deepEqual(types(h.sent), ['start:1', 'seek:1']);
    });

    test('buffering reports buffering and returns to playing', async () => {
        const h = createHarness();
        await playTo(h, A, 5);
        h.adapter.onBuffering(true);
        await h.session.idle();
        h.adapter.onBuffering(false);
        await h.session.idle();
        assert.deepEqual(types(h.sent), ['start:1', 'buffering:1', 'resume:1']);
        assert.equal(h.sent[1].positionMillis, 5000);
    });

    test('a track that starts while buffering starts in buffering state', async () => {
        const h = createHarness();
        await h.act((a) => a.onTrackChange(A));
        h.adapter.onBuffering(true);
        await h.act((a) => a.onStatus('playing'));
        assert.equal(h.sent[0].type, 'start');
        assert.equal(h.sent[0].state, 'buffering');
    });

    test('playback failure ends with error; retrying the same track resumes the chain', async () => {
        const h = createHarness();
        await playTo(h, A, 50);
        h.adapter.onError();
        await h.session.idle();
        // web onErrorPause -> mediaPause
        await h.act((a) => a.onStatus('paused'));
        await h.act((a) => a.onStatus('playing'));

        assert.deepEqual(types(h.sent), ['start:1', 'end:1', 'start:1']);
        assert.equal(ends(h.sent)[0].endReason, 'error');
        assert.equal(ends(h.sent)[0].positionMillis, 50000);
        assert.equal(h.sent[2].resumedFromSessionId, h.sent[0].sessionId);
        assert.equal(h.sent[2].positionMillis, 50000);
    });

    test('decode failure that auto-skips: error end, then a fresh session for the next track', async () => {
        const h = createHarness();
        await playTo(h, A, 3);
        h.adapter.onError();
        await h.act((a) => {
            a.onProgress(0);
            a.onTrackChange(B);
        });
        assert.deepEqual(types(h.sent), ['start:1', 'end:1', 'start:2']);
        assert.equal(ends(h.sent).length, 1);
        assert.equal(ends(h.sent)[0].endReason, 'error');
        assert.equal(h.sent[2].resumedFromSessionId, undefined);
    });

    test('app close sends client_closed via keepalive; next launch resumes without double counting', async () => {
        const storage = memoryStorage();
        const h = createHarness({ storage });
        await playTo(h, A, 150);
        h.adapter.onClose();

        assert.equal(h.keepalive.length, 1);
        const closed = h.keepalive[0];
        assert.equal(closed.type, 'end');
        assert.equal(closed.endReason, 'client_closed');
        assert.equal(closed.positionMillis, 150000);
        assert.equal(closed.sessionId, h.sent[0].sessionId);
        assert.equal(closed.seq, h.sent.at(-1).seq + 1);

        // Restart: same persistent storage, restored queue.
        const h2 = createHarness({ storage });
        // The hook applies the restored track first, then the restored position.
        await h2.act((a) => {
            a.onQueueRestored();
            a.onTrackChange(A);
        });
        await h2.act((a) => a.onProgress(150));
        await h2.act((a) => a.onStatus('playing'));
        assert.equal(h2.sent[0].type, 'start');
        assert.equal(h2.sent[0].resumedFromSessionId, h.sent[0].sessionId);
        assert.equal(h2.sent[0].positionMillis, 150000);
        assert.equal(h2.sent[0].clientId, h.sent[0].clientId);
    });

    test('end of queue (single track): stop + reset still ends completed at the real position', async () => {
        const h = createHarness();
        await playTo(h, A, 239);
        await h.act((a) => {
            a.onProgress(0);
            a.onStatus('stopped');
            a.onSeek(0);
        });
        assert.deepEqual(types(h.sent), ['start:1', 'end:1']);
        assert.equal(ends(h.sent)[0].endReason, 'completed');
        assert.equal(ends(h.sent)[0].positionMillis, 239000);
        // Play again from the start: a new play at position 0.
        await h.act((a) => a.onStatus('playing'));
        assert.equal(h.sent[2].type, 'start');
        assert.equal(h.sent[2].positionMillis, 0);
        assert.equal(h.sent[2].resumedFromSessionId, undefined);
    });

    test('explicit stop mid-track ends with stopped', async () => {
        const h = createHarness();
        await playTo(h, A, 60);
        await h.act((a) => {
            a.onProgress(0);
            a.onStatus('stopped');
        });
        assert.equal(ends(h.sent)[0].endReason, 'stopped');
        assert.equal(ends(h.sent)[0].positionMillis, 60000);
    });

    test('browsing tracks while paused opens no sessions', async () => {
        const h = createHarness();
        await h.act((a) => a.onTrackChange(A));
        await h.act((a) => a.onTrackChange(B));
        await h.act((a) => a.onTrackChange(A));
        assert.equal(h.sent.length, 0);
    });

    test('switching to a non-032 song ends the session and starts nothing', async () => {
        const h = createHarness();
        await playTo(h, A, 20);
        await h.act((a) => {
            a.onProgress(0);
            a.onTrackChange(null);
            a.onUserNavigate();
        });
        assert.deepEqual(types(h.sent), ['start:1', 'end:1']);
        assert.equal(ends(h.sent)[0].positionMillis, 20000);
    });

    test('409 session_expired: one resume with resumedFromSessionId, then the event is re-sent', async () => {
        let expired = false;
        const h = createHarness({
            respond: (body) => {
                if (body.type === 'heartbeat' && !expired) {
                    expired = true;
                    return { json: { error: { code: 'session_expired' } }, status: 409 };
                }
                return undefined;
            },
        });
        await playTo(h, A, 20);
        await h.runTimers();

        const [first, heartbeat, recoveryStart, retried] = h.sent;
        assert.equal(heartbeat.type, 'heartbeat');
        assert.equal(recoveryStart.type, 'start');
        assert.equal(recoveryStart.resumedFromSessionId, first.sessionId);
        assert.equal(recoveryStart.state, 'playing');
        assert.equal(retried.type, 'heartbeat');
        assert.equal(retried.sessionId, recoveryStart.sessionId);
    });

    test('409 resume_invalid blocks reporting until an explicit new play', async () => {
        const h = createHarness({
            respond: (body) =>
                body.resumedFromSessionId
                    ? { json: { error: { code: 'resume_invalid' } }, status: 409 }
                    : undefined,
        });
        await playTo(h, A, 50);
        h.adapter.onError();
        await h.session.idle();
        await h.act((a) => a.onStatus('paused'));
        await h.act((a) => a.onStatus('playing'));
        assert.equal(h.session.isBlocked(), true);
        const count = h.sent.length;
        await h.act((a) => a.onSeek(10));
        assert.equal(h.sent.length, count, 'blocked: no events');

        // An explicit new play lifts the block.
        await h.act((a) => {
            a.onTrackChange(B);
            a.onUserNavigate();
        });
        assert.equal(h.session.isBlocked(), false);
        assert.equal(h.sent.at(-1).type, 'start');
        assert.equal(h.sent.at(-1).trackId, B.trackId);
    });

    test('404 session_not_found on end past the threshold restores the play with start+end', async () => {
        const h = createHarness({
            respond: (body, sent) =>
                body.type === 'end' && sent.filter((e) => e.type === 'end').length === 1
                    ? { json: { error: { code: 'session_not_found' } }, status: 404 }
                    : undefined,
        });
        await playTo(h, A, 200);
        await h.act((a) => {
            a.onProgress(0);
            a.onTrackChange(B);
        });
        const recovered = h.sent.filter((e) => e.trackId === A.trackId);
        assert.deepEqual(types(recovered), ['start:1', 'end:1', 'start:1', 'end:1']);
        assert.equal(recovered[2].state, 'playing');
        assert.equal(recovered[2].positionMillis, 200000);
        // The recovery replays the original reason (200s of 240s is not near the end).
        assert.equal(recovered[3].endReason, 'stopped');
    });

    test('network failure on end gives up after bounded retries without blocking the next track', async () => {
        const h = createHarness({
            respond: (body) => (body.type === 'end' ? { json: null, status: 503 } : undefined),
        });
        await playTo(h, A, 30);
        await h.act((a) => {
            a.onProgress(0);
            a.onTrackChange(B);
            a.onUserNavigate();
        });
        assert.deepEqual(types(h.sent), ['start:1', 'end:1', 'start:2']);
    });
});
