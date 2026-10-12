import {
    getSongPlayState,
    SongPlayState,
} from '/@/renderer/features/shared/components/playing-indicator/song-play-state';
import { usePlayerSong, usePlayerStatus } from '/@/renderer/store';
import { PlayerStatus } from '/@/shared/types/types';

/** Play state of one track row: 'playing' | 'paused' | null (not current). */
export const useSongPlayState = (
    serverId: string | undefined,
    songId: string | undefined,
): SongPlayState => {
    const current = usePlayerSong();
    const isPlaying = usePlayerStatus() === PlayerStatus.PLAYING;
    return getSongPlayState(current, isPlaying, serverId || '', songId || '');
};

/** Play state of an album card: the current track's albumId matches. */
export const useAlbumPlayState = (
    serverId: string | undefined,
    albumId: null | string | undefined,
): SongPlayState => {
    const current = usePlayerSong();
    const isPlaying = usePlayerStatus() === PlayerStatus.PLAYING;
    return getSongPlayState(
        current ? { _serverId: current._serverId, id: current.albumId || undefined } : null,
        isPlaying,
        serverId || '',
        albumId || '',
    );
};
