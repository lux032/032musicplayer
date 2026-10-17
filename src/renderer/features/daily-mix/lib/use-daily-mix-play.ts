import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { m032Context } from '/@/renderer/api/music032/music032-api';
import { dailyMixQueries } from '/@/renderer/features/daily-mix/api/daily-mix-api';
import { usePlayer } from '/@/renderer/features/player/context/player-context';
import { capabilitiesQuery } from '/@/renderer/features/shared/hooks/use-music032-capabilities';
import { queryClient } from '/@/renderer/lib/react-query';
import { useCurrentServerWithCredential } from '/@/renderer/store';
import { m032Normalize } from '/@/shared/api/music032/music032-normalize';
import { M032DailyMixDetail } from '/@/shared/api/music032/music032-types';
import { toast } from '/@/shared/components/toast/toast';
import { ServerListItemWithCredential, Song } from '/@/shared/types/domain-types';
import { Play } from '/@/shared/types/types';

/** The server accepts a playback context on session starts (features.playbackContext). */
const playbackContextSupported = async (server: ServerListItemWithCredential) => {
    try {
        const caps = await queryClient.fetchQuery(capabilitiesQuery(server));
        return Boolean(caps.features?.playbackContext);
    } catch {
        return false;
    }
};

/**
 * Playable songs of a mix in mix order. With `withContext`, every song carries
 * its daily mix attribution (mix id + 0-based position) so the playback
 * reporter can tell the server where the play came from.
 */
export const dailyMixSongs = (
    server: ServerListItemWithCredential,
    detail: M032DailyMixDetail,
    withContext: boolean,
): Song[] => {
    const ctx = m032Context(server);
    return detail.tracks
        .filter((item) => item.track && !item.track.missing)
        .map((item) => {
            const song = m032Normalize.song(ctx, item.track);
            return withContext && detail.mix.id > 0
                ? { ...song, _dailyMixContext: { id: detail.mix.id, position: item.position } }
                : song;
        });
};

/** Play actions for daily mixes, mirroring the 032 web UI (queue.js playDailyMix). */
export const useDailyMixPlay = () => {
    const { t } = useTranslation();
    const player = usePlayer();
    const server = useCurrentServerWithCredential();

    /** Replaces the queue with the mix (in order, shuffled, or starting at one song). */
    const playDetail = useCallback(
        async (detail: M032DailyMixDetail, type: Play = Play.NOW, startSongId?: string) => {
            if (!server) return;
            const songs = dailyMixSongs(server, detail, await playbackContextSupported(server));
            if (!songs.length) {
                toast.warn({ message: t('page.dailyMix.noPlayableTracks') });
                return;
            }
            player.addToQueueByData(songs, type, startSongId);
        },
        [player, server, t],
    );

    /** 加入播放队列: appended songs belong to the user's queue, not the mix (no context). */
    const appendDetail = useCallback(
        (detail: M032DailyMixDetail) => {
            if (!server) return;
            const songs = dailyMixSongs(server, detail, false);
            if (!songs.length) {
                toast.warn({ message: t('page.dailyMix.noPlayableTracks') });
                return;
            }
            player.addToQueueByData(songs, Play.LAST);
        },
        [player, server, t],
    );

    /** Plays a mix by id (home rows): fetches its tracks first. */
    const playMix = useCallback(
        async (mixId: number, type: Play = Play.NOW) => {
            if (!server) return;
            try {
                const detail = await queryClient.fetchQuery(dailyMixQueries.detail(server, mixId));
                await playDetail(detail, type);
            } catch {
                toast.error({ message: t('page.dailyMix.loadFailed') });
            }
        },
        [playDetail, server, t],
    );

    return { appendDetail, playDetail, playMix };
};
