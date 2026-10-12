import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import styles from '/@/renderer/features/home/music032/music032-home.module.css';
import { Button } from '/@/shared/components/button/button';

interface HomeSectionProps {
    children: ReactNode;
    count?: ReactNode;
    title: string;
    tools?: ReactNode;
}

export const HomeSection = ({ children, count, title, tools }: HomeSectionProps) => (
    <section className={styles.section}>
        <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{title}</h2>
            {count && <span className={styles.sectionCount}>{count}</span>}
            {tools && <div className={styles.sectionTools}>{tools}</div>}
        </div>
        {children}
    </section>
);

export const HomeInlineEmpty = ({ hint, title }: { hint?: string; title: string }) => (
    <div className={styles.inlineEmpty}>
        <strong>{title}</strong>
        {hint && <span>{hint}</span>}
    </div>
);

/** 单个区块出错时只在本区块内降级，不影响整页。 */
export const HomeSectionError = ({ onRetry }: { onRetry: () => void }) => {
    const { t } = useTranslation();
    return (
        <div className={styles.inlineEmpty}>
            <strong>{t('page.home.music032.loadFailed')}</strong>
            <Button onClick={onRetry} size="sm" variant="subtle">
                {t('page.home.music032.retry')}
            </Button>
        </div>
    );
};
