import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

import styles from '/@/renderer/features/shared/components/playing-indicator/playing-indicator.module.css';
import { SongPlayState } from '/@/renderer/features/shared/components/playing-indicator/song-play-state';

/**
 * Animated equalizer bars marking the track/container that is currently
 * playing (mirrors the 032 web client's eq-bars). Paused state freezes the
 * bars; prefers-reduced-motion renders static bars (see the CSS module).
 */
export const PlayingIndicator = ({
    className,
    state,
}: {
    className?: string;
    state: Exclude<SongPlayState, null>;
}) => {
    const { t } = useTranslation();

    return (
        <span
            aria-label={t('page.sidebar.nowPlaying')}
            className={clsx(styles.indicator, className)}
            data-state={state}
            role="img"
        >
            <i />
            <i />
            <i />
        </span>
    );
};
