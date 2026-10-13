import overridesCss from '../music032/music032_overrides.css?inline';

import { AppThemeConfiguration } from '/@/shared/themes/app-theme-types';
import { music032TokensCss } from '/@/shared/themes/music032/music032-tokens';

// 032 web UI, dark theme. Values mirror 032music-server tokens.css
// `:root[data-theme="dark"]`.
export const music032Dark: AppThemeConfiguration = {
    app: {
        'overlay-header': 'linear-gradient(transparent 0%, rgb(17 17 19 / 85%) 100%)',
        'overlay-subheader':
            'linear-gradient(180deg, rgb(17 17 19 / 5%) 0%, var(--theme-colors-background) 100%)',
        'scrollbar-handle-active-background': 'rgb(244 244 246 / 36%)',
        'scrollbar-handle-background': 'rgb(244 244 246 / 14%)',
        'scrollbar-handle-border-radius': '999px',
        'scrollbar-handle-hover-background': 'rgb(244 244 246 / 24%)',
    },
    colors: {
        background: '#111113',
        'background-alternate': '#111113',
        black: '#000000',
        foreground: '#f4f4f6',
        'foreground-muted': '#9a9aa5',
        primary: '#8d7dff',
        'state-error': '#ff6f83',
        'state-info': '#8d7dff',
        'state-success': '#45d39a',
        'state-warning': '#f2b84b',
        surface: '#232327',
        'surface-foreground': '#f4f4f6',
        white: '#ffffff',
    },
    mantineOverride: {
        // Neutral dark scale from the web tokens instead of Feishin's gray one.
        colors: {
            dark: [
                '#f4f4f6',
                '#b8b8c2',
                '#9a9aa5',
                '#6e6e78',
                '#3a3a41',
                '#2e2e33',
                '#232327',
                '#19191c',
                '#161619',
                '#111113',
            ],
        },
        // generateColors('#8d7dff') keeps the input at index 3.
        primaryShade: { dark: 3, light: 3 },
        radius: { lg: '14px', md: '8px', sm: '6px', xl: '20px', xs: '4px' },
    },
    mode: 'dark',
    stylesheets: [
        music032TokensCss({
            'accent-hover': '#a194ff',
            'accent-soft': 'rgb(141 125 255 / 14%)',
            'accent-soft-strong': 'rgb(141 125 255 / 24%)',
            fill: '#232327',
            'fill-hover': '#2e2e33',
            line: '#2a2a2f',
            'line-strong': '#3a3a41',
            // Dark text on the light violet, as the web does (white is ~3:1).
            'on-accent': '#140f33',
            panel: '#18181b',
            'shadow-card': '0 2px 6px rgb(0 0 0 / 40%)',
            'shadow-pop': '0 14px 40px rgb(0 0 0 / 55%)',
            surface: '#19191c',
            'surface-hover': '#242428',
            'text-secondary': '#b8b8c2',
        }),
        overridesCss,
    ],
};
