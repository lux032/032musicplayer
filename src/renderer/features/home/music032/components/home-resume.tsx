import clsx from 'clsx';
import { CSSProperties, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { m032Context } from '/@/renderer/api/music032/music032-api';
import { ItemImage } from '/@/renderer/components/item-image/item-image';
import { getTitlePath } from '/@/renderer/components/item-list/helpers/get-title-path';
import { ContextMenuController } from '/@/renderer/features/context-menu/context-menu-controller';
import {
    HomeInlineEmpty,
    HomeSection,
} from '/@/renderer/features/home/music032/components/home-section';
import { formatTrackDuration } from '/@/renderer/features/home/music032/lib/format';
import { openMusic032WebPath } from '/@/renderer/features/home/music032/lib/open-music032-web';
import styles from '/@/renderer/features/home/music032/music032-home.module.css';
import { useMusic032HomePlay } from '/@/renderer/features/home/music032/use-music032-home-play';
import { PlayingIndicator } from '/@/renderer/features/shared/components/playing-indicator/playing-indicator';
import { useSongPlayState } from '/@/renderer/features/shared/components/playing-indicator/use-song-play-state';
import { useCurrentServerWithCredential } from '/@/renderer/store';
import { formatHrDateTime } from '/@/renderer/utils/format';
import { m032Normalize } from '/@/shared/api/music032/music032-normalize';
import { M032PlaybackRecord } from '/@/shared/api/music032/music032-types';
import { Icon } from '/@/shared/components/icon/icon';
import { LibraryItem, Song } from '/@/shared/types/domain-types';

/** 接着听：未听完的曲目，从断点继续；宽屏两列、按列填充。 */
export const HomeResume = ({ records }: { records: M032PlaybackRecord[] }) => {
    const { t } = useTranslation();
    const server = useCurrentServerWithCredential();
    const { playSongs } = useMusic032HomePlay();

    const items = useMemo(() => {
        const ctx = m032Context(server);
        return records.map((record) => ({
            percent:
                record.durationMillis > 0
                    ? Math.min(
                          100,
                          Math.round((record.positionMillis / record.durationMillis) * 100),
                      )
                    : 0,
            record,
            song: {
                ...m032Normalize.song(ctx, record.track),
                resumePositionMs: record.positionMillis,
            },
        }));
    }, [records, server]);

    return (
        <HomeSection
            count={
                items.length > 0
                    ? t('page.home.music032.resumeCount', { count: items.length })
                    : undefined
            }
            title={t('page.home.music032.resume')}
            tools={
                <button
                    className={styles.sectionLink}
                    onClick={() => openMusic032WebPath(server ?? null, '/admin/playback')}
                    type="button"
                >
                    {t('page.home.music032.playbackHistory')}
                    <Icon icon="arrowRightS" />
                </button>
            }
        >
            {items.length === 0 ? (
                <HomeInlineEmpty
                    hint={t('page.home.music032.resumeEmptyHint')}
                    title={t('page.home.music032.resumeEmpty')}
                />
            ) : (
                <div
                    className={clsx(styles.rows, styles.resumeRows)}
                    style={{ '--rows': Math.ceil(items.length / 2) } as CSSProperties}
                >
                    {items.map(({ percent, record, song }) => (
                        <ResumeRow
                            key={record.trackId}
                            onPlay={() => playSongs([song])}
                            percent={percent}
                            record={record}
                            song={song}
                        />
                    ))}
                </div>
            )}
        </HomeSection>
    );
};

type ResumeRowProps = {
    onPlay: () => void;
    percent: number;
    record: M032PlaybackRecord;
    song: Song;
};

const ResumeRow = ({ onPlay, percent, record, song }: ResumeRowProps) => {
    const { t } = useTranslation();
    const server = useCurrentServerWithCredential();
    const playState = useSongPlayState(server?.id, song.id);

    return (
        <article
            className={clsx(styles.resumeRow, playState && styles.isCurrent)}
            onContextMenu={(e) => {
                e.preventDefault();
                ContextMenuController.call({
                    cmd: { items: [song], type: LibraryItem.SONG },
                    event: e,
                });
            }}
        >
            <button
                aria-label={t('page.home.music032.resumeFrom', {
                    position: formatTrackDuration(record.positionMillis),
                })}
                className={styles.rowArt}
                onClick={onPlay}
                type="button"
            >
                {song.imageId ? (
                    <ItemImage
                        containerClassName={styles.imgBox}
                        id={song.imageId}
                        itemType={LibraryItem.SONG}
                        size={256}
                    />
                ) : (
                    <span>032</span>
                )}
                <span className={styles.rowArtPlay}>
                    {playState ? <PlayingIndicator state={playState} /> : <Icon icon="mediaPlay" />}
                </span>
            </button>
            <div className={styles.rowMain}>
                <span className={styles.rowTitle} title={song.name}>
                    {song.name}
                </span>
                <span className={styles.rowSub}>
                    {song.artistName}
                    {song.albumId && song.album && (
                        <>
                            {' · '}
                            <Link to={getTitlePath(LibraryItem.ALBUM, song.albumId) || '#'}>
                                {song.album}
                            </Link>
                        </>
                    )}
                </span>
                <span className={styles.rowProgress}>
                    <span aria-label={`${percent}%`} className={styles.rowMeter} role="img">
                        <i style={{ width: `${percent}%` }} />
                    </span>
                    <span className={styles.rowTime}>
                        {formatTrackDuration(record.positionMillis)} /{' '}
                        {formatTrackDuration(record.durationMillis)}
                    </span>
                </span>
            </div>
            <span className={styles.rowWhen}>{formatHrDateTime(record.lastPlayedAt)}</span>
        </article>
    );
};
