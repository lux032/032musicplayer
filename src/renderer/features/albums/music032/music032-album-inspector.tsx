import { useQuery } from '@tanstack/react-query';
import { Fragment, ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { generatePath, Link } from 'react-router';

import styles from './music032-album-inspector.module.css';

import { ItemImage } from '/@/renderer/components/item-image/item-image';
import {
    music032AlbumQueries,
    Music032AlbumWorkView,
    useMusic032AlbumWorks,
} from '/@/renderer/features/albums/music032/music032-album-api';
import {
    albumPeople,
    AlbumPersonRole,
    albumSpecLabel,
} from '/@/renderer/features/albums/music032/music032-album-helpers';
import { Music032AlbumTrackScopeProvider } from '/@/renderer/features/albums/music032/music032-track-tieup';
import {
    workAlbumTypeLabel,
    workTypeLongLabel,
} from '/@/renderer/features/home/music032/lib/format';
import { AppRoute } from '/@/renderer/router/routes';
import { M032ArtistRef, M032Track } from '/@/shared/api/music032/music032-types';
import { LibraryItem, ServerListItemWithCredential } from '/@/shared/types/domain-types';

const PEOPLE_PREVIEW = 8;
const WORKS_PREVIEW = 3;
const WORK_TRACKS_PREVIEW = 3;
const NO_TRACKS: M032Track[] = [];

const artistPath = (id: number) =>
    generatePath(AppRoute.LIBRARY_ALBUM_ARTISTS_DETAIL, { albumArtistId: String(id) });

const workPath = (id: number) =>
    generatePath(AppRoute.LIBRARY_WORKS_DETAIL, { workId: String(id) });

const useAlbumData = (server: ServerListItemWithCredential, albumId: string) => {
    const { t } = useTranslation();
    const detailQuery = useQuery(music032AlbumQueries.detail(server, albumId));
    const tracks = detailQuery.data?.tracks ?? NO_TRACKS;
    const { trackTieups, works } = useMusic032AlbumWorks(server, albumId, tracks, t);
    return { album: detailQuery.data?.album, tracks, trackTieups, works };
};

/** Feeds the album track table's title cells: linked works and credits per track. */
export const Music032AlbumTieupScope = ({
    albumId,
    children,
    server,
}: {
    albumId: string;
    children: ReactNode;
    server: ServerListItemWithCredential;
}) => {
    const { tracks, trackTieups } = useAlbumData(server, albumId);
    const scope = useMemo(
        () => ({
            tieups: trackTieups,
            tracks: new Map(tracks.map((track) => [String(track.id), track])),
        }),
        [trackTieups, tracks],
    );
    return (
        <Music032AlbumTrackScopeProvider value={scope}>{children}</Music032AlbumTrackScopeProvider>
    );
};

const ArtistLinks = ({ artists, fallback }: { artists?: M032ArtistRef[]; fallback: string }) => {
    if (!artists?.length) return <>{fallback}</>;
    return (
        <>
            {artists.map((artist, index) => (
                <Fragment key={artist.id}>
                    {index > 0 && '、'}
                    <Link className={styles.link} to={artistPath(artist.id)}>
                        {artist.name}
                    </Link>
                </Fragment>
            ))}
        </>
    );
};

const Section = ({ children, title }: { children: ReactNode; title: string }) => (
    <section className={styles.section}>
        <p className={styles.kicker}>{title}</p>
        {children}
    </section>
);

const FactList = ({ rows }: { rows: [string, ReactNode][] }) => (
    <dl className={styles.facts}>
        {rows.map(([label, value]) => (
            <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
            </div>
        ))}
    </dl>
);

const workRelationLabel = (t: (key: string) => string, work: Music032AlbumWorkView) =>
    work.usage ||
    (work.albumRole === 'ost'
        ? t('page.works.relationOst')
        : t('page.albumDetail.music032.wholeAlbum'));

const WorkCard = ({ work }: { work: Music032AlbumWorkView }) => {
    const { t } = useTranslation();
    const [showAllTracks, setShowAllTracks] = useState(false);
    const tracks = showAllTracks ? work.tracks : work.tracks.slice(0, WORK_TRACKS_PREVIEW);
    const meta = [workTypeLongLabel(t, work.type), work.year > 0 ? String(work.year) : null]
        .filter(Boolean)
        .join(' · ');
    return (
        <div className={styles.work}>
            <Link className={styles.workHead} to={workPath(work.id)}>
                <ItemImage
                    containerClassName={styles.workPoster}
                    id={work.posterPath}
                    itemType={LibraryItem.ALBUM}
                    size={192}
                />
                <span className={styles.workText}>
                    <strong>{work.title}</strong>
                    {work.translatedTitle && <small>{work.translatedTitle}</small>}
                    <small>{meta}</small>
                    <span className={styles.roleTag}>{workRelationLabel(t, work)}</span>
                </span>
            </Link>
            {work.tracks.length > 0 && (
                <ul className={styles.workTracks}>
                    {tracks.map((track) => (
                        <li key={track.id}>
                            <span className={styles.trackRole}>{track.label}</span>
                            <span className={styles.trackTitle} title={track.title}>
                                {track.title}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            {work.tracks.length > WORK_TRACKS_PREVIEW && !showAllTracks && (
                <button
                    className={styles.more}
                    onClick={() => setShowAllTracks(true)}
                    type="button"
                >
                    {t('page.albumDetail.music032.showAllTracks', { count: work.tracks.length })}
                </button>
            )}
        </div>
    );
};

const Works = ({ works }: { works: Music032AlbumWorkView[] }) => {
    const { t } = useTranslation();
    const [showAll, setShowAll] = useState(false);
    if (works.length === 0) return null;
    const shown = showAll ? works : works.slice(0, WORKS_PREVIEW);
    return (
        <Section title={`${t('page.albumDetail.music032.worksTitle')} (${works.length})`}>
            <div className={styles.works}>
                {shown.map((work) => (
                    <WorkCard key={work.id} work={work} />
                ))}
            </div>
            {works.length > WORKS_PREVIEW && !showAll && (
                <button className={styles.more} onClick={() => setShowAll(true)} type="button">
                    {t('page.albumDetail.music032.showAllWorks', { count: works.length })}
                </button>
            )}
        </Section>
    );
};

const ROLE_KEYS: Record<AlbumPersonRole, string> = {
    arranger: 'page.albumDetail.music032.roleArranger',
    composer: 'page.albumDetail.music032.roleComposer',
    lyricist: 'page.albumDetail.music032.roleLyricist',
    producer: 'page.albumDetail.music032.roleProducer',
    vocals: 'page.albumDetail.music032.roleVocals',
};

const People = ({ tracks }: { tracks: M032Track[] }) => {
    const { t } = useTranslation();
    const [showAll, setShowAll] = useState(false);
    const people = useMemo(() => albumPeople(tracks), [tracks]);
    if (people.length === 0) return null;
    const shown = showAll ? people : people.slice(0, PEOPLE_PREVIEW);
    return (
        <Section title={`${t('page.albumDetail.music032.participants')} (${people.length})`}>
            <ul className={styles.people}>
                {shown.map((person) => (
                    <li key={person.id}>
                        <Link className={styles.person} to={artistPath(person.id)}>
                            <ItemImage
                                containerClassName={styles.avatar}
                                id={String(person.id)}
                                itemType={LibraryItem.ALBUM_ARTIST}
                                size={64}
                            />
                            <span className={styles.personText}>
                                <strong>{person.name}</strong>
                                <small>
                                    {person.roles.map((role) => t(ROLE_KEYS[role])).join(' · ')}
                                    {' · '}
                                    {t('page.albumDetail.music032.participantTracks', {
                                        count: person.trackCount,
                                    })}
                                </small>
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
            {people.length > PEOPLE_PREVIEW && !showAll && (
                <button className={styles.more} onClick={() => setShowAll(true)} type="button">
                    {t('page.albumDetail.music032.showAllPeople', { count: people.length })}
                </button>
            )}
        </Section>
    );
};

/** Right-hand column of the 032 web album page: works, release, people, media. */
export const Music032AlbumInspector = ({
    albumId,
    server,
}: {
    albumId: string;
    server: ServerListItemWithCredential;
}) => {
    const { t } = useTranslation();
    const { album, tracks, works } = useAlbumData(server, albumId);
    if (!album) return null;

    const k = (key: string) => t(`page.albumDetail.music032.${key}`);
    const kind = album.releaseKind || album.albumType;
    const release: [string, ReactNode][] = [];
    if (kind) release.push([k('type'), workAlbumTypeLabel(t, kind)]);
    release.push([
        k('performer'),
        <ArtistLinks
            artists={album.artists}
            fallback={album.performedBy || album.artist}
            key="performer"
        />,
    ]);
    if (album.releaseDate) release.push([k('releaseDate'), album.releaseDate]);
    if (album.originalReleaseDate) release.push([k('originalRelease'), album.originalReleaseDate]);
    if (album.label) release.push([k('label'), album.label]);
    if (album.catalogNumber) release.push([k('catalogNumber'), album.catalogNumber]);
    if (album.country) release.push([k('country'), album.country]);
    if (album.genres) release.push([k('genres'), album.genres]);

    const spec = albumSpecLabel(tracks, album.formats);
    const media: [string, ReactNode][] = [];
    if (spec) media.push([k('format'), spec]);
    if (album.totalSize) media.push([k('size'), album.totalSize]);

    return (
        <div className={styles.inspector}>
            <Works works={works} />
            <Section title={k('releaseInfo')}>
                <FactList rows={release} />
            </Section>
            <People tracks={tracks} />
            {media.length > 0 && (
                <Section title={k('mediaInfo')}>
                    <FactList rows={media} />
                </Section>
            )}
        </div>
    );
};

/** Work capsules under the album title, like the 032 web album hero. */
export const Music032AlbumWorkCapsules = ({
    albumId,
    server,
}: {
    albumId: string;
    server: ServerListItemWithCredential;
}) => {
    const { works } = useAlbumData(server, albumId);
    if (works.length === 0) return null;
    return (
        <div className={styles.capsules}>
            {works.map((work) => {
                const label = work.usage || (work.albumRole === 'ost' ? 'OST' : '');
                return (
                    <Link
                        className={styles.capsule}
                        key={work.id}
                        title={work.title}
                        to={workPath(work.id)}
                    >
                        <ItemImage
                            containerClassName={styles.capsulePoster}
                            id={work.posterPath}
                            itemType={LibraryItem.ALBUM}
                            size={96}
                        />
                        <span className={styles.capsuleTitle}>{work.title}</span>
                        {label && (
                            <span
                                className={
                                    work.albumRole === 'ost'
                                        ? styles.capsuleOst
                                        : styles.capsuleRole
                                }
                            >
                                {label}
                            </span>
                        )}
                    </Link>
                );
            })}
        </div>
    );
};
