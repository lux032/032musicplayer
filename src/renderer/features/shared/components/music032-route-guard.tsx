import { ReactNode } from 'react';
import { Navigate } from 'react-router';

import { AppRoute } from '/@/renderer/router/routes';
import { useCurrentServer } from '/@/renderer/store';
import { ServerType } from '/@/shared/types/domain-types';

/** 作品/系列页只对 MUSIC032 服务端开放；其他服务端直接访问时回主页。 */
export const Music032RouteGuard = ({ children }: { children: ReactNode }) => {
    const server = useCurrentServer();
    if (server?.type !== ServerType.MUSIC032) return <Navigate replace to={AppRoute.HOME} />;
    return <>{children}</>;
};
