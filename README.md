# Argo CD Builder

Browser-basierter Manifest-Generator für Argo CD Applications, ApplicationSets, Projects und Repositories.

## Projektstruktur

```text
argocd-builder/
├── .github/
│   └── workflows/
│       ├── ci.yml                     # Automatische Build-Verifikation
│       └── release.yml                # Standalone-Release-Asset-Erstellung
├── assets/
│   ├── favicon-light.png              # Favicon (Light Theme)
│   ├── favicon-dark.png               # Favicon (Dark Theme)
│   └── apple-touch-icon.png           # Touch Icon
├── src/
│   ├── index.html                     # HTML-Formulargerüst
│   ├── styles/
│   │   ├── main.css                   # Hauptstile & Farbschema
│   │   ├── i18n.css                   # Stile für Lokalisierung
│   │   ├── light-tooltip-fix.css      # Tooltip-Farbanpassungen
│   │   ├── independent-pane-scroll.css# Unabhängiges Scrollen Form/YAML
│   │   ├── tooltip-accessibility.css  # Barrierefreie Tooltips
│   │   └── card-operations.css        # Card-Action-Buttons
│   └── js/
│       ├── vendor/
│       │   └── yaml.min.js            # YAML-Parser & Stringifier
│       ├── core/
│       │   └── builder-app.js         # Anwendungslogik & Manifest-Erzeugung
│       └── modules/
│           ├── i18n.js                # Lokalisierung (DE / EN)
│           └── git-push.js            # Git-Push-Integration
├── tests/
│   └── unit/
│       └── build.test.js              # Unit-Test zur Integritätsprüfung
├── build.js                           # Node.js-Buildskript (generiert 1:1 die Single-File HTML)
├── package.json
└── README.md
```

## Lokale Entwicklung

Die Quelltexte in `src/` können modular bearbeitet werden. Zur Vorschau kann `src/index.html` direkt im Browser oder über einen lokalen HTTP-Server geöffnet werden.

## Build

Erzeugt die exakte, offline-fähige Single-File-HTML-Datei `dist/argocd-builder-v2.3.7.html`:

```bash
npm run build
```

## Testen

```bash
npm test
```
