import { m032ApiClient, Music032ApiError } from '/@/renderer/api/music032/music032-api';
import { queryKeys } from '/@/renderer/api/query-keys';
import { queryClient } from '/@/renderer/lib/react-query';
import { logger } from '/@/renderer/utils/logger';
import { M032LyricsTranslation } from '/@/shared/api/music032/music032-types';
import { ServerListItemWithCredential } from '/@/shared/types/domain-types';

/**
 * Translate a track's lyrics on the 032 server. The server translates the
 * lyrics it returns from GET /tracks/{id}/lyrics (NetEase's own translation
 * when available, otherwise the AI model) and caches the result.
 * Returns the translation joined by '\n', one entry per lyrics line.
 */
export const translateLyrics = async (
    server: ServerListItemWithCredential,
    songId: string,
    targetLanguage: string,
): Promise<string> => {
    try {
        const res = await m032ApiClient({ server }).post<M032LyricsTranslation>(
            `/tracks/${songId}/lyrics/translation`,
            { targetLanguage },
        );
        return res.lines.join('\n');
    } catch (error) {
        if (error instanceof Music032ApiError && error.code === 'translation_disabled') {
            // Translation was switched off on the server: refresh the capability so the UI hides it.
            queryClient.invalidateQueries({ queryKey: queryKeys.music032.capabilities(server.id) });
        }
        logger.error('Lyrics translation request failed', { error, songId, targetLanguage });
        throw error;
    }
};
