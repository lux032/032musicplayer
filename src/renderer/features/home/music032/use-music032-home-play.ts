import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { expandMusic032WorksToSongs } from '/@/renderer/features/home/music032/lib/play-music032';
import { usePlayer } from '/@/renderer/features/player/context/player-context';
import { useCurrentServerWithCredential } from '/@/renderer/store';
import { toast } from '/@/shared/components/toast/toast';
import { LibraryItem, Song } from '/@/shared/types/domain-types';
import { Play } from '/@/shared/types/types';

/** 032 主页的播放动作：专辑/歌单走 addToQueueByFetch，作品/系列先展开成曲目。 */
export const useMusic032HomePlay = () => {
    const { t } = useTranslation();
    const player = usePlayer();
    const server = useCurrentServerWithCredential();

    const playAlbum = useCallback(
        (albumId: string) => {
            if (!server) return;
            player.addToQueueByFetch(server.id, [albumId], LibraryItem.ALBUM, Play.NOW);
        },
        [player, server],
    );

    const appendAlbum = useCallback(
        (albumId: string) => {
            if (!server) return;
            player.addToQueueByFetch(server.id, [albumId], LibraryItem.ALBUM, Play.LAST);
        },
        [player, server],
    );

    const playPlaylist = useCallback(
        (playlistId: string) => {
            if (!server) return;
            player.addToQueueByFetch(server.id, [playlistId], LibraryItem.PLAYLIST, Play.NOW);
        },
        [player, server],
    );

    const playSongs = useCallback(
        (songs: Song[], startSongId?: string) => {
            if (!songs.length) return;
            player.addToQueueByData(songs, Play.NOW, startSongId);
        },
        [player],
    );

    const playWorks = useCallback(
        async (workIds: number[]) => {
            if (!server || !workIds.length) return;
            try {
                const songs = await expandMusic032WorksToSongs(server, workIds);
                if (!songs.length) {
                    toast.warn({ message: t('page.home.music032.noPlayableTracks') });
                    return;
                }
                player.addToQueueByData(songs, Play.NOW);
            } catch {
                toast.error({ message: t('page.home.music032.loadFailed') });
            }
        },
        [player, server, t],
    );

    const appendWorks = useCallback(
        async (workIds: number[]) => {
            if (!server || !workIds.length) return;
            try {
                const songs = await expandMusic032WorksToSongs(server, workIds);
                if (!songs.length) {
                    toast.warn({ message: t('page.home.music032.noPlayableTracks') });
                    return;
                }
                player.addToQueueByData(songs, Play.LAST);
            } catch {
                toast.error({ message: t('page.home.music032.loadFailed') });
            }
        },
        [player, server, t],
    );

    return { appendAlbum, appendWorks, playAlbum, playPlaylist, playSongs, playWorks };
};
