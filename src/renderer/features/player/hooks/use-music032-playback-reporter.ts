import isElectron from 'is-electron';
import { useEffect } from 'react';

import {
    AdapterStatus,
    AdapterTrack,
    createMusic032PlaybackAdapter,
    Music032PlaybackAdapter,
} from '/@/renderer/api/music032/music032-playback-adapter';
import {
    createPlaybackSession,
    PlaybackEventBody,
    TransportResponse,
} from '/@/renderer/api/music032/music032-playback-session';
import { eventEmitter } from '/@/renderer/events/event-emitter';
import { usePlayerEvents } from '/@/renderer/features/player/audio-player/hooks/use-player-events';
import { getServerById, usePlayerStore, useTimestampStoreBase } from '/@/renderer/store';
import { logger } from '/@/renderer/utils/logger';
import { getServerUrl } from '/@/renderer/utils/normalize-server-url';
import { QueueSong, ServerType } from '/@/shared/types/domain-types';
import { PlayerStatus } from '/@/shared/types/types';

// Reports playback to 032 Music Server through its session protocol
// (POST /api/v1/playback/events). The generic scrobble pipeline is a no-op
// for 032; see music032-playback-adapter.ts for the event mapping.

const mpvPlayerListener = isElectron() ? window.api.mpvPlayerListener : null;
const ipc = isElectron() ? window.api.ipc : null;

const EVENTS_PATH = '/api/v1/playback/events';

const eventsUrl = (serverId: string) => {
    const server = getServerById(serverId);
    const base = (getServerUrl(server) || '').replace(/\/$/, '');
    return { base, server };
};

const createTransport =
    (serverId: string) =>
    async (body: PlaybackEventBody, { keepalive }: { keepalive: boolean }) => {
        const { base, server } = eventsUrl(serverId);
        if (!base || !server) return null;

        if (keepalive) {
            // Page is unloading: sendBeacon cannot set headers, but the events
            // endpoint also accepts the media token as a query parameter.
            const url = `${base}${EVENTS_PATH}?mediaToken=${encodeURIComponent(server.mediaToken || '')}`;
            navigator.sendBeacon(url, JSON.stringify(body));
            return null;
        }

        const res = await fetch(`${base}${EVENTS_PATH}`, {
            body: JSON.stringify(body),
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${server.credential}`,
                'Content-Type': 'application/json',
            },
            method: 'POST',
        });
        let json: unknown = null;
        try {
            json = await res.json();
        } catch {
            json = null;
        }
        return { json, status: res.status } satisfies TransportResponse;
    };

const reporters = new Map<string, Music032PlaybackAdapter>();

const getReporter = (serverId: string) => {
    let adapter = reporters.get(serverId);
    if (adapter) return adapter;

    const session = createPlaybackSession({
        getDurationMillis: () => adapter!.getDurationMillis(),
        getPositionMillis: () => adapter!.getPositionMillis(),
        onProtocolError: (info) => logger.warn('032 playback session stopped reporting', info),
        storage: window.localStorage,
        storagePrefix: `music032_playback_${serverId}`,
        transport: createTransport(serverId),
        uuid: () => crypto.randomUUID(),
    });
    adapter = createMusic032PlaybackAdapter({ now: () => Date.now(), session });
    reporters.set(serverId, adapter);
    return adapter;
};

const toTrack = (song: QueueSong | undefined): AdapterTrack | null => {
    if (!song || song._serverType !== ServerType.MUSIC032) return null;
    const trackId = Number(song.id);
    if (!Number.isInteger(trackId) || trackId <= 0) return null;
    return { durationMillis: song.duration || 0, trackId, uniqueId: song._uniqueId };
};

const toStatus = (status: PlayerStatus): AdapterStatus =>
    status === PlayerStatus.PLAYING
        ? 'playing'
        : status === PlayerStatus.PAUSED
          ? 'paused'
          : 'stopped';

/** The reporter that owns the current queue item (null when it is not a 032 song). */
let active: Music032PlaybackAdapter | null = null;
let flushScheduled = false;

const scheduleFlush = () => {
    if (flushScheduled) return;
    flushScheduled = true;
    // One player store action emits several signals synchronously; interpret
    // them together once it is done.
    queueMicrotask(() => {
        flushScheduled = false;
        active?.flush();
    });
};

const withActive = (fn: (adapter: Music032PlaybackAdapter) => void) => {
    if (!active) return;
    fn(active);
    scheduleFlush();
};

const setCurrentSong = (song: QueueSong | undefined) => {
    const next = song?._serverType === ServerType.MUSIC032 ? getReporter(song._serverId) : null;
    if (active && active !== next) {
        // Leaving a 032 server's queue item: close its session first.
        active.onTrackChange(null);
        active.flush();
    }
    active = next;
    active?.onTrackChange(toTrack(song));
    scheduleFlush();
};

export const useMusic032PlaybackReporter = () => {
    useEffect(() => {
        // Initial state after launch: the persisted queue is a restore, so the
        // first play of the same track resumes the chain persisted on close.
        const state = usePlayerStore.getState();
        const song = state.getCurrentSong();
        if (song?._serverType === ServerType.MUSIC032) {
            const adapter = getReporter(song._serverId);
            adapter.onQueueRestored();
            active = adapter;
            adapter.onTrackChange(toTrack(song));
            adapter.flush();
            adapter.onProgress(useTimestampStoreBase.getState().timestamp);
            adapter.flush();
            adapter.onStatus(toStatus(state.player.status));
            adapter.flush();
        }

        const onError = () => active?.onError();
        const onBuffering = ({ buffering }: { buffering: boolean }) =>
            active?.onBuffering(buffering);
        const onPageHide = () => active?.onClose();

        eventEmitter.on('PLAYER_ERROR', onError);
        eventEmitter.on('PLAYER_BUFFERING', onBuffering);
        mpvPlayerListener?.rendererLoadError?.((reason) => {
            logger.warn('mpv failed to load track', { reason });
            onError();
        });
        mpvPlayerListener?.rendererBuffering?.((buffering) => onBuffering({ buffering }));
        window.addEventListener('pagehide', onPageHide);

        return () => {
            eventEmitter.off('PLAYER_ERROR', onError);
            eventEmitter.off('PLAYER_BUFFERING', onBuffering);
            ipc?.removeAllListeners('renderer-player-load-error');
            ipc?.removeAllListeners('renderer-player-buffering');
            window.removeEventListener('pagehide', onPageHide);
        };
    }, []);

    usePlayerEvents(
        {
            onCurrentSongChange: ({ song }) => setCurrentSong(song),
            onMediaNext: () => withActive((a) => a.onUserNavigate()),
            onMediaPrev: () => withActive((a) => a.onUserNavigate()),
            onPlayerPlay: () => withActive((a) => a.onUserNavigate()),
            onPlayerProgress: ({ timestamp }) => withActive((a) => a.onProgress(timestamp)),
            onPlayerRepeated: () => withActive((a) => a.onRepeated()),
            onPlayerSeekToTimestamp: ({ timestamp }) => withActive((a) => a.onSeek(timestamp)),
            onPlayerStatus: ({ status }) => withActive((a) => a.onStatus(toStatus(status))),
        },
        [],
    );
};

export const Music032PlaybackReporterHook = () => {
    useMusic032PlaybackReporter();
    return null;
};
