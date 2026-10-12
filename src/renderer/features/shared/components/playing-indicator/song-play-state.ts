export type SongPlayState = 'paused' | 'playing' | null;

/**
 * Whether `id` on `serverId` is the player's current track (or contains it,
 * when `id` is the current track's albumId). Matches by id + server id,
 * never by title. Pure: unit-tested from scripts/music032 without React.
 */
export const getSongPlayState = (
    current: null | undefined | { _serverId?: string; id?: string },
    isPlaying: boolean,
    serverId: string,
    id: string,
): SongPlayState => {
    if (!current || !id || !serverId) return null;
    if (current.id !== id || current._serverId !== serverId) return null;
    return isPlaying ? 'playing' : 'paused';
};
