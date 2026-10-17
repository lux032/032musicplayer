import { useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

import { m032ApiClient } from '/@/renderer/api/music032/music032-api';
import { queryKeys } from '/@/renderer/api/query-keys';
import {
    getPlayingSourceVersion,
    seriesContainsTrack,
    subscribePlayingSource,
    workContainsTrack,
} from '/@/renderer/features/home/music032/lib/playing-source-map';
import { SongPlayState } from '/@/renderer/features/shared/components/playing-indicator/song-play-state';
import { useMusic032Capabilities } from '/@/renderer/features/shared/hooks/use-music032-capabilities';
import { useCurrentServerWithCredential, usePlayerSong, usePlayerStatus } from '/@/renderer/store';
import { M032TrackWork } from '/@/shared/api/music032/music032-types';
import { PlayerStatus } from '/@/shared/types/types';

const STALE_TIME = 1000 * 60 * 5;

/**
 * Works of the current track from the server (features.trackWorks, C11), so
 * cards light up however playback started. One shared query per track; on
 * servers without the endpoint this stays empty and the session map is used.
 */
const useCurrentTrackWorks = (serverId: string | undefined): M032TrackWork[] | undefined => {
    const current = usePlayerSong();
    const server = useCurrentServerWithCredential();
    const capabilities = useMusic032Capabilities();
    const trackId = current?.id || '';
    const enabled =
        !!server &&
        !!trackId &&
        server.id === serverId &&
        current?._serverId === serverId &&
        Boolean(capabilities.data?.features?.trackWorks);

    const query = useQuery({
        enabled,
        queryFn: ({ signal }) =>
            m032ApiClient({ server, signal }).get<{ items: M032TrackWork[] }>(
                `/tracks/${trackId}/works`,
            ),
        queryKey: queryKeys.works.ofTrack(serverId || '', trackId),
        staleTime: STALE_TIME,
    });
    return enabled ? query.data?.items : undefined;
};

const useSourcePlayState = (
    serverId: string | undefined,
    contains: (trackId: number, works: M032TrackWork[]) => boolean,
): SongPlayState => {
    useSyncExternalStore(subscribePlayingSource, getPlayingSourceVersion);
    const current = usePlayerSong();
    const isPlaying = usePlayerStatus() === PlayerStatus.PLAYING;
    const works = useCurrentTrackWorks(serverId);
    if (!current || current._serverId !== serverId) return null;
    const trackId = Number(current.id);
    if (!Number.isFinite(trackId)) return null;
    return contains(trackId, works ?? []) ? (isPlaying ? 'playing' : 'paused') : null;
};

/**
 * Play state of work cards: 'playing' | 'paused' when the current track
 * belongs to one of `workIds` (server track works, or the session map filled
 * when a work is expanded for playback), else null.
 */
export const useWorksPlayState = (serverId: string | undefined, workIds: number[]): SongPlayState =>
    useSourcePlayState(serverId, (trackId, works) =>
        workIds.some(
            (workId) =>
                works.some((work) => work.id === workId) || workContainsTrack(workId, trackId),
        ),
    );

/** Play state of a series (header badge): current track belongs to the series. */
export const useSeriesPlayState = (serverId: string | undefined, seriesId: number): SongPlayState =>
    useSourcePlayState(
        serverId,
        (trackId, works) =>
            works.some((work) => work.seriesId === seriesId) ||
            seriesContainsTrack(seriesId, trackId),
    );
