import { useTranslation } from 'react-i18next';

import { PasswordInput } from '/@/shared/components/password-input/password-input';

type InputProps = Record<string, any>;

interface Music032CredentialFieldsProps {
    apiTokenProps: InputProps;
    /** Edit form: an empty field keeps the stored credential. */
    keepExistingHint?: boolean;
    mediaTokenProps: InputProps;
    variant?: 'default' | 'filled';
}

/**
 * 032 Music Server has no username/password login: an API token authorises
 * library calls and a separate media token authorises stream/artwork URLs
 * (MPV cannot send headers). Both come from /admin/settings/security.
 */
export const Music032CredentialFields = ({
    apiTokenProps,
    keepExistingHint,
    mediaTokenProps,
    variant,
}: Music032CredentialFieldsProps) => {
    const { t } = useTranslation();
    const keepHint = keepExistingHint
        ? ` ${t('form.addServer.input', { context: 'music032KeepExisting' })}`
        : '';

    return (
        <>
            <PasswordInput
                data-autofocus
                description={`${t('form.addServer.input', { context: 'music032ApiTokenDescription' })}${keepHint}`}
                label={t('form.addServer.input', { context: 'music032ApiToken' })}
                required={!keepExistingHint}
                variant={variant}
                {...apiTokenProps}
            />
            <PasswordInput
                description={`${t('form.addServer.input', { context: 'music032MediaTokenDescription' })}${keepHint}`}
                label={t('form.addServer.input', { context: 'music032MediaToken' })}
                required={!keepExistingHint}
                variant={variant}
                {...mediaTokenProps}
            />
        </>
    );
};
