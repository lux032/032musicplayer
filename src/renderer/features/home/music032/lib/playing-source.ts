import { useSyncExternalStore } from 'react';

import {
    getPlayingSourceVersion,
    subscribePlayingSource,
    workContainsTrack,
} from '/@/renderer/features/home/music032/lib/playing-source-map';
import { SongPlayState } from '/@/renderer/features/shared/components/playing-indicator/song-play-state';
import { usePlayerSong, usePlayerStatus } from '/@/renderer/store';
import { PlayerStatus } from '/@/shared/types/types';

/**
 * Play state of work cards: 'playing' | 'paused' when the current track is
 * known to belong to one of `workIds`, else null.
 */
export const useWorksPlayState = (
    serverId: string | undefined,
    workIds: number[],
): SongPlayState => {
    useSyncExternalStore(subscribePlayingSource, getPlayingSourceVersion);
    const current = usePlayerSong();
    const isPlaying = usePlayerStatus() === PlayerStatus.PLAYING;
    if (!current || current._serverId !== serverId) return null;
    const trackId = Number(current.id);
    if (!Number.isFinite(trackId)) return null;
    const hit = workIds.some((workId) => workContainsTrack(workId, trackId));
    return hit ? (isPlaying ? 'playing' : 'paused') : null;
};
