import { m032Context } from '/@/renderer/api/music032/music032-api';
import { fetchMusic032WorkTracks } from '/@/renderer/features/home/music032/api/music032-home-api';
import {
    recordSeriesTracks,
    recordWorkTracks,
} from '/@/renderer/features/home/music032/lib/playing-source-map';
import { fetchMusic032SeriesTracks } from '/@/renderer/features/series/api/series-api';
import { m032Normalize } from '/@/shared/api/music032/music032-normalize';
import { ServerListItemWithCredential, Song } from '/@/shared/types/domain-types';

/**
 * 把若干部作品的关联曲目展开成去重后的 Song 列表（按 track id 去重，
 * 与网页端 home.js 的 playWorks 语义一致）。系列 = 其成员作品逐个展开。
 */
export const expandMusic032WorksToSongs = async (
    server: ServerListItemWithCredential,
    workIds: number[],
): Promise<Song[]> => {
    const ctx = m032Context(server);
    const songs: Song[] = [];
    const seen = new Set<number>();

    for (const workId of workIds) {
        const res = await fetchMusic032WorkTracks(server, workId);
        // Remember the membership so work/series cards can show a playing badge.
        recordWorkTracks(
            workId,
            res.items.map((track) => track.id),
        );
        for (const track of res.items) {
            if (seen.has(track.id)) continue;
            seen.add(track.id);
            songs.push(m032Normalize.song(ctx, track));
        }
    }

    return songs;
};

/** 系列全部曲目展开成 Song 列表（/series/{id}/tracks 已按成员顺序去重）。 */
export const expandMusic032SeriesToSongs = async (
    server: ServerListItemWithCredential,
    seriesId: number,
): Promise<Song[]> => {
    const ctx = m032Context(server);
    const res = await fetchMusic032SeriesTracks(server, seriesId);
    // 系列级播放徽标：/series/{id}/tracks 不带成员归属，只记到系列本身。
    recordSeriesTracks(
        seriesId,
        res.items.map((track) => track.id),
    );
    return res.items.map((track) => m032Normalize.song(ctx, track));
};
