import { useSyncExternalStore } from 'react';

import {
    getPlayingSourceVersion,
    seriesContainsTrack,
    subscribePlayingSource,
    workContainsTrack,
} from '/@/renderer/features/home/music032/lib/playing-source-map';
import { SongPlayState } from '/@/renderer/features/shared/components/playing-indicator/song-play-state';
import { usePlayerSong, usePlayerStatus } from '/@/renderer/store';
import { PlayerStatus } from '/@/shared/types/types';

const useSourcePlayState = (
    serverId: string | undefined,
    contains: (trackId: number) => boolean,
): SongPlayState => {
    useSyncExternalStore(subscribePlayingSource, getPlayingSourceVersion);
    const current = usePlayerSong();
    const isPlaying = usePlayerStatus() === PlayerStatus.PLAYING;
    if (!current || current._serverId !== serverId) return null;
    const trackId = Number(current.id);
    if (!Number.isFinite(trackId)) return null;
    return contains(trackId) ? (isPlaying ? 'playing' : 'paused') : null;
};

/**
 * Play state of work cards: 'playing' | 'paused' when the current track is
 * known to belong to one of `workIds`, else null.
 */
export const useWorksPlayState = (serverId: string | undefined, workIds: number[]): SongPlayState =>
    useSourcePlayState(serverId, (trackId) =>
        workIds.some((workId) => workContainsTrack(workId, trackId)),
    );

/** Play state of a series (header badge): current track belongs to the series. */
export const useSeriesPlayState = (serverId: string | undefined, seriesId: number): SongPlayState =>
    useSourcePlayState(serverId, (trackId) => seriesContainsTrack(seriesId, trackId));
