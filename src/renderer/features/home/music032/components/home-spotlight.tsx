import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SpotlightAlbumPane } from '/@/renderer/features/home/music032/components/spotlight-album-pane';
import { SpotlightSeriesPane } from '/@/renderer/features/home/music032/components/spotlight-series-pane';
import styles from '/@/renderer/features/home/music032/music032-home.module.css';
import { M032HomeSpotlight } from '/@/shared/api/music032/music032-types';
import { SegmentedControl } from '/@/shared/components/segmented-control/segmented-control';

export type SpotlightTab = 'listening' | 'random' | 'recent' | 'series';

export const useSpotlightTabLabel = () => {
    const { t } = useTranslation();
    return (tab: string): string => {
        switch (tab) {
            case 'listening':
                return t('page.home.music032.tabListening');
            case 'random':
                return t('page.home.music032.tabRandom');
            case 'series':
                return t('page.home.music032.tabSeries');
            case 'recent':
            default:
                return t('page.home.music032.tabRecent');
        }
    };
};

export interface SpotlightPaneProps {
    activeTab: string;
    onSwitchTab: (tab: string) => void;
    tabs: string[];
}

/** 聚焦卡页签（渲染在每个 pane 的信息栏顶部，与网页一致）。 */
export const SpotlightTabs = ({ activeTab, onSwitchTab, tabs }: SpotlightPaneProps) => {
    const tabLabel = useSpotlightTabLabel();
    return (
        <div className={styles.heroTabs}>
            <SegmentedControl
                data={tabs.map((tab) => ({ label: tabLabel(tab), value: tab }))}
                onChange={onSwitchTab}
                value={activeTab}
            />
        </div>
    );
};

/** 聚焦卡：最新入库 / 最近在听 / 作品聚焦 / 随机重温。 */
export const HomeSpotlight = ({ spotlight }: { spotlight: M032HomeSpotlight }) => {
    const [activeTab, setActiveTab] = useState(spotlight.defaultTab || 'recent');

    const paneProps: SpotlightPaneProps = {
        activeTab,
        onSwitchTab: setActiveTab,
        tabs: spotlight.tabs,
    };

    const pane =
        activeTab === 'series'
            ? spotlight.series
            : activeTab === 'listening'
              ? spotlight.listening
              : activeTab === 'random'
                ? spotlight.random
                : spotlight.recent;

    // 页签对应的数据缺失时退回默认页签。
    if (!pane) {
        return spotlight.recent ? (
            <SpotlightAlbumPane pane={spotlight.recent} {...paneProps} />
        ) : null;
    }

    if (activeTab === 'series' && spotlight.series) {
        return <SpotlightSeriesPane pane={spotlight.series} {...paneProps} />;
    }

    return (
        <SpotlightAlbumPane pane={pane as NonNullable<typeof spotlight.recent>} {...paneProps} />
    );
};
