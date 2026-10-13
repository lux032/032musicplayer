// Run with: pnpm test:music032  (node --test, Node >= 22.18 strips TS types)
// Album detail helpers ported from 032music-server (audio_spec.go, album_people.go).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
    albumPeople,
    albumSpecLabel,
} from '../../src/renderer/features/albums/music032/music032-album-helpers.ts';

describe('albumSpecLabel', () => {
    test('uniform album reads like one track', () => {
        const tracks = [
            { bitDepth: 24, codec: 'flac', sampleRate: 48000 },
            { bitDepth: 24, codec: 'flac', sampleRate: 48000 },
        ];
        assert.equal(albumSpecLabel(tracks, ''), 'FLAC / 24bit / 48kHz');
    });

    test('mixed album shows codecs and ranges', () => {
        const tracks = [
            { bitDepth: 16, codec: 'flac', sampleRate: 44100 },
            { bitDepth: 24, codec: 'alac', sampleRate: 96000 },
        ];
        assert.equal(albumSpecLabel(tracks, ''), 'FLAC/ALAC / 16–24bit / 44.1–96kHz');
    });

    test('falls back without format data', () => {
        assert.equal(albumSpecLabel([{}], 'FLAC'), 'FLAC');
    });
});

describe('albumPeople', () => {
    test('merges performers and credits, most tracks first, performers on ties', () => {
        const singer = { id: 1, name: 'Singer' };
        const composer = { id: 2, name: 'Composer' };
        const both = { id: 3, name: 'Both' };
        const tracks = [
            {
                artists: [singer],
                credits: [{ artists: [composer, both], role: 'composer' }],
                id: 10,
            },
            {
                artists: [both],
                credits: [{ artists: [composer], role: 'lyricist' }],
                id: 11,
            },
        ];
        assert.deepEqual(albumPeople(tracks), [
            { id: 3, name: 'Both', roles: ['composer', 'vocals'], trackCount: 2 },
            { id: 2, name: 'Composer', roles: ['composer', 'lyricist'], trackCount: 2 },
            { id: 1, name: 'Singer', roles: ['vocals'], trackCount: 1 },
        ]);
    });
});
