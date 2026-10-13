import { createContext, Fragment, ReactNode, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { generatePath, Link } from 'react-router';

import styles from './music032-track-tieup.module.css';

import { ItemImage } from '/@/renderer/components/item-image/item-image';
import {
    Music032AlbumWorkView,
    Music032TrackTieups,
} from '/@/renderer/features/albums/music032/music032-album-api';
import { workTypeLongLabel } from '/@/renderer/features/home/music032/lib/format';
import { AppRoute } from '/@/renderer/router/routes';
import { M032ArtistRef, M032Track } from '/@/shared/api/music032/music032-types';
import { Popover } from '/@/shared/components/popover/popover';
import { LibraryItem } from '/@/shared/types/domain-types';

export type Music032AlbumTrackScope = {
    tieups: Music032TrackTieups;
    /** Raw 032 tracks by song id: performers, credits and text fallbacks. */
    tracks: Map<string, M032Track>;
};

const ScopeContext = createContext<Music032AlbumTrackScope | null>(null);

/** Feeds the title cells of a 032 album track table (tieups + credits line). */
export const Music032AlbumTrackScopeProvider = ScopeContext.Provider;

const artistPath = (id: number) =>
    generatePath(AppRoute.LIBRARY_ALBUM_ARTISTS_DETAIL, { albumArtistId: String(id) });

const Names = ({ fallback, refs }: { fallback: string; refs: M032ArtistRef[] | undefined }) => {
    if (!refs?.length) return <>{fallback}</>;
    return (
        <>
            {refs.map((ref, index) => (
                <Fragment key={ref.id}>
                    {index > 0 && ', '}
                    <Link className={styles.creditLink} to={artistPath(ref.id)}>
                        {ref.name}
                    </Link>
                </Fragment>
            ))}
        </>
    );
};

// Same order and fallbacks as the web template "track-credits" (album.html).
const CREDIT_ROLES = [
    { key: 'roleLyricist', role: 'lyricist', text: (t: M032Track) => t.lyricist },
    { key: 'roleComposer', role: 'composer', text: (t: M032Track) => t.composer },
    { key: 'roleArranger', role: 'arranger', text: (t: M032Track) => t.arranger },
    { key: 'roleProducer', role: 'producer', text: () => '' },
] as const;

/** "Performers · 作词 A · 作曲 B · 编曲 C", one line, names link to artists. */
const TrackCredits = ({ track }: { track: M032Track }) => {
    const { t } = useTranslation();
    const credits = CREDIT_ROLES.map(({ key, role, text }) => ({
        key,
        refs: track.credits?.find((credit) => credit.role === role)?.artists,
        text: text(track),
    })).filter((credit) => credit.refs?.length || credit.text);

    return (
        <div className={styles.credits}>
            <Names fallback={track.artist} refs={track.artists} />
            {credits.map((credit) => (
                <Fragment key={credit.key}>
                    {' · '}
                    {t(`page.albumDetail.music032.${credit.key}`)}{' '}
                    <Names fallback={credit.text} refs={credit.refs} />
                </Fragment>
            ))}
        </div>
    );
};

const TieupTrigger = ({ tieups }: { tieups: { label: string; work: Music032AlbumWorkView }[] }) => {
    const { t } = useTranslation();
    const [opened, setOpened] = useState(false);

    const [first] = tieups;
    return (
        <Popover onChange={setOpened} opened={opened} position="bottom-end" width={340}>
            <Popover.Target>
                <button
                    aria-label={t('page.albumDetail.music032.tieupTitle', {
                        title: first.work.title,
                    })}
                    className={styles.trigger}
                    data-active={opened || undefined}
                    onClick={(event) => {
                        event.stopPropagation();
                        setOpened((value) => !value);
                    }}
                    onDoubleClick={(event) => event.stopPropagation()}
                    title={`${first.work.title} (${first.label})`}
                    type="button"
                >
                    <span aria-hidden className={styles.diamond}>
                        ◆
                    </span>
                    <span>{first.label}</span>
                    {tieups.length > 1 && <span className={styles.count}>{tieups.length}</span>}
                </button>
            </Popover.Target>
            <Popover.Dropdown onClick={(event) => event.stopPropagation()} p="sm">
                {tieups.map(({ label, work }) => (
                    <Link
                        className={styles.item}
                        key={work.id}
                        onClick={() => setOpened(false)}
                        to={generatePath(AppRoute.LIBRARY_WORKS_DETAIL, {
                            workId: String(work.id),
                        })}
                    >
                        <ItemImage
                            containerClassName={styles.poster}
                            id={work.posterPath}
                            itemType={LibraryItem.ALBUM}
                            size={192}
                        />
                        <span className={styles.meta}>
                            <strong>{work.title}</strong>
                            {work.translatedTitle && <small>{work.translatedTitle}</small>}
                            <span className={styles.badges}>
                                <span className={styles.role}>{label}</span>
                                <span>{workTypeLongLabel(t, work.type)}</span>
                                {work.year > 0 && <span>{work.year}</span>}
                            </span>
                            <span className={styles.hint}>
                                {t('page.albumDetail.music032.viewWork')}
                            </span>
                        </span>
                    </Link>
                ))}
            </Popover.Dropdown>
        </Popover>
    );
};

/**
 * Wraps a song title cell inside a 032 album track table: adds the web's
 * credits line under the title (withCredits) and the "◆ OP" marker for tracks
 * linked to a work. Outside Music032AlbumTrackScopeProvider it is a no-op.
 */
export const Music032TitleTieup = ({
    children,
    songId,
    withCredits = false,
}: {
    children: ReactNode;
    songId: string | undefined;
    withCredits?: boolean;
}) => {
    const scope = useContext(ScopeContext);
    if (!songId || !scope) return <>{children}</>;
    const tieups = scope.tieups.get(songId);
    const track = withCredits ? scope.tracks.get(songId) : undefined;
    if (!tieups?.length && !track) return <>{children}</>;
    return (
        <div className={styles.row}>
            <div className={styles.title}>
                {children}
                {track && <TrackCredits track={track} />}
            </div>
            {tieups?.length ? <TieupTrigger tieups={tieups} /> : null}
        </div>
    );
};
