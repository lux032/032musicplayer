// Type-only so node --test can load this module (scripts/music032).
import type { M032Track } from '/@/shared/api/music032/music032-types';

const range = (lo: number, hi: number, format: (v: number) => string, unit: string) => {
    if (hi <= 0) return '';
    return lo === hi ? `${format(hi)}${unit}` : `${format(lo)}–${format(hi)}${unit}`;
};

/**
 * albumSpecLabel in 032music-server (internal/http/audio_spec.go): uniform albums
 * read like one track ("FLAC / 24bit / 48kHz"), mixed ones show ranges.
 */
export const albumSpecLabel = (tracks: M032Track[], fallback: string): string => {
    const codecs: string[] = [];
    let minDepth = 0;
    let maxDepth = 0;
    let minRate = 0;
    let maxRate = 0;
    for (const track of tracks) {
        const codec = (track.codec || track.container || '').trim().toUpperCase();
        if (codec && !codecs.includes(codec)) codecs.push(codec);
        const depth = track.bitDepth || 0;
        if (depth > 0) {
            minDepth = minDepth === 0 ? depth : Math.min(minDepth, depth);
            maxDepth = Math.max(maxDepth, depth);
        }
        const rate = track.sampleRate || 0;
        if (rate > 0) {
            minRate = minRate === 0 ? rate : Math.min(minRate, rate);
            maxRate = Math.max(maxRate, rate);
        }
    }
    const label = [
        codecs.join('/'),
        range(minDepth, maxDepth, String, 'bit'),
        range(minRate, maxRate, (hz) => String(hz / 1000), 'kHz'),
    ]
        .filter(Boolean)
        .join(' / ');
    return label || fallback;
};

export type AlbumPerson = {
    id: number;
    name: string;
    roles: AlbumPersonRole[];
    trackCount: number;
};

export type AlbumPersonRole = 'arranger' | 'composer' | 'lyricist' | 'producer' | 'vocals';

const CREDIT_ORDER: AlbumPersonRole[] = ['composer', 'lyricist', 'arranger', 'producer'];

/**
 * albumPeople in 032music-server (internal/http/album_people.go): everyone who
 * performs on or is credited on the album's tracks, most tracks first,
 * performers first on ties.
 */
export const albumPeople = (tracks: M032Track[]): AlbumPerson[] => {
    type Entry = AlbumPerson & { order: number; performer: boolean; tracks: Set<number> };
    const byId = new Map<number, Entry>();
    const add = (id: number, name: string, role: AlbumPersonRole, trackId: number) => {
        if (!id || !name.trim()) return;
        let entry = byId.get(id);
        if (!entry) {
            entry = {
                id,
                name,
                order: byId.size,
                performer: false,
                roles: [],
                trackCount: 0,
                tracks: new Set(),
            };
            byId.set(id, entry);
        }
        if (role === 'vocals') entry.performer = true;
        if (!entry.roles.includes(role)) entry.roles.push(role);
        entry.tracks.add(trackId);
    };

    for (const track of tracks) {
        for (const artist of track.artists ?? []) add(artist.id, artist.name, 'vocals', track.id);
        for (const role of CREDIT_ORDER) {
            const credit = track.credits?.find((c) => c.role === role);
            for (const artist of credit?.artists ?? []) add(artist.id, artist.name, role, track.id);
        }
    }

    return [...byId.values()]
        .sort(
            (a, b) =>
                b.tracks.size - a.tracks.size ||
                Number(b.performer) - Number(a.performer) ||
                a.order - b.order,
        )
        .map(({ id, name, roles, tracks: set }) => ({ id, name, roles, trackCount: set.size }));
};
