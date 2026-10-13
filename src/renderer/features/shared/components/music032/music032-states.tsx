import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import styles from '/@/renderer/features/shared/components/music032/music032-pages.module.css';
import { Button } from '/@/shared/components/button/button';
import { Icon } from '/@/shared/components/icon/icon';
import { Skeleton } from '/@/shared/components/skeleton/skeleton';

/** 页面级骨架屏（海报网格占位）。 */
export const Music032PageSkeleton = () => (
    <div className={styles.skeletonGrid}>
        {Array.from({ length: 12 }, (_, i) => (
            <Skeleton borderRadius="10px" height={180} key={i} />
        ))}
    </div>
);

/** 页面级错误块：区块内降级 + 重试。 */
export const Music032PageError = ({ onRetry }: { onRetry: () => void }) => {
    const { t } = useTranslation();
    return (
        <div className={styles.stateBlock}>
            <h2>{t('page.home.music032.loadFailed')}</h2>
            <div className={styles.stateActions}>
                <Button onClick={onRetry} variant="default">
                    {t('page.home.music032.retry')}
                </Button>
            </div>
        </div>
    );
};

/** 页面级空数据块。 */
export const Music032PageEmpty = ({ hint, title }: { hint?: string; title: string }) => (
    <div className={styles.stateBlock}>
        <h2>{title}</h2>
        {hint && <p>{hint}</p>}
    </div>
);

/** 404：作品/系列不存在。 */
export const Music032PageNotFound = ({
    backTo,
    backToLabel,
    hint,
    onOpenWeb,
    openWebLabel,
    title,
}: {
    backTo: string;
    backToLabel: string;
    hint: string;
    onOpenWeb?: () => void;
    openWebLabel?: string;
    title: string;
}) => (
    <div className={styles.stateBlock}>
        <h2>{title}</h2>
        <p>{hint}</p>
        <div className={styles.stateActions}>
            <Button component={Link} to={backTo} variant="default">
                {backToLabel}
            </Button>
            {onOpenWeb && openWebLabel && (
                <Button
                    leftSection={<Icon icon="externalLink" />}
                    onClick={onOpenWeb}
                    variant="subtle"
                >
                    {openWebLabel}
                </Button>
            )}
        </div>
    </div>
);
