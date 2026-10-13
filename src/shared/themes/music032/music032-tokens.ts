// Extra tokens from the 032 web UI (032music-server internal/http/assets/tokens.css)
// that have no slot in AppThemeConfiguration.colors. They are emitted as
// `--m032-*` custom properties and consumed by music032_overrides.css.
export interface Music032Tokens {
    'accent-hover': string;
    'accent-soft': string;
    'accent-soft-strong': string;
    fill: string;
    'fill-hover': string;
    line: string;
    'line-strong': string;
    'on-accent': string;
    panel: string;
    'shadow-card': string;
    'shadow-pop': string;
    surface: string;
    'surface-hover': string;
    'text-secondary': string;
}

export const music032TokensCss = (tokens: Music032Tokens) =>
    `:root {\n${Object.entries(tokens)
        .map(([key, value]) => `  --m032-${key}: ${value};`)
        .join('\n')}\n}`;
