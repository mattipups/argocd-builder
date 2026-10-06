# Argo CD Builder

Browser-basierter Manifest-Generator für Argo CD Applications, ApplicationSets, Projects und Repositories.

## Projektstruktur

```
argocd-builder/
├── .github/
│   └── workflows/
│       ├── ci.yml                 # Linting & Build-Test
│       └── release.yml            # Erzeugt Single-File-Release
├── assets/
│   ├── favicon-light.png          # App-Favicon (Light Mode)
│   ├── favicon-dark.png           # App-Favicon (Dark Mode)
│   └── apple-touch-icon.png       # Touch Icon
├── src/
│   ├── index.html                 # HTML-Formulargerüst
│   ├── styles/
│   │   ├── main.css               # Basisstile & Themes
│   │   ├── layout.css             # Pane-Split & Scroll-Verhalten
│   │   ├── i18n.css               # Sprachumschalter-Stile
│   │   ├── tooltips.css           # Tooltips & Barrierefreiheit
│   │   └── card-operations.css    # Card Action Buttons
│   └── js/
│       ├── vendor/
│       │   └── yaml.min.js        # Standalone YAML-Parser/Stringifier
│       ├── core/
│       │   └── builder-app.js     # Formular-Logik & Manifest-Erzeugung
│       └── modules/
│           ├── i18n.js            # Mehrsprachigkeit (DE/EN)
│           └── git-push.js        # Git-Push-Integration
├── tests/
│   └── unit/
│       └── build.test.js          # Unit-Test für Build-Validierung
├── build.js                       # Bundler (generiert standalone HTML)
├── package.json
└── README.md
```

## Lokale Entwicklung

Die Anwendung kann direkt aus dem Quellverzeichnis entwickelt werden:
- `src/index.html` direkt im Browser öffnen oder über einen lokalen HTTP-Server (`npx serve src`).

## Standalone Build erstellen

Um die monolithische, offline-fähige Single-File-HTML-Datei zu erzeugen:

```bash
npm run build
```

Das fertige Artefakt liegt anschließend in `dist/argocd-builder.html`.
