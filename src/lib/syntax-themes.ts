export interface SyntaxTheme {
  id: string
  label: string
  /** "dark" themes get a dark code surface, "light" a light one */
  base: "dark" | "light"
  colors: {
    bg: string
    fg: string
    gutter: string
    key: string
    string: string
    number: string
    boolean: string
    null: string
    comment: string
    keyword: string
    func: string
    attr: string
    punctuation: string
    match: string
  }
}

export const SYNTAX_THEMES: SyntaxTheme[] = [
  {
    id: "vscode-dark",
    label: "VS Code Dark+",
    base: "dark",
    colors: {
      bg: "#1e1e1e",
      fg: "#d4d4d4",
      gutter: "#858585",
      key: "#9cdcfe",
      string: "#ce9178",
      number: "#b5cea8",
      boolean: "#569cd6",
      null: "#569cd6",
      comment: "#6a9955",
      keyword: "#c586c0",
      func: "#dcdcaa",
      attr: "#9cdcfe",
      punctuation: "#808080",
      match: "#613214",
    },
  },
  {
    id: "vscode-light",
    label: "VS Code Light+",
    base: "light",
    colors: {
      bg: "#ffffff",
      fg: "#1f1f1f",
      gutter: "#999999",
      key: "#0451a5",
      string: "#a31515",
      number: "#098658",
      boolean: "#0000ff",
      null: "#0000ff",
      comment: "#008000",
      keyword: "#af00db",
      func: "#795e26",
      attr: "#0451a5",
      punctuation: "#7a7a7a",
      match: "#ffe9a8",
    },
  },
  {
    id: "github-dark",
    label: "GitHub Dark",
    base: "dark",
    colors: {
      bg: "#0d1117",
      fg: "#e6edf3",
      gutter: "#6e7681",
      key: "#79c0ff",
      string: "#a5d6ff",
      number: "#79c0ff",
      boolean: "#79c0ff",
      null: "#ff7b72",
      comment: "#8b949e",
      keyword: "#ff7b72",
      func: "#d2a8ff",
      attr: "#7ee787",
      punctuation: "#8b949e",
      match: "#3b2e0a",
    },
  },
  {
    id: "github-light",
    label: "GitHub Light",
    base: "light",
    colors: {
      bg: "#ffffff",
      fg: "#1f2328",
      gutter: "#8c959f",
      key: "#0550ae",
      string: "#0a3069",
      number: "#0550ae",
      boolean: "#0550ae",
      null: "#cf222e",
      comment: "#6e7781",
      keyword: "#cf222e",
      func: "#8250df",
      attr: "#116329",
      punctuation: "#6e7781",
      match: "#fff8c5",
    },
  },
  {
    id: "monokai",
    label: "Monokai",
    base: "dark",
    colors: {
      bg: "#272822",
      fg: "#f8f8f2",
      gutter: "#90908a",
      key: "#a6e22e",
      string: "#e6db74",
      number: "#ae81ff",
      boolean: "#ae81ff",
      null: "#ae81ff",
      comment: "#75715e",
      keyword: "#f92672",
      func: "#a6e22e",
      attr: "#66d9ef",
      punctuation: "#f8f8f2",
      match: "#49483e",
    },
  },
  {
    id: "dracula",
    label: "Dracula",
    base: "dark",
    colors: {
      bg: "#282a36",
      fg: "#f8f8f2",
      gutter: "#6272a4",
      key: "#8be9fd",
      string: "#f1fa8c",
      number: "#bd93f9",
      boolean: "#bd93f9",
      null: "#bd93f9",
      comment: "#6272a4",
      keyword: "#ff79c6",
      func: "#50fa7b",
      attr: "#50fa7b",
      punctuation: "#f8f8f2",
      match: "#44475a",
    },
  },
  {
    id: "nord",
    label: "Nord",
    base: "dark",
    colors: {
      bg: "#2e3440",
      fg: "#d8dee9",
      gutter: "#616e88",
      key: "#8fbcbb",
      string: "#a3be8c",
      number: "#b48ead",
      boolean: "#81a1c1",
      null: "#81a1c1",
      comment: "#616e88",
      keyword: "#81a1c1",
      func: "#88c0d0",
      attr: "#8fbcbb",
      punctuation: "#eceff4",
      match: "#434c5e",
    },
  },
  {
    id: "solarized-light",
    label: "Solarized Light",
    base: "light",
    colors: {
      bg: "#fdf6e3",
      fg: "#586e75",
      gutter: "#93a1a1",
      key: "#268bd2",
      string: "#2aa198",
      number: "#d33682",
      boolean: "#6c71c4",
      null: "#6c71c4",
      comment: "#93a1a1",
      keyword: "#859900",
      func: "#b58900",
      attr: "#268bd2",
      punctuation: "#657b83",
      match: "#eee8d5",
    },
  },
]

export const DEFAULT_SYNTAX_THEME = "vscode-dark"

export function getSyntaxTheme(id: string): SyntaxTheme {
  return SYNTAX_THEMES.find((t) => t.id === id) ?? SYNTAX_THEMES[0]
}

/** Returns CSS custom properties for a theme, to be spread onto a container's style. */
export function syntaxThemeVars(theme: SyntaxTheme): Record<string, string> {
  const c = theme.colors
  return {
    "--syn-bg": c.bg,
    "--syn-fg": c.fg,
    "--syn-gutter": c.gutter,
    "--syn-key": c.key,
    "--syn-string": c.string,
    "--syn-number": c.number,
    "--syn-boolean": c.boolean,
    "--syn-null": c.null,
    "--syn-comment": c.comment,
    "--syn-keyword": c.keyword,
    "--syn-func": c.func,
    "--syn-attr": c.attr,
    "--syn-punctuation": c.punctuation,
    "--syn-match": c.match,
  }
}
