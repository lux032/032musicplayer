import overridesCss from '../music032/music032_overrides.css?inline';

import { AppThemeConfiguration } from '/@/shared/themes/app-theme-types';
import { music032TokensCss } from '/@/shared/themes/music032/music032-tokens';

// 032 web UI, light theme. Values mirror 032music-server tokens.css `:root`.
export const music032Light: AppThemeConfiguration = {
    app: {
        'overlay-header': 'linear-gradient(rgb(250 250 250 / 45%) 0%, rgb(250 250 250 / 85%))',
        'overlay-subheader':
            'linear-gradient(180deg, rgb(250 250 250 / 5%) 0%, var(--theme-colors-background))',
        'scrollbar-handle-active-background': 'rgb(17 17 19 / 40%)',
        'scrollbar-handle-background': 'rgb(17 17 19 / 16%)',
        'scrollbar-handle-border-radius': '999px',
        'scrollbar-handle-hover-background': 'rgb(17 17 19 / 28%)',
    },
    colors: {
        background: '#fafafa',
        'background-alternate': '#fafafa',
        black: '#111113',
        foreground: '#111113',
        'foreground-muted': '#64646e',
        primary: '#5b47e0',
        'state-error': '#c42b44',
        'state-info': '#5b47e0',
        'state-success': '#0e7651',
        'state-warning': '#9a5b00',
        surface: '#efeff2',
        'surface-foreground': '#111113',
        white: '#ffffff',
    },
    mantineOverride: {
        // generateColors('#5b47e0') keeps the input at index 4.
        primaryShade: { dark: 4, light: 4 },
        radius: { lg: '14px', md: '8px', sm: '6px', xl: '20px', xs: '4px' },
    },
    mode: 'light',
    stylesheets: [
        music032TokensCss({
            'accent-hover': '#4a37c9',
            'accent-soft': 'rgb(91 71 224 / 9%)',
            'accent-soft-strong': 'rgb(91 71 224 / 16%)',
            fill: '#efeff2',
            'fill-hover': '#e4e4e9',
            line: '#e6e6ea',
            'line-strong': '#d4d4da',
            'on-accent': '#ffffff',
            panel: '#ffffff',
            'shadow-card': '0 2px 6px rgb(17 17 19 / 10%)',
            'shadow-pop': '0 14px 40px rgb(17 17 19 / 16%)',
            surface: '#ffffff',
            'surface-hover': '#f0f0f2',
            'text-secondary': '#4f4f59',
        }),
        overridesCss,
    ],
};
