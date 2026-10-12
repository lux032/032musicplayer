// 032 Music Server playback session protocol (apiRevision 3).
//
// TypeScript port of 032music-server internal/http/assets/playback-reporter.js,
// which is the reference implementation; keep the semantics in sync with it.
//
// Pure logic: network, clock, timers, storage and uuid are injected so the
// module runs under `node --test` without a DOM or a server. Keep it free of
// runtime imports and non-erasable TypeScript syntax (enums, namespaces).
//
// Desktop differences from the web reference:
//  - the resume snapshot and the resume_invalid block live in persistent
//    storage (localStorage), so an app restart resumes the chain the same way
//    a browser refresh does;
//  - every event takes an explicit position/duration from the caller; the
//    probe is only used for heartbeats of the live session.

export type EndReason =
    | 'client_closed'
    | 'completed'
    | 'error'
    | 'replaced'
    | 'skipped'
    | 'stopped';
export type EventPosition = { durationMillis?: number; positionMillis?: number };
export type EventType = 'buffering' | 'end' | 'heartbeat' | 'pause' | 'resume' | 'seek' | 'start';

export type KeyValueStorage = {
    getItem: (key: string) => null | string;
    removeItem: (key: string) => void;
    setItem: (key: string, value: string) => void;
};

export type PlaybackEventBody = {
    clientId: string;
    clientKind: string;
    durationMillis: number;
    endReason?: EndReason;
    positionMillis: number;
    resumedFromSessionId?: string;
    seq: number;
    sessionId: string;
    state?: PlaybackState;
    trackId: number;
    type: EventType;
};

export type PlaybackSessionOptions = {
    clearTimeout?: (id: unknown) => void;
    clientKind?: string;
    getDurationMillis?: () => number;
    getPositionMillis?: () => number;
    heartbeatActiveMillis?: number;
    heartbeatPausedMillis?: number;
    onProtocolError?: (info: { reason: string; sessionId: string; trackId: number }) => void;
    retryDelaysMillis?: number[];
    setTimeout?: (fn: () => void, ms: number) => unknown;
    storage?: KeyValueStorage | null;
    storagePrefix?: string;
    transport: Transport;
    uuid: () => string;
};

export type PlaybackState = 'buffering' | 'paused' | 'playing';

export type PlayOptions = {
    durationMillis?: number;
    initialState?: PlaybackState;
    positionMillis?: number;
    reason?: EndReason;
};

export type Transport = (
    body: PlaybackEventBody,
    options: { keepalive: boolean },
) => Promise<TransportResponse>;

export type TransportResponse = null | {
    json: any;
    status: number;
};

type Job = {
    durationMillis: number;
    endReason: EndReason | null;
    positionMillis: number;
    priorState: null | PlaybackState;
    recoveryDepth: number;
    refreshPosition: boolean;
    resumeFrom: null | string;
    session: Session;
    state: null | PlaybackState;
    type: EventType;
};

type JobExtra = {
    durationMillis?: number;
    endReason?: EndReason;
    positionMillis?: number;
    recoveryDepth?: number;
    refreshPosition?: boolean;
    resumeFrom?: null | string;
    state?: PlaybackState;
};

type Session = {
    endDelivered: boolean;
    ended: boolean;
    endGivenUp: boolean;
    hasPlayed: boolean;
    id: string;
    missingRecoveryDone: boolean;
    seq: number;
    started: boolean;
    state: PlaybackState;
    superseded: boolean;
    trackId: number;
};

const CLIENT_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

export const createPlaybackSession = (options: PlaybackSessionOptions) => {
    const transport = options.transport;
    const getPositionMillis = options.getPositionMillis || (() => 0);
    const getDurationMillis = options.getDurationMillis || (() => 0);
    const setTimeoutFn =
        options.setTimeout || ((fn: () => void, ms: number) => setTimeout(fn, ms) as unknown);
    const clearTimeoutFn =
        options.clearTimeout ||
        ((id: unknown) => clearTimeout(id as ReturnType<typeof setTimeout>));
    const uuid = options.uuid;
    const storage = options.storage ?? null;
    const prefix = options.storagePrefix || '032_playback';
    const heartbeatActiveMillis = options.heartbeatActiveMillis || 15000;
    const heartbeatPausedMillis = options.heartbeatPausedMillis || 60000;
    const retryDelaysMillis = options.retryDelaysMillis || [1000, 3000];
    // 032 currently accepts web|android only; see MUSIC032_CHANGES.md (C list).
    const clientKind = options.clientKind || 'web';
    const onProtocolError = options.onProtocolError || (() => undefined);

    const CLIENT_ID_KEY = `${prefix}_client_id`;
    const SNAPSHOT_KEY = `${prefix}_session_v1`;
    const BLOCK_KEY = `${prefix}_block_v1`;

    let clientId: null | string = null;
    let session: null | Session = null;
    let blocked = false;
    let queue: Job[] = [];
    let pumping: null | Promise<void> = null;
    let heartbeatTimer: unknown = null;

    // ------------------------------------------------------------ storage
    const read = (key: string) => {
        try {
            return storage ? storage.getItem(key) : null;
        } catch {
            return null;
        }
    };
    const write = (key: string, value: string) => {
        try {
            storage?.setItem(key, value);
        } catch {
            /* storage unavailable: reporting still works in memory */
        }
    };
    const remove = (key: string) => {
        try {
            storage?.removeItem(key);
        } catch {
            /* ignore */
        }
    };

    const loadClientId = () => {
        if (clientId) return clientId;
        let id = read(CLIENT_ID_KEY);
        if (typeof id !== 'string' || !CLIENT_ID_PATTERN.test(id)) {
            id = uuid();
            write(CLIENT_ID_KEY, id);
        }
        clientId = id;
        return id;
    };

    const persistSnapshot = (sess: Session) =>
        write(
            SNAPSHOT_KEY,
            JSON.stringify({
                hasPlayed: sess.hasPlayed,
                sessionId: sess.id,
                trackId: sess.trackId,
            }),
        );

    const readSnapshot = (): null | { hasPlayed: boolean; sessionId: string; trackId: number } => {
        try {
            const raw = read(SNAPSHOT_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (
                !parsed ||
                typeof parsed.sessionId !== 'string' ||
                !Number.isInteger(parsed.trackId)
            ) {
                return null;
            }
            // Never invent play evidence for legacy snapshots.
            parsed.hasPlayed = parsed.hasPlayed === true;
            return parsed;
        } catch {
            return null;
        }
    };

    const clearSnapshot = () => remove(SNAPSHOT_KEY);
    const writeBlockMarker = (trackId: number) =>
        write(BLOCK_KEY, JSON.stringify({ blocked: true, trackId }));
    const readBlockMarker = (): null | { trackId: number } => {
        try {
            const raw = read(BLOCK_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || parsed.blocked !== true || !Number.isInteger(parsed.trackId)) {
                return null;
            }
            return parsed;
        } catch {
            return null;
        }
    };
    const clearBlockMarker = () => remove(BLOCK_KEY);

    const clampMillis = (value: unknown) => Math.max(0, Math.floor(Number(value) || 0));
    const probePosition = () => clampMillis(getPositionMillis());
    const probeDuration = () => clampMillis(getDurationMillis());
    const sleep = (millis: number) =>
        new Promise<void>((resolve) => {
            setTimeoutFn(resolve, millis);
        });

    const newSession = (trackId: number, state?: PlaybackState): Session => {
        const initialState = state || 'buffering';
        return {
            endDelivered: false,
            ended: false,
            endGivenUp: false,
            hasPlayed: initialState === 'playing',
            id: uuid(),
            missingRecoveryDone: false,
            seq: 0,
            started: false,
            state: initialState,
            superseded: false,
            trackId,
        };
    };

    // Recovery-start state follows the server's priorState rule: hasPlayed
    // history alone never justifies labelling a recovery start 'playing'.
    const recoveryStartState = (sess: Session, job: Job): PlaybackState => {
        if (job.type === 'end') return job.priorState === 'playing' ? 'playing' : job.priorState!;
        return sess.state;
    };

    // ------------------------------------------------------------ queueing
    const makeJob = (sess: Session, type: EventType, extra: JobExtra = {}): Job => ({
        durationMillis:
            extra.durationMillis !== undefined
                ? clampMillis(extra.durationMillis)
                : probeDuration(),
        endReason: extra.endReason || null,
        positionMillis:
            extra.positionMillis !== undefined
                ? clampMillis(extra.positionMillis)
                : probePosition(),
        // Frozen at enqueue: the state at the moment an end happened.
        priorState: type === 'end' ? sess.state : null,
        recoveryDepth: extra.recoveryDepth || 0,
        refreshPosition: !!extra.refreshPosition,
        resumeFrom: extra.resumeFrom || null,
        session: sess,
        state: extra.state || null,
        type,
    });

    const enqueue = (sess: Session, type: EventType, extra: JobExtra = {}) => {
        const job = makeJob(sess, type, extra);
        // Only the latest pending seek of a session matters.
        if (type === 'seek') {
            queue = queue.filter((other) => !(other.session === sess && other.type === 'seek'));
        }
        queue.push(job);
        void pump();
        return job;
    };

    const isStale = (job: Job) => {
        const sess = job.session;
        if (job.type === 'end') return sess.endDelivered || sess.endGivenUp;
        if (sess.ended || sess.superseded) return true;
        if (job.type === 'heartbeat') {
            return queue.some((other) => other !== job && other.session === sess);
        }
        return false;
    };

    const pump = (): Promise<void> => {
        if (pumping) return pumping;
        pumping = (async () => {
            try {
                while (queue.length > 0) {
                    const job = queue.shift()!;
                    if (isStale(job)) continue;
                    await deliver(job);
                }
            } finally {
                pumping = null;
            }
        })();
        return pumping;
    };

    const buildBody = (job: Job): PlaybackEventBody => {
        const sess = job.session;
        sess.seq += 1;
        const body: PlaybackEventBody = {
            clientId: loadClientId(),
            clientKind,
            durationMillis: job.durationMillis,
            positionMillis: job.refreshPosition ? probePosition() : job.positionMillis,
            seq: sess.seq,
            sessionId: sess.id,
            trackId: sess.trackId,
            type: job.type,
        };
        if (job.type === 'start') {
            body.state = job.state!;
            if (job.resumeFrom) body.resumedFromSessionId = job.resumeFrom;
        } else if (job.type === 'heartbeat') {
            body.state = sess.state;
        } else if (job.type === 'end') {
            body.endReason = job.endReason!;
        }
        return body;
    };

    const deliver = async (job: Job) => {
        const body = buildBody(job);
        let response: TransportResponse = null;
        for (let attempt = 0; ; attempt++) {
            try {
                response = await transport(body, { keepalive: false });
                if (!response || response.status < 500) break;
            } catch {
                /* network error: bounded retry */
            }
            if (attempt >= retryDelaysMillis.length) {
                if (job.type === 'end') job.session.endGivenUp = true;
                return; // the server-side lease expires the session
            }
            await sleep(retryDelaysMillis[attempt]);
            if (isStale(job)) return;
        }
        handleResponse(job, response);
    };

    const errorCode = (response: TransportResponse): null | string =>
        response?.json?.error?.code ?? null;

    const handleResponse = (job: Job, response: TransportResponse) => {
        const sess = job.session;
        const status = response ? response.status : 0;
        const json = response ? response.json : null;

        if (status >= 200 && status < 300) {
            if (job.type === 'start') {
                sess.started = true;
                sess.missingRecoveryDone = false;
            }
            if (job.type === 'end') {
                sess.endDelivered = true;
                sess.ended = true;
                if (sess === session) cancelHeartbeat();
            }
            if (json && json.applied) {
                if (sess === session && !sess.ended) persistSnapshot(sess);
                return;
            }
            // applied:false with a terminal server state: stop faking life.
            if (json && json.state === 'ended') finalizeLocally(sess, 'server_ended');
            return;
        }

        const code = errorCode(response);
        if (status === 404 && code === 'session_not_found') return recoverMissing(job);
        if (status === 409 && code === 'session_expired') return recoverExpired(job);
        if (status === 409 && code === 'resume_invalid') return blockResumeInvalid(job.session);
        if (status === 404 && code === 'not_found') {
            return finalizeLocally(sess, 'track_not_found');
        }
        if (status === 400 || status === 409) return finalizeLocally(sess, code || 'invalid');
        if (job.type === 'end') sess.endGivenUp = true;
    };

    const finalizeLocally = (sess: Session, reason: string) => {
        sess.ended = true;
        sess.endDelivered = true;
        if (sess === session) {
            session = null;
            cancelHeartbeat();
            clearSnapshot();
            blocked = true;
        }
        if (reason) onProtocolError({ reason, sessionId: sess.id, trackId: sess.trackId });
    };

    // resume_invalid must never degrade into a silent high-position new start.
    const blockResumeInvalid = (sess: Session) => {
        blocked = true;
        writeBlockMarker(sess.trackId);
        finalizeLocally(sess, 'resume_invalid');
    };

    const pastCountThreshold = (positionMillis: number, durationMillis: number) =>
        durationMillis > 0 && positionMillis >= durationMillis / 2;

    const recoverMissing = (job: Job) => {
        const sess = job.session;
        if (job.type === 'end') {
            sess.endDelivered = true;
            if (
                job.recoveryDepth < 1 &&
                job.priorState === 'playing' &&
                pastCountThreshold(job.positionMillis, job.durationMillis)
            ) {
                const recovery = newSession(sess.trackId, 'playing');
                const startJob = makeJob(recovery, 'start', {
                    durationMillis: job.durationMillis,
                    positionMillis: job.positionMillis,
                    recoveryDepth: job.recoveryDepth + 1,
                    state: 'playing',
                });
                const endJob = makeJob(recovery, 'end', {
                    durationMillis: job.durationMillis,
                    endReason: job.endReason!,
                    positionMillis: job.positionMillis,
                    recoveryDepth: job.recoveryDepth + 1,
                });
                queue.unshift(endJob);
                queue.unshift(startJob);
            }
            return;
        }
        if (sess.missingRecoveryDone) return;
        if (job.recoveryDepth >= 2) return finalizeLocally(sess, 'missing_recovery_failed');
        sess.missingRecoveryDone = true;
        queue.unshift(makeJob(sess, 'start', { state: sess.state }));
    };

    const recoverExpired = (job: Job) => {
        const sess = job.session;
        if (job.recoveryDepth >= 1) return finalizeLocally(sess, 'expired_recovery_failed');
        const isEnd = job.type === 'end';
        // A late 409 for an already replaced/ended session never revives it.
        if (!isEnd && (sess.superseded || sess.ended)) return;
        if (isEnd) sess.endDelivered = true;
        const recovery = newSession(sess.trackId, sess.state);
        recovery.hasPlayed = sess.hasPlayed;
        const depth = job.recoveryDepth + 1;
        const startJob = makeJob(recovery, 'start', {
            durationMillis: job.durationMillis > 0 ? job.durationMillis : undefined,
            positionMillis: isEnd ? job.positionMillis : undefined,
            recoveryDepth: depth,
            resumeFrom: sess.id,
            state: recoveryStartState(sess, job),
        });
        job.session = recovery;
        job.recoveryDepth = depth;
        sess.superseded = true;
        for (const pending of queue) {
            if (pending.session === sess) {
                pending.session = recovery;
                pending.recoveryDepth = depth;
            }
        }
        queue.unshift(job);
        queue.unshift(startJob);
        if (!isEnd && sess === session) {
            session = recovery;
            persistSnapshot(recovery);
            scheduleHeartbeat();
        }
    };

    // ----------------------------------------------------------- heartbeat
    const scheduleHeartbeat = () => {
        cancelHeartbeat();
        const sess = session;
        if (!sess || sess.ended || blocked) return;
        const interval = sess.state === 'paused' ? heartbeatPausedMillis : heartbeatActiveMillis;
        heartbeatTimer = setTimeoutFn(() => {
            heartbeatTimer = null;
            const cur = session;
            if (!cur || cur.ended || blocked) return;
            if (!queue.some((job) => job.session === cur && job.type === 'heartbeat')) {
                enqueue(cur, 'heartbeat', { refreshPosition: true });
            }
            scheduleHeartbeat();
        }, interval);
    };

    const cancelHeartbeat = () => {
        if (heartbeatTimer !== null) {
            clearTimeoutFn(heartbeatTimer);
            heartbeatTimer = null;
        }
    };

    // ------------------------------------------------------ session cycles
    const endSession = (sess: null | Session, reason: EndReason, at: EventPosition = {}) => {
        if (!sess || sess.ended) return;
        sess.ended = true;
        if (sess === session) cancelHeartbeat();
        enqueue(sess, 'end', { ...at, endReason: reason });
        // completed/skipped/replaced are finished business: never resume them.
        if (
            sess === session &&
            (reason === 'completed' || reason === 'skipped' || reason === 'replaced')
        ) {
            clearSnapshot();
        }
    };

    const transition = (type: EventType, newState: PlaybackState, positionMillis?: number) => {
        const sess = session;
        if (!sess || sess.ended || blocked) return;
        if (sess.state === newState) return;
        sess.state = newState;
        if (newState === 'playing') sess.hasPlayed = true;
        enqueue(sess, type, { positionMillis });
        scheduleHeartbeat();
    };

    return {
        currentTrackId() {
            return session && !session.ended ? session.trackId : null;
        },
        dispose() {
            cancelHeartbeat();
            queue = [];
            session = null;
        },
        end(reason: EndReason, at?: EventPosition) {
            endSession(session, reason, at);
        },
        getDebug() {
            return {
                blocked,
                clientId,
                ended: session ? session.ended : null,
                hasPlayed: session ? session.hasPlayed : null,
                queueLength: queue.length,
                seq: session ? session.seq : 0,
                sessionId: session ? session.id : null,
                state: session ? session.state : null,
            };
        },
        hasActiveSession() {
            return !!(session && !session.ended);
        },
        /** Resolves once every queued event has been delivered (tests, shutdown). */
        async idle() {
            while (pumping || queue.length > 0) await pump();
        },
        isBlocked() {
            return blocked;
        },
        notifyBuffering(positionMillis?: number) {
            const sess = session;
            if (!sess || sess.ended || blocked || sess.state !== 'playing') return;
            transition('buffering', 'buffering', positionMillis);
        },
        notifyPaused(positionMillis?: number) {
            transition('pause', 'paused', positionMillis);
        },
        notifyPlaying(positionMillis?: number) {
            transition('resume', 'playing', positionMillis);
        },
        notifySeek(positionMillis?: number) {
            const sess = session;
            if (!sess || sess.ended || blocked) return;
            enqueue(sess, 'seek', { positionMillis });
        },
        /**
         * Explicit new play: ends the previous session (given reason, its own
         * position) before starting a fresh session for trackId.
         */
        play(trackId: number, opts: PlayOptions = {}) {
            blocked = false;
            clearBlockMarker();
            const previous = session;
            if (previous && !previous.ended) {
                previous.superseded = true;
                endSession(previous, opts.reason || 'replaced');
            }
            session = newSession(trackId, opts.initialState || 'buffering');
            enqueue(session, 'start', {
                durationMillis: opts.durationMillis,
                positionMillis: opts.positionMillis,
                state: session.state,
            });
            scheduleHeartbeat();
        },
        /**
         * Same-track recovery (app restart, retry after an error): resumes the
         * persisted chain when the snapshot names this track, else a new play.
         */
        restore(trackId: number, opts: PlayOptions = {}) {
            if (session && !session.ended) return;
            const marker = readBlockMarker();
            if (marker) {
                if (marker.trackId === trackId) {
                    blocked = true;
                    return;
                }
                clearBlockMarker();
                blocked = false;
            }
            if (blocked) return;
            const snapshot = readSnapshot();
            const resumeFrom = snapshot && snapshot.trackId === trackId ? snapshot.sessionId : null;
            session = newSession(trackId, opts.initialState || 'paused');
            if (resumeFrom && snapshot!.hasPlayed) session.hasPlayed = true;
            enqueue(session, 'start', {
                durationMillis: opts.durationMillis,
                positionMillis: opts.positionMillis,
                resumeFrom,
                state: session.state,
            });
            scheduleHeartbeat();
        },
        /**
         * App/window close: best-effort end(client_closed) with keepalive that
         * bypasses the serial queue. The snapshot is kept so the next launch
         * resumes the chain without counting the play twice.
         */
        suspend(at: EventPosition = {}) {
            const sess = session;
            if (!sess || sess.ended) return;
            sess.ended = true;
            cancelHeartbeat();
            const body: PlaybackEventBody = {
                clientId: loadClientId(),
                clientKind,
                durationMillis:
                    at.durationMillis !== undefined
                        ? clampMillis(at.durationMillis)
                        : probeDuration(),
                endReason: 'client_closed',
                positionMillis:
                    at.positionMillis !== undefined
                        ? clampMillis(at.positionMillis)
                        : probePosition(),
                seq: sess.seq + 1,
                sessionId: sess.id,
                trackId: sess.trackId,
                type: 'end',
            };
            if (sess.started) persistSnapshot(sess);
            try {
                transport(body, { keepalive: true }).catch(() => undefined);
            } catch {
                /* best effort */
            }
        },
    };
};

export type PlaybackSession = ReturnType<typeof createPlaybackSession>;
