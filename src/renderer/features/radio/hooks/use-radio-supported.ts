import { useCurrentServer } from '/@/renderer/store';
import { hasFeature } from '/@/shared/api/utils';
import { ServerType } from '/@/shared/types/domain-types';
import { ServerFeature } from '/@/shared/types/features-types';

/**
 * Internet radio availability. Only MUSIC032 is feature-gated (it does not
 * declare INTERNET_RADIO unless the backend adds radio support); every other
 * server type keeps the upstream behavior, whether or not its feature list
 * has been populated yet.
 */
export const useInternetRadioSupported = (): boolean => {
    const server = useCurrentServer();
    if (!server) return false;
    if (server.type === ServerType.MUSIC032) {
        return hasFeature(server, ServerFeature.INTERNET_RADIO);
    }
    return true;
};
