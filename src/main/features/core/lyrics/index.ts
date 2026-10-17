import { ipcMain } from 'electron';

import {
    convertFurigana,
    convertFuriganaFragment,
    convertRomaji,
    convertRomajiTokens,
    parseLyricsTextTokens,
} from './furigana';

// Lyrics themselves (local files, online sources, translation) come from the
// 032 server; the main process only provides furigana / romaji conversion.

ipcMain.handle('lyric-convert-furigana', async (_event, text: string) => {
    return await convertFurigana(text);
});

ipcMain.handle('lyric-convert-furigana-fragment', async (_event, text: string) => {
    return await convertFuriganaFragment(text);
});

ipcMain.handle('lyric-parse-text-tokens', async (_event, text: string) => {
    return await parseLyricsTextTokens(text);
});

ipcMain.handle('lyric-convert-romaji', async (_event, text: string) => {
    return await convertRomaji(text);
});

ipcMain.handle('lyric-convert-romaji-tokens', async (_event, text: string) => {
    return await convertRomajiTokens(text);
});
