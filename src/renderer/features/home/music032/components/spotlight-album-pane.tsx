import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { m032Context } from '/@/renderer/api/music032/music032-api';
import { queryKeys } from '/@/renderer/api/query-keys';
import { ItemImage } from '/@/renderer/components/item-image/item-image';
import { getTitlePath } from '/@/renderer/components/item-list/helpers/get-title-path';
import { ContextMenuController } from '/@/renderer/features/context-menu/context-menu-controller';
import { fetchMusic032SpotlightRandom } from '/@/renderer/features/home/music032/api/music032-home-api';
import {
    SpotlightPaneProps,
    SpotlightTabs,
} from '/@/renderer/features/home/music032/components/home-spotlight';
import { audioSpecLabel, formatTrackDuration } from '/@/renderer/features/home/music032/lib/format';
import styles from '/@/renderer/features/home/music032/music032-home.module.css';
import { useMusic032HomePlay } from '/@/renderer/features/home/music032/use-music032-home-play';
import { useSetFavorite } from '/@/renderer/features/shared/hooks/use-set-favorite';
import { useCurrentServerWithCredential } from '/@/renderer/store';
import { formatDateRelative } from '/@/renderer/utils/format';
import { m032Normalize } from '/@/shared/api/music032/music032-normalize';
import { M032HomeAlbumPane } from '/@/shared/api/music032/music032-types';
import { Button } from '/@/shared/components/button/button';
import { Icon } from '/@/shared/components/icon/icon';
import { toast } from '/@/shared/components/toast/toast';
import { LibraryItem } from '/@/shared/types/domain-types';

interface SpotlightAlbumPaneComponentProps extends SpotlightPaneProps {
    pane: M032HomeAlbumPane;
}

export const SpotlightAlbumPane = (props: SpotlightAlbumPaneComponentProps) => {
    // key 由父组件按 pane 变化重置（见 home-spotlight.tsx），局部状态不需要同步。
    return (
        <SpotlightAlbumPaneInner key={`${props.pane.focus}-${props.pane.album.id}`} {...props} />
    );
};

const SpotlightAlbumPaneInner = ({
    activeTab,
    onSwitchTab,
    pane,
    tabs,
}: SpotlightAlbumPaneComponentProps) => {
    const { t } = useTranslation();
    const server = useCurrentServerWithCredential();
    const queryClient = useQueryClient();
    const { appendAlbum, playAlbum, playSongs } = useMusic032HomePlay();
    const setFavorite = useSetFavorite();

    const ctx = useMemo(() => m032Context(server), [server]);
    const album = useMemo(() => m032Normalize.album(ctx, pane.album), [ctx, pane.album]);
    const tracks = useMemo(
        () => pane.tracks.map((track) => m032Normalize.song(ctx, track, album.albumArtists)),
        [album.albumArtists, ctx, pane.tracks],
    );

    const [isFavorite, setIsFavorite] = useState(album.userFavorite);

    const rerollMutation = useMutation({
        mutationFn: () => fetchMusic032SpotlightRandom(server!, pane.album.id),
        onError: () => toast.error({ message: t('page.home.music032.loadFailed') }),
        onSuccess: (newPane) => {
            if (!server) return;
            queryClient.setQueryData(queryKeys.home.overview(server.id), (old: any) =>
                old?.spotlight ? { ...old, spotlight: { ...old.spotlight, random: newPane } } : old,
            );
        },
    });

    const resumeSong = useMemo(() => {
        if (!pane.resume) return null;
        return {
            ...m032Normalize.song(ctx, pane.resume.track, album.albumArtists),
            resumePositionMs: pane.resume.positionMillis,
        };
    }, [album.albumArtists, ctx, pane.resume]);

    const spec = useMemo(() => audioSpecLabel(pane.tracks), [pane.tracks]);
    const albumPath = getTitlePath(LibraryItem.ALBUM, album.id);

    const noteLabel = (() => {
        if (pane.focus === 'recent') {
            return pane.noteTime
                ? t('page.home.music032.addedAt', { time: formatDateRelative(pane.noteTime) })
                : null;
        }
        if (!pane.noteTime) return t('page.home.music032.neverPlayed');
        return t('page.home.music032.lastPlayedAt', { time: formatDateRelative(pane.noteTime) });
    })();

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        ContextMenuController.call({ cmd: { items: [album], type: LibraryItem.ALBUM }, event: e });
    };

    const handleFavorite = () => {
        if (!server) return;
        setFavorite(server.id, [album.id], LibraryItem.ALBUM, !isFavorite);
        setIsFavorite(!isFavorite);
    };

    return (
        <section aria-label={tabs.length ? undefined : album.name} className={styles.hero}>
            <div aria-hidden className={styles.heroBg}>
                {album.imageId && (
                    <ItemImage
                        containerClassName={styles.imgBox}
                        id={album.imageId}
                        itemType={LibraryItem.ALBUM}
                        size={512}
                    />
                )}
            </div>
            <div className={styles.heroInner}>
                <div className={styles.heroArt} onContextMenu={handleContextMenu}>
                    {album.imageId ? (
                        <ItemImage
                            containerClassName={styles.imgBox}
                            id={album.imageId}
                            itemType={LibraryItem.ALBUM}
                            size={512}
                        />
                    ) : (
                        <div className={styles.heroArtPlaceholder}>032</div>
                    )}
                </div>
                <div className={styles.heroInfo}>
                    <SpotlightTabs activeTab={activeTab} onSwitchTab={onSwitchTab} tabs={tabs} />
                    <h2 className={styles.heroTitle} title={album.name}>
                        {albumPath ? <Link to={albumPath}>{album.name}</Link> : album.name}
                    </h2>
                    <p className={styles.heroBy}>
                        {album.albumArtists.map((artist, index) => (
                            <span key={`${artist.id}-${index}`}>
                                {index > 0 && ', '}
                                {artist.id ? (
                                    <Link
                                        to={
                                            getTitlePath(LibraryItem.ALBUM_ARTIST, artist.id) || '#'
                                        }
                                    >
                                        {artist.name}
                                    </Link>
                                ) : (
                                    artist.name
                                )}
                            </span>
                        ))}
                    </p>
                    <ul className={styles.heroFacts}>
                        {album.releaseYear && <li>{album.releaseYear}</li>}
                        <li>{t('page.home.music032.tracksCount', { count: album.songCount })}</li>
                        {pane.album.discCount > 1 && <li>{pane.album.discCount} Disc</li>}
                        {pane.previewDurationMillis > 0 && (
                            <li>{formatTrackDuration(pane.previewDurationMillis)}</li>
                        )}
                    </ul>
                    <p className={styles.heroSubFacts}>
                        {spec && <span className={styles.heroSpecTag}>{spec}</span>}
                        {noteLabel && <span>{noteLabel}</span>}
                    </p>
                    <div className={styles.heroActions}>
                        {pane.focus === 'listening' && resumeSong ? (
                            <>
                                <Button
                                    leftSection={<Icon icon="mediaPlay" />}
                                    onClick={() => playSongs([resumeSong])}
                                    variant="filled"
                                >
                                    {t('page.home.music032.resumeFrom', {
                                        position: formatTrackDuration(pane.resume?.positionMillis),
                                    })}
                                </Button>
                                <Button onClick={() => playAlbum(album.id)} variant="default">
                                    {t('page.home.music032.playFromStart')}
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button
                                    leftSection={<Icon icon="mediaPlay" />}
                                    onClick={() => playAlbum(album.id)}
                                    variant="filled"
                                >
                                    {t('player.play')}
                                </Button>
                                <Button
                                    leftSection={<Icon icon="playlistAdd" />}
                                    onClick={() => appendAlbum(album.id)}
                                    variant="default"
                                >
                                    {t('page.home.music032.addToQueue')}
                                </Button>
                            </>
                        )}
                        <Button
                            aria-pressed={isFavorite}
                            onClick={handleFavorite}
                            variant={isFavorite ? 'light' : 'default'}
                        >
                            <Icon icon="favorite" />
                        </Button>
                        {pane.focus === 'random' && (
                            <Button
                                leftSection={<Icon icon="refresh" />}
                                loading={rerollMutation.isPending}
                                onClick={() => rerollMutation.mutate()}
                                variant="subtle"
                            >
                                {t('page.home.music032.reroll')}
                            </Button>
                        )}
                        {albumPath && (
                            <Link
                                className={`${styles.sectionLink} ${styles.heroDetailLink}`}
                                to={albumPath}
                            >
                                {t('page.home.music032.albumDetail')}
                                <Icon icon="arrowRightS" />
                            </Link>
                        )}
                    </div>
                </div>
                {tracks.length > 0 && (
                    <aside aria-label={t('page.home.music032.tracks')} className={styles.heroSide}>
                        <div className={styles.heroSideHead}>
                            <h3>{t('page.home.music032.tracks')}</h3>
                            <span>
                                {t('page.home.music032.tracksCount', { count: album.songCount })}
                                {pane.album.discCount > 1 && ` · ${pane.album.discCount} Disc`}
                            </span>
                        </div>
                        <ol className={styles.heroTracks}>
                            {tracks.map((track, index) => (
                                <li key={track.id}>
                                    <button
                                        aria-label={track.name}
                                        className={styles.heroTrackRow}
                                        onClick={() => playSongs(tracks, track.id)}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            ContextMenuController.call({
                                                cmd: { items: [track], type: LibraryItem.SONG },
                                                event: e,
                                            });
                                        }}
                                        type="button"
                                    >
                                        <span className={styles.no}>
                                            {track.trackNumber || index + 1}
                                        </span>
                                        <span className={styles.t}>
                                            <b title={track.name}>{track.name}</b>
                                            <small>{track.artistName}</small>
                                        </span>
                                        <span className={styles.d}>
                                            {formatTrackDuration(track.duration)}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ol>
                        {albumPath && (
                            <Link
                                className={`${styles.sectionLink} ${styles.heroSideLink}`}
                                to={albumPath}
                            >
                                {tracks.length < (album.songCount || 0)
                                    ? t('page.home.music032.viewAllTracks', {
                                          count: album.songCount,
                                      })
                                    : t('page.home.music032.albumDetail')}
                                <Icon icon="arrowRightS" />
                            </Link>
                        )}
                    </aside>
                )}
            </div>
        </section>
    );
};
