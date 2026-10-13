import formatDuration from 'format-duration';
import { TFunction } from 'i18next';

import { M032Track } from '/@/shared/api/music032/music032-types';

/** m:ss（或 h:mm:ss）时长标签。 */
export const formatTrackDuration = (durationMillis: number | undefined) =>
    formatDuration(durationMillis || 0);

/** 从预览曲目汇总音频规格标签，如 "FLAC / 24bit / 96kHz"（取第一张有效曲目）。 */
export const audioSpecLabel = (tracks: M032Track[]): null | string => {
    const track = tracks.find((t) => t.codec || t.container);
    if (!track) return null;
    const parts = [
        String(track.codec || track.container || '')
            .trim()
            .toUpperCase(),
    ];
    if (track.bitDepth && track.bitDepth > 0) parts.push(`${track.bitDepth}bit`);
    if (track.sampleRate && track.sampleRate > 0) parts.push(`${track.sampleRate / 1000}kHz`);
    return parts.filter(Boolean).join(' / ');
};

/** 曲目用途（op / ed / insert …）的短标签。 */
export const workRoleLabel = (t: TFunction, role: string): string => {
    switch (role) {
        case 'character':
            return t('page.home.music032.roleCharacter');
        case 'ed':
            return t('page.home.music032.roleEd');
        case 'image_song':
            return t('page.home.music032.roleImageSong');
        case 'insert':
            return t('page.home.music032.roleInsert');
        case 'op':
            return t('page.home.music032.roleOp');
        case 'theme':
            return t('page.home.music032.roleTheme');
        default:
            return role.toUpperCase();
    }
};

/** 用途标签是否用强调色（op / ed / theme，与网页一致）。 */
export const isPrimaryRole = (role: string) => role === 'op' || role === 'ed' || role === 'theme';

/** 作品类型标签（anime / game / movie …）。 */
export const workTypeLabel = (t: TFunction, workType: string): string => {
    switch (workType) {
        case 'anime':
            return t('page.home.music032.filterAnime');
        case 'game':
            return t('page.home.music032.filterGame');
        case 'movie':
            return t('page.home.music032.filterMovie');
        default:
            return t('page.home.music032.workTypeOther');
    }
};

/** 全量作品类型标签（作品/系列页用，含 drama / commercial）。 */
export const workTypeLongLabel = (t: TFunction, workType: string): string => {
    switch (workType) {
        case 'commercial':
            return t('page.works.typeCommercial');
        case 'drama':
            return t('page.works.typeDrama');
        default:
            return workTypeLabel(t, workType);
    }
};

/** 作品海报的本地媒体路径。新版详情带 posterApiUrl；旧服务端列表/详情给的是
 *  Bangumi 远程地址，这里一律回退到本地海报路由（未缓存时由图片组件显示占位）。 */
export const workPosterPath = (workId: number, posterUrl: null | string | undefined): string => {
    if (posterUrl && posterUrl.startsWith('/')) return posterUrl;
    return `/api/v1/works/${workId}/poster`;
};

/** 用途标签带序号（OP1 / ED2；sequence 为 0 时不显示数字，与网页一致）。 */
export const workRoleSequenceLabel = (t: TFunction, role: string, sequence: number): string =>
    `${workRoleLabel(t, role)}${sequence > 0 ? sequence : ''}`;

/** 专辑级关系标签（ost → 原声集，其他 → 相关）。 */
export const workAlbumRoleLabel = (t: TFunction, role: string): string =>
    role === 'ost' ? t('page.works.albumRoleOst') : t('page.works.albumRoleOther');

/** 关联来源标签（auto / manual / bangumi / album）。 */
export const workSourceLabel = (t: TFunction, source: string): string => {
    switch (source) {
        case 'album':
            return t('page.works.sourceAlbum');
        case 'bangumi':
            return t('page.works.sourceBangumi');
        case 'manual':
            return t('page.works.sourceManual');
        default:
            return t('page.works.sourceAuto');
    }
};
