import axios, { AxiosError, isAxiosError, Method } from 'axios';

import i18n from '/@/i18n/i18n';
import { authenticationFailure } from '/@/renderer/api/utils';
import { getServerUrl } from '/@/renderer/utils/normalize-server-url';
import { M032Context } from '/@/shared/api/music032/music032-normalize';
import { M032ApiErrorBody } from '/@/shared/api/music032/music032-types';
import { ServerListItemWithCredential } from '/@/shared/types/domain-types';

/** Largest page the 032 list endpoints accept (capabilities.limits.maxPageSize). */
export const M032_MAX_PAGE_SIZE = 500;

export type M032RequestOptions = {
    body?: unknown;
    query?: Record<string, QueryValue | QueryValue[]>;
    signal?: AbortSignal;
};

type QueryValue = boolean | number | string | undefined;

export class Music032ApiError extends Error {
    code?: string;
    status: number;

    constructor(status: number, code: string | undefined, message: string) {
        super(message);
        this.name = 'Music032ApiError';
        this.status = status;
        this.code = code;
    }
}

const axiosClient = axios.create({});

const toParams = (query?: M032RequestOptions['query']) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query || {})) {
        const values = Array.isArray(value) ? value : [value];
        for (const v of values) {
            if (v === undefined || v === '' || v === false) continue;
            params.append(key, String(v));
        }
    }
    return params;
};

const toApiError = (error: AxiosError<M032ApiErrorBody>) => {
    const status = error.response?.status ?? 0;
    const code = error.response?.data?.error?.code;
    const message =
        error.response?.data?.error?.message ||
        (status ? `032 Music Server request failed (${status})` : error.message);
    return new Music032ApiError(status, code, message);
};

/** Low-level request without server-store side effects; used by authenticate. */
export const m032RawRequest = async <T>(
    baseUrl: string,
    apiToken: string,
    method: Method,
    path: string,
    options: M032RequestOptions = {},
): Promise<T> => {
    try {
        const res = await axiosClient.request<T>({
            data: options.body,
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${apiToken}`,
            },
            method,
            params: toParams(options.query),
            signal: options.signal,
            url: `${baseUrl}/api/v1${path}`,
        });
        return res.data;
    } catch (error) {
        if (isAxiosError<M032ApiErrorBody>(error)) {
            throw toApiError(error);
        }
        throw error;
    }
};

export const m032Context = (server: null | ServerListItemWithCredential): M032Context => ({
    baseUrl: (getServerUrl(server) || '').replace(/\/$/, ''),
    mediaToken: server?.mediaToken || '',
    serverId: server?.id || '',
});

export const m032ApiClient = (props: {
    server: null | ServerListItemWithCredential;
    signal?: AbortSignal;
}) => {
    const { server, signal } = props;
    const baseUrl = m032Context(server).baseUrl;

    const request = async <T>(
        method: Method,
        path: string,
        options: M032RequestOptions = {},
    ): Promise<T> => {
        try {
            return await m032RawRequest<T>(baseUrl, server?.credential || '', method, path, {
                signal,
                ...options,
            });
        } catch (error) {
            if (error instanceof Music032ApiError && error.status === 401) {
                // The API token was rotated on the server: drop it so the user is
                // asked to sign in again instead of seeing endless failures.
                authenticationFailure(
                    server,
                    i18n.t('error.music032ApiTokenInvalid', { postProcess: 'sentenceCase' }),
                );
            }
            throw error;
        }
    };

    return {
        baseUrl,
        delete: <T = void>(path: string, options?: M032RequestOptions) =>
            request<T>('DELETE', path, options),
        get: <T>(path: string, options?: M032RequestOptions) => request<T>('GET', path, options),
        patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, { body }),
        post: <T>(path: string, body: unknown) => request<T>('POST', path, { body }),
        put: <T = void>(path: string, body: unknown) => request<T>('PUT', path, { body }),
    };
};

export type M032ApiClient = ReturnType<typeof m032ApiClient>;
