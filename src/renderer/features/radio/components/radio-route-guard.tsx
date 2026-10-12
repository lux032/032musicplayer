import { ReactNode } from 'react';
import { Navigate } from 'react-router';

import { useInternetRadioSupported } from '/@/renderer/features/radio/hooks/use-radio-supported';
import { AppRoute } from '/@/renderer/router/routes';

/** Direct /radio access on servers without internet radio (e.g. MUSIC032) goes home. */
export const RadioRouteGuard = ({ children }: { children: ReactNode }) => {
    const supported = useInternetRadioSupported();
    if (!supported) return <Navigate replace to={AppRoute.HOME} />;
    return <>{children}</>;
};
