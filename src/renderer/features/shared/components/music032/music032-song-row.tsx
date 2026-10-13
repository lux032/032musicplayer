import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { ItemImage } from '/@/renderer/components/item-image/item-image';
import { getTitlePath } from '/@/renderer/components/item-list/helpers/get-title-path';
import { ContextMenuController } from '/@/renderer/features/context-menu/context-menu-controller';
import {
    formatTrackDuration,
    isPrimaryRole,
    workRoleSequenceLabel,
} from '/@/renderer/features/home/music032/lib/format';
import styles from '/@/renderer/features/shared/components/music032/music032-pages.module.css';
import { PlayingIndicator } from '/@/renderer/features/shared/components/playing-indicator/playing-indicator';
import { useSongPlayState } from '/@/renderer/features/shared/components/playing-indicator/use-song-play-state';
import { useCurrentServerWithCredential } from '/@/renderer/store';
import { Icon } from '/@/shared/components/icon/icon';
import { LibraryItem, Song } from '/@/shared/types/domain-types';

export type Music032SongRowProps = {
    onPlay: () => void;
    role?: string;
    sequence?: number;
    song: Song;
};

/** 032 曲目行：封面播放、标题/艺人、用途徽标、所属专辑链接、时长；右键菜单。 */
export const Music032SongRow = ({ onPlay, role, sequence, song }: Music032SongRowProps) => {
    const { t } = useTranslation();
    const server = useCurrentServerWithCredential();
    const playState = useSongPlayState(server?.id, song.id);
    const albumPath = song.albumId ? getTitlePath(LibraryItem.ALBUM, song.albumId) : null;
    const roleLabel = role ? workRoleSequenceLabel(t, role, sequence ?? 0) : null;

    return (
        <article
            className={clsx(styles.trackRow, playState && styles.isCurrent)}
            onContextMenu={(e) => {
                e.preventDefault();
                ContextMenuController.call({
                    cmd: { items: [song], type: LibraryItem.SONG },
                    event: e,
                });
            }}
        >
            <button aria-label={song.name} className={styles.rowArt} onClick={onPlay} type="button">
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
            <div className={styles.trackMain}>
                <span className={styles.trackTitle} title={song.name}>
                    {song.name}
                </span>
                <span className={styles.trackSub}>{song.artistName}</span>
            </div>
            {roleLabel ? (
                <span
                    className={clsx(
                        styles.roleTag,
                        role && isPrimaryRole(role) && styles.isPrimary,
                    )}
                >
                    {roleLabel}
                </span>
            ) : (
                <span />
            )}
            {albumPath && song.album ? (
                <Link className={styles.trackAlbum} title={song.album} to={albumPath}>
                    {song.album}
                </Link>
            ) : (
                <span />
            )}
            <span className={styles.trackTime}>{formatTrackDuration(song.duration)}</span>
        </article>
    );
};
