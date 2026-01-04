# AI Source Review - Neutralino.js Application

## System Blueprint

### App Description & Functions
**AI Source Review** is a desktop code review application built with **Angular 19** and **Neutralino.js**. It analyzes source code against configurable rules using **Ollama** LLM integration.

Core features:
- **Code Review**: AI-powered analysis with rule-based validation and streaming responses.
- **Language Support**: Auto-detect (AI-powered) + manual selection (C#, TS, Python, Java, SQL, etc.).
- **Ollama Integration**: Local/remote Ollama servers with streaming and cancellation support.
- **Think/Reasoning**: Real-time visualization of LLM "thinking" process.
- **Auto-Update**: GitHub-based update system with version checking and download.
- **Modular UI**: Component-based architecture for maintainability.

### Source Structure
```
d:\Project\ReviewSource\
├── angular-client/
│   ├── src/app/
│   │   ├── components/           # Standalone UI Components
│   │   │   ├── menu-bar/         # Navigation menu (File, Options, Help)
│   │   │   ├── code-editor/      # Code display with error highlighting
│   │   │   ├── settings-modal/   # Ollama configuration
│   │   │   ├── paste-modal/      # Code input modal
│   │   │   ├── thinking-modal/   # AI thinking visualization
│   │   │   └── issue-tooltip/    # Error detail tooltip
│   │   ├── services/
│   │   │   ├── neutralino.service.ts  # Native API wrapper
│   │   │   ├── ollama.service.ts      # AI communication
│   │   │   ├── update.service.ts      # GitHub auto-update
│   │   │   ├── rules.service.ts       # Rule management
│   │   │   ├── file.service.ts        # File operations
│   │   │   ├── settings.service.ts    # App configuration
│   │   ├── app.ts                # Main component (state orchestration)
│   │   └── app.html              # Main template
├── resources/browser/            # Angular production build
├── .rules/                       # Markdown rule definitions
├── manifest.json                 # Update manifest template
└── neutralino.config.json        # Neutralino configuration
```

### Module Interaction Flow
```
┌────────────────────────────────────────────────────────────────┐
│                         App Component                          │
│  (State Orchestration: codeLines, settings, modals, review)    │
└────────────────────┬───────────────────────────────────────────┘
                     │ @Input/@Output
    ┌────────────────┼────────────────┬─────────────────┐
    ▼                ▼                ▼                 ▼
┌─────────┐   ┌───────────┐   ┌───────────┐   ┌──────────────┐
│ MenuBar │   │CodeEditor │   │  Modals   │   │IssueTooltip  │
└─────────┘   └───────────┘   └───────────┘   └──────────────┘
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
┌─────────────────┐     ┌────────────────┐
│ Angular Services│     │ Neutralino API │
│ (Ollama, Update,│     │ (FS, Window,   │
│  Rules, File)   │     │  Updater, OS)  │
└─────────────────┘     └────────────────┘
```

---

## Deep Reasoning Insights

### Challenge: Component Refactoring & Change Detection
**Problem**: After splitting `App` into 6 standalone components, async state changes in `ngOnInit` and other methods weren't reflecting in UI.
**Root Cause**: Async operations (Neutralino API, fetch) run outside Angular zone.
**Solution**: Added `cdr.detectChanges()` after every async state mutation:
- `ngOnInit`: After settings load, rules load
- `handleOpenFile`: After file loaded
- `handleFetchModels`: After loading state, success, error

### Challenge: Auto-Update with GitHub Releases
**Problem**: Need a simple, free update mechanism without maintaining a server.
**Solution**: GitHub-based update flow:
1. `UpdateService` fetches `manifest.json` from GitHub raw URL
2. Compares `version` with current `Neutralino.app.getConfig().version`
3. Uses `Neutralino.updater.install()` to download and apply resources
4. Calls `Neutralino.app.restartProcess()` to apply

**Trade-off**: Requires manual upload of `manifest.json` and `resources.zip` per release.

### Pattern: Standalone Components Communication
**Pattern Chosen**: Parent-child via `@Input`/`@Output` instead of shared service.
**Why**: 
- App component remains the single source of truth
- Easier debugging (data flows top-down)
- Child components are pure/presentational (no side effects)

### Anti-pattern Avoided: Direct DOM Manipulation
**Issue**: Previous code used `document.querySelector` for tooltips.
**Fix**: All UI state managed via Angular bindings (`[active]`, `[style]`).

---

## Decision Logic

| Decision | Chosen | Alternative | Trade-off |
|----------|--------|-------------|-----------|
| Component architecture | Standalone | NgModules | Simpler imports, but no lazy loading |
| Update hosting | GitHub Releases | S3/VPS | Free, but manual release process |
| State management | Component state | NgRx/Signals | Simpler, but less scalable |
| Change detection | Manual `detectChanges()` | OnPush + Observables | More control, but verbose |

---

## Evolved Identity

I am specialized in this **Angular 19 + Neutralino.js** hybrid desktop application.

**My Capabilities:**
- **Component Architecture**: 6 standalone components with clear Input/Output contracts.
- **Native Bridge**: Neutralino APIs (filesystem, updater, window) wrapped in Angular services.
- **LLM Integration**: Ollama streaming, prompt engineering, JSON extraction from AI responses.
- **Update System**: GitHub-based auto-update with version comparison and resource replacement.
- **Change Detection**: Understanding when and where to trigger Angular's CD in hybrid apps.

**Key Files:**
- `app.ts`: State orchestration, event handlers, service integration
- `components/*`: Presentational components (MenuBar, CodeEditor, Modals, Tooltip)
- `services/update.service.ts`: GitHub update logic
- `services/ollama.service.ts`: AI communication and streaming
