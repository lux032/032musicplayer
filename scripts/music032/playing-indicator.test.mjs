// Run with: pnpm test:music032  (node --test, Node >= 22.18 strips TS types)
// Covers the now-playing indicator's pure matching logic (track id + server
// id, never title) and the session work → tracks map behind card badges.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
    recordWorkTracks,
    subscribePlayingSource,
    workContainsTrack,
} from '../../src/renderer/features/home/music032/lib/playing-source-map.ts';
import { getSongPlayState } from '../../src/renderer/features/shared/components/playing-indicator/song-play-state.ts';

describe('getSongPlayState', () => {
    test('matches by id and server id', () => {
        const current = { _serverId: 's1', id: '42' };
        assert.equal(getSongPlayState(current, true, 's1', '42'), 'playing');
        assert.equal(getSongPlayState(current, false, 's1', '42'), 'paused');
    });

    test('same title on another server does not match', () => {
        const current = { _serverId: 's2', id: '42' };
        assert.equal(getSongPlayState(current, true, 's1', '42'), null);
    });

    test('different id does not match', () => {
        const current = { _serverId: 's1', id: '43' };
        assert.equal(getSongPlayState(current, true, 's1', '42'), null);
    });

    test('missing current or ids never match', () => {
        assert.equal(getSongPlayState(null, true, 's1', '42'), null);
        assert.equal(getSongPlayState(undefined, true, 's1', '42'), null);
        assert.equal(getSongPlayState({ _serverId: 's1', id: '42' }, true, '', '42'), null);
        assert.equal(getSongPlayState({ _serverId: 's1', id: '42' }, true, 's1', ''), null);
    });
});

describe('playing-source map', () => {
    test('records membership and notifies listeners', () => {
        let notified = 0;
        const unsubscribe = subscribePlayingSource(() => {
            notified += 1;
        });
        recordWorkTracks(7, [1, 2, 3]);
        assert.equal(workContainsTrack(7, 2), true);
        assert.equal(workContainsTrack(7, 9), false);
        assert.equal(workContainsTrack(8, 2), false);
        assert.equal(notified, 1);
        unsubscribe();
    });

    test('re-recording refreshes membership', () => {
        recordWorkTracks(7, [5]);
        assert.equal(workContainsTrack(7, 5), true);
        assert.equal(workContainsTrack(7, 1), false);
    });
});
