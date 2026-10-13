import { Song } from '/@/shared/types/domain-types';

type AudioQualitySource = Pick<Song, 'bitDepth' | 'bitRate' | 'codec' | 'container' | 'sampleRate'>;

const formatSampleRate = (hz: number) => `${Number((hz / 1000).toFixed(1))}kHz`;

/**
 * "FLAC / 24bit / 48kHz" for lossless, "MP3 / 320kbps / 44.1kHz" for lossy.
 * Missing parts are skipped; returns null when nothing is known.
 */
export const formatAudioQuality = (song?: AudioQualitySource | null): null | string => {
    if (!song) return null;

    const codec = (song.codec || song.container)?.toUpperCase();
    const parts = [
        codec,
        song.bitDepth ? `${song.bitDepth}bit` : song.bitRate ? `${song.bitRate}kbps` : null,
        song.sampleRate ? formatSampleRate(song.sampleRate) : null,
    ].filter(Boolean);

    return parts.length ? parts.join(' / ') : null;
};

const qualityRank = (song: AudioQualitySource) => [
    song.bitDepth || 0,
    song.sampleRate || 0,
    song.bitRate || 0,
];

/**
 * Album-level quality: the shared value when all tracks match, otherwise the
 * best track's value with `mixed: true` so callers can prefix "up to".
 */
export const getAlbumAudioQuality = (
    songs?: AudioQualitySource[] | null,
): null | { mixed: boolean; quality: string } => {
    if (!songs?.length) return null;

    const labels = new Set<string>();
    let best: AudioQualitySource | null = null;

    for (const song of songs) {
        const label = formatAudioQuality(song);
        if (!label) continue;
        labels.add(label);

        if (!best) {
            best = song;
            continue;
        }
        const a = qualityRank(song);
        const b = qualityRank(best);
        const diff = a.findIndex((value, i) => value !== b[i]);
        if (diff !== -1 && a[diff] > b[diff]) best = song;
    }

    const quality = formatAudioQuality(best);
    return quality ? { mixed: labels.size > 1, quality } : null;
};
