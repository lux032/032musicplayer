import { ipcRenderer } from 'electron';

const convertFurigana = (text: string): Promise<string> => {
    return ipcRenderer.invoke('lyric-convert-furigana', text);
};

const convertFuriganaFragment = (text: string): Promise<string> => {
    return ipcRenderer.invoke('lyric-convert-furigana-fragment', text);
};

const parseLyricsTextTokens = (text: string) => {
    return ipcRenderer.invoke('lyric-parse-text-tokens', text);
};

const convertRomaji = (text: string): Promise<string> => {
    return ipcRenderer.invoke('lyric-convert-romaji', text);
};

const convertRomajiTokens = (text: string) => {
    return ipcRenderer.invoke('lyric-convert-romaji-tokens', text);
};

export const lyrics = {
    convertFurigana,
    convertFuriganaFragment,
    convertRomaji,
    convertRomajiTokens,
    parseLyricsTextTokens,
};

export type Lyrics = typeof lyrics;
