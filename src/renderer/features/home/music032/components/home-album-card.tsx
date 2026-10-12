import { DataRow, MemoizedItemCard } from '/@/renderer/components/item-card/item-card';
import { ItemControls } from '/@/renderer/components/item-list/types';
import styles from '/@/renderer/features/home/music032/music032-home.module.css';
import { PlayingIndicator } from '/@/renderer/features/shared/components/playing-indicator/playing-indicator';
import { useAlbumPlayState } from '/@/renderer/features/shared/components/playing-indicator/use-song-play-state';
import { useCurrentServerWithCredential } from '/@/renderer/store';
import { Album, LibraryItem } from '/@/shared/types/domain-types';

/** feishin 专辑卡片 + 当前播放徽标（当前曲目属于该专辑时显示）。 */
export const HomeAlbumCard = ({
    album,
    controls,
    rows,
}: {
    album: Album;
    controls: ItemControls;
    rows: DataRow[];
}) => {
    const server = useCurrentServerWithCredential();
    const playState = useAlbumPlayState(server?.id, album.id);

    return (
        <div className={styles.cardWrap}>
            <MemoizedItemCard
                controls={controls}
                data={album}
                enableDrag={false}
                enableExpansion={false}
                imageFetchPriority="low"
                itemType={LibraryItem.ALBUM}
                rows={rows}
                type="poster"
                withControls
            />
            {playState && (
                <span className={styles.cardBadge}>
                    <PlayingIndicator state={playState} />
                </span>
            )}
        </div>
    );
};
