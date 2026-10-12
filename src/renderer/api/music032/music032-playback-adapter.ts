// Translates feishin player signals into 032 playback session calls.
//
// Pure logic (no runtime imports) so it can be unit tested under node --test.
// The React hook (use-music032-playback-reporter) only forwards store/engine
// events here. Both the web and the MPV engine drive the same player store
// events, so this single mapping covers both.
//
// Batching: one player store action emits several signals synchronously and
// in an order that does not match their meaning. mediaNext, for example,
// resets the timestamp to 0 and changes the track inside set(), and only
// afterwards emits MEDIA_NEXT. Signals are therefore only recorded; the
// hook calls flush() in a microtask, which interprets the whole action at
// once.
//
// Invariants:
//  - an end event always carries the ending track's own last observed
//    position and duration, never the next track's (or the reset 0);
//  - a track gets a session only once it actually plays (no sessions for
//    tracks skipped through while paused);
//  - repeat-one replays end the current play (completed) and start a fresh
//    session without resume, so the server counts each pass;
//  - seeking (including "previous" restarting the track) stays in the same
//    session and never counts a new play.

import type { EndReason, PlaybackSession } from './music032-playback-session';

export type AdapterOptions = {
    now: () => number;
    session: PlaybackSession;
};

export type AdapterStatus = 'paused' | 'playing' | 'stopped';

export type AdapterTrack = {
    durationMillis: number;
    /** 032 track id. */
    trackId: number;
    /** feishin queue item id; distinguishes the same song queued twice. */
    uniqueId: string;
};

/** Positions this close to the end count as a natural finish (covers crossfade pre-roll). */
export const NEAR_END_MS = 20000;
/** A jump from near the end to before this position without a seek is a loop restart. */
const LOOP_RESTART_MAX_MS = 3000;
/** Within this window after a seek, a position jump is the seek, not a loop. */
const SEEK_GRACE_MS = 2000;

type Pending = {
    intent: boolean;
    position?: number;
    repeated: boolean;
    seek?: number;
    status?: AdapterStatus;
    track?: AdapterTrack | null;
};

const emptyPending = (): Pending => ({ intent: false, repeated: false });

export const createMusic032PlaybackAdapter = ({ now, session }: AdapterOptions) => {
    let current: AdapterTrack | null = null;
    let status: AdapterStatus = 'stopped';
    let lastPositionMs = 0;
    let lastSeekAt = -Infinity;
    let buffering = false;
    /** The next start for `current` resumes the persisted chain (restart, error retry). */
    let resumePending = false;
    let pending = emptyPending();

    const toMs = (sec: number) => Math.max(0, Math.round(sec * 1000));

    const isNearEnd = (track: AdapterTrack, positionMs: number) =>
        track.durationMillis > 0 && positionMs >= track.durationMillis - NEAR_END_MS;

    const sessionIsFor = (track: AdapterTrack | null) =>
        !!track && session.hasActiveSession() && session.currentTrackId() === track.trackId;

    const endCurrent = (reason: EndReason) => {
        if (!current || !sessionIsFor(current)) return;
        session.end(reason, {
            durationMillis: current.durationMillis,
            positionMillis: lastPositionMs,
        });
    };

    const startCurrent = () => {
        if (!current) return;
        const opts = {
            durationMillis: current.durationMillis,
            initialState: buffering ? ('buffering' as const) : ('playing' as const),
            positionMillis: lastPositionMs,
        };
        if (resumePending) {
            resumePending = false;
            session.restore(current.trackId, opts);
        } else {
            session.play(current.trackId, opts);
        }
    };

    const applyStatus = (next: AdapterStatus) => {
        const previous = status;
        status = next;
        if (!current || next === previous) return;
        if (next === 'playing') {
            if (sessionIsFor(current)) session.notifyPlaying(lastPositionMs);
            else startCurrent();
        } else if (next === 'paused') {
            if (sessionIsFor(current)) session.notifyPaused(lastPositionMs);
        } else {
            // stopped: end of queue (near the end) or an explicit stop.
            endCurrent(isNearEnd(current, lastPositionMs) ? 'completed' : 'stopped');
        }
    };

    const flush = () => {
        const p = pending;
        pending = emptyPending();

        const trackChanged =
            p.track !== undefined &&
            !(current && p.track && current.uniqueId === p.track.uniqueId) &&
            !(current === null && p.track === null);

        if (trackChanged) {
            if (current) {
                // A user action in the same batch (next/prev/play from list) is a
                // skip; otherwise the player advanced on its own.
                const reason: EndReason = p.intent
                    ? 'skipped'
                    : isNearEnd(current, lastPositionMs)
                      ? 'completed'
                      : 'stopped';
                endCurrent(reason);
                // A pending resume belongs to the track it was armed for; only the
                // initial assignment after mount (current === null) keeps it.
                resumePending = false;
            }
            current = p.track!;
            // The batch's position is the store's reset, not progress of the new track.
            lastPositionMs = 0;
            buffering = false;
            if (p.status !== undefined) {
                status = p.status;
            }
            if (current && status === 'playing') startCurrent();
            return;
        }

        if (!current) {
            if (p.status !== undefined) status = p.status;
            return;
        }

        // Same track. A stop is judged on the position before the store reset it.
        if (p.status === 'stopped') {
            applyStatus('stopped');
            lastPositionMs = p.seek ?? p.position ?? lastPositionMs;
            return;
        }

        const t = now();
        const wrapped =
            p.position !== undefined &&
            p.seek === undefined &&
            t - lastSeekAt > SEEK_GRACE_MS &&
            isNearEnd(current, lastPositionMs) &&
            p.position < LOOP_RESTART_MAX_MS &&
            lastPositionMs - p.position > NEAR_END_MS / 2;

        if (p.repeated || wrapped) {
            // Repeat-one: MPV signals it (PLAYER_REPEATED); the web engine loops
            // the <audio> element and only the playhead wraps around.
            endCurrent('completed');
            lastPositionMs = 0;
            if (p.status !== undefined) status = p.status;
            if (status === 'playing') startCurrent();
            return;
        }

        if (p.seek !== undefined) {
            lastSeekAt = t;
            lastPositionMs = p.seek;
            if (sessionIsFor(current)) session.notifySeek(lastPositionMs);
        } else if (p.position !== undefined) {
            lastPositionMs = p.position;
        }

        if (p.status !== undefined) applyStatus(p.status);
    };

    return {
        /** Interprets every signal recorded since the last flush. */
        flush,

        getDurationMillis: () => current?.durationMillis ?? 0,
        /** Live position of the current track, used for heartbeats. */
        getPositionMillis: () => lastPositionMs,

        /** Buffering state from the engine (stall / recovered). */
        onBuffering(isBuffering: boolean) {
            flush();
            buffering = isBuffering;
            if (!sessionIsFor(current) || status !== 'playing') return;
            if (isBuffering) session.notifyBuffering(lastPositionMs);
            else session.notifyPlaying(lastPositionMs);
        },

        /** App / window is closing. */
        onClose() {
            flush();
            if (!current || !sessionIsFor(current)) return;
            session.suspend({
                durationMillis: current.durationMillis,
                positionMillis: lastPositionMs,
            });
            resumePending = true;
        },

        /** Engine reported a playback failure for the current track. */
        onError() {
            flush();
            if (!current) return;
            endCurrent('error');
            // A retry of the same track continues the interrupted chain.
            resumePending = true;
        },

        onProgress(positionSec: number) {
            pending.position = toMs(positionSec);
        },

        /** Queue restored on startup: the first play resumes the persisted chain. */
        onQueueRestored() {
            resumePending = true;
        },

        /** Repeat-one replay signalled by the player store. */
        onRepeated() {
            pending.repeated = true;
        },

        onSeek(positionSec: number) {
            pending.seek = toMs(positionSec);
        },

        onStatus(next: AdapterStatus) {
            pending.status = next;
        },

        /** Current queue item changed; pass null for "nothing / not a 032 song". */
        onTrackChange(next: AdapterTrack | null) {
            pending.track = next;
        },

        /** Explicit user navigation (next / previous / play from a list). */
        onUserNavigate() {
            pending.intent = true;
        },
    };
};

export type Music032PlaybackAdapter = ReturnType<typeof createMusic032PlaybackAdapter>;
