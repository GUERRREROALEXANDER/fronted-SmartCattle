# SmartCattle Frontend

Web interface for **SmartCattle**, a platform that monitors cattle farms with cameras and computer vision. Farm owners and workers use it to see what is happening on the farm, receive alerts when an animal leaves its safe zone or a person appears where they should not, and review what happened afterwards.

This repository contains only the frontend. The REST API lives in the separate `SmartCattle-Backend` repository (Python, FastAPI), and detection (OpenCV + YOLO) belongs to `SmartCattle-AI`.

> **Status:** Phases 1–9 are complete, plus a realistic 3D pasture, a video analyzer with simulated detection, an analytics page and the **Dashboard V15** redesign (glass panels and motion across the app). The final quality pass remains. See [Roadmap](#roadmap).

![Home dashboard with live metrics, the live herd monitor and the cattle summary](docs/screenshots/dashboard-desktop.png)

| Login (desktop) | Login (mobile) |
|---|---|
| ![Login with the dusk pasture photo and a glass form card](docs/screenshots/login-desktop.png) | ![Login screen on mobile](docs/screenshots/login-mobile.png) |

| Home on a phone | Mobile "Más" sheet |
|---|---|
| ![Home dashboard on a phone](docs/screenshots/dashboard-mobile.png) | ![Mobile tab bar and the glass "Más" sheet](docs/screenshots/app-shell-mobile-more.png) |

---

## Contents

- [Technology stack](#technology-stack)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Architecture](#architecture)
- [Backend connection](#backend-connection)
- [Data sources and mock data](#data-sources-and-mock-data)
- [Authentication](#authentication)
- [Routing and navigation](#routing-and-navigation)
- [Dashboard](#dashboard)
- [Live monitoring](#live-monitoring)
- [3D pasture](#3d-pasture)
- [Videos](#videos)
- [Analytics](#analytics)
- [Motion](#motion)
- [Design system](#design-system)
- [Accessibility](#accessibility)
- [Testing and quality checks](#testing-and-quality-checks)
- [Implemented features](#implemented-features)
- [Roadmap](#roadmap)
- [Credits](#credits)

---

## Technology stack

| Area | Choice | Why |
|---|---|---|
| UI | React 19 | Component model, large ecosystem |
| Language | TypeScript 6 (strict) | Typed API contracts and safer refactors |
| Build tool | Vite 8 | Fast dev server, CSS Modules out of the box |
| Routing | React Router 8 | Data router with nested layout routes |
| Styling | Plain CSS: CSS Modules + custom properties | No framework lock-in, tokens in one file, glass recipe built from tokens |
| Icons | lucide-react | Consistent stroke icons, tree-shaken |
| 3D | three.js + @react-three/fiber + @react-three/drei | Declarative 3D scene in React, orbit controls, HTML labels, glTF loading |
| Motion | motion (`motion/react`, the successor of framer-motion) | Page transitions, layout animations, shared-element indicators, springs, reduced-motion hook |
| Charts | Recharts | Composable SVG charts that read colors from CSS tokens |
| Font | Archivo Variable (self-hosted via Fontsource) | One family with a width axis for hierarchy |
| Tests | Vitest | Same config as Vite, fast |
| Lint | ESLint 10 + typescript-eslint | Flat config |

No UI kit, CSS framework or state library is used. The 3D pasture, videos and analytics pages are lazy-loaded, so three.js and Recharts are only downloaded when those pages open.

## Getting started

Requirements: Node.js 22.22+ (required by React Router 8; declared in `engines`) and npm. Tested with Node 26.8.1.

```sh
npm install
cp .env.example .env   # PowerShell: Copy-Item .env.example .env
npm run dev            # http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server with hot reload |
| `npm run build` | Type-check (`tsc -b`) and build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Vitest suite once |

In development, a component gallery is available at `/dev/ui`. It is excluded from production builds.

## Environment variables

Copy `.env.example` to `.env`. Never commit `.env`.

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Base URL of the SmartCattle FastAPI backend. Trailing slashes are removed. |
| `VITE_DATA_SOURCE` | `mock` (`.env.example` uses `hybrid`) | `api`, `mock` or `hybrid`. See [Data sources](#data-sources-and-mock-data). A missing or invalid value falls back to `mock`, which never contacts the backend. |

The frontend holds no secrets. Do not put API keys in `VITE_*` variables: they are embedded in the client bundle. `AI_API_KEY` belongs only to the backend and the AI service.

For production, change only `VITE_API_BASE_URL` (for example `https://your-backend-domain.example`) and add the frontend origin to the backend's `ALLOWED_ORIGINS`. Vite reads these values at build time, so rebuild after changing them.

---

## Architecture

### System context

```mermaid
flowchart LR
    user["Farm owner / worker<br/>(browser, phone or desktop)"]
    fe["SmartCattle Frontend<br/>React + Vite (this repo)"]
    be["SmartCattle Backend<br/>FastAPI + PostgreSQL"]
    ai["SmartCattle AI<br/>OpenCV + YOLO"]
    cam["Farm cameras"]

    user --> fe
    fe -- "REST / JSON" --> be
    ai -- "POST /api/ai/events" --> be
    cam --> ai
```

The frontend reads from the backend and only writes video analysis summaries. It never calls the AI service directly and never posts AI events.

### Frontend layers

UI components never call `fetch`. Every request goes through one HTTP client and a typed service layer, and every screen receives data together with its origin (`api`, `mock` or `unavailable`).

```mermaid
flowchart TB
    subgraph UI["UI layer"]
        pages["features/*<br/>pages per section"]
        layout["components/layout<br/>AppShell, SideRail, MobileTabBar"]
        ui["components/ui<br/>Button, TextField, StatusPill, Notice..."]
    end
    subgraph App["App layer"]
        router["app/router.tsx<br/>routes + guards"]
        auth["app/auth<br/>AuthProvider, RequireAuth"]
    end
    subgraph Domain["Domain layer"]
        services["services/*<br/>status, events, animals,<br/>cameras, detections, farm, auth"]
        mappers["services/mappers.ts<br/>API → view models"]
        resolve["services/dataSource.ts<br/>api / mock / unavailable"]
        catalog["lib/eventCatalog.ts<br/>labels + default severity"]
    end
    subgraph Data["Data layer"]
        client["api/httpClient.ts<br/>timeout + typed errors"]
        mocks["mocks/*<br/>labeled demo data"]
        types["types/api.ts<br/>mirror of FastAPI schemas"]
    end

    pages --> services
    layout --> auth
    router --> auth
    auth --> services
    services --> resolve
    services --> mappers
    mappers --> catalog
    services --> client
    services --> mocks
    client --> types
```

### Folder structure

```text
src/
  api/          HTTP client, configuration, typed errors
  app/          App root, router, navigation config, auth context and guards
  assets/       Images (login photo, with embedded provenance)
  components/
    layout/     AppShell, SideRail, TopBar, MobileTabBar, MoreSheet, AlarmBanner
    ui/         Reusable UI primitives (GlassCard, BrandMark, Button, TextField, StatusPill, ...)
  features/     One folder per section (auth, dashboard, monitoring, events, videos, pasture3d, ...)
  lib/          Pure helpers: event catalog, permissions, safe storage, zone alarm
  motion/       Motion presets and primitives: FadeUp, Reveal, StaggerItem, CountUp,
                AnimatedNumber, DeltaChip, PulseRing, MaskedText
  mocks/        The only place with fictional data (clearly labeled)
  services/     Data access per capability, mappers, source resolution
  styles/       Design tokens, base styles, reduced-motion rules
  types/        API contract mirror, domain view models, auth types
public/
  models/       glTF models for the 3D pasture (cow.glb) and their credits
docs/
  screenshots/  Images used in this README
```

Tests live next to the code they cover (`*.test.ts`).

---

## Backend connection

The backend (`SmartCattle-Backend`) is a FastAPI service backed by PostgreSQL (SQLAlchemy + Alembic). These are the endpoints that exist today:

| Method | Path | Response | Used for |
|---|---|---|---|
| GET | `/health` | `{ "status": "ok" }` | Backend online/offline indicator |
| GET | `/api/status` | `version`, `ai_service.configured`, `storage` | System status. `configured` means an AI URL is set, **not** that the AI is online. |
| GET | `/api/animals` | `{ items, total }` | Registered cattle count |
| GET | `/api/events` | Latest 1000 events, newest first | Alerts and history |
| GET | `/api/cameras` | `{ items, total }` | Camera list and status |
| POST | `/api/videos/analyses` | Saved analysis | Stores the summary of a finished video analysis |
| GET | `/api/videos/analyses`, `/api/videos/analyses/{id}` | Analyses list / one analysis | Analysis history |
| GET | `/api/metrics/summary` | Aggregated counts | Metrics summary |
| POST | `/api/ai/events`, PUT `/api/ai/cameras/{id}/status` | — | AI service only (API key). **The frontend never calls them.** |

Event shape (mirrored in `src/types/api.ts`):

```json
{
  "id": "uuid",
  "event_type": "cattle_out_of_zone",
  "camera_id": "camera-01",
  "detected_object": "cow",
  "confidence": 0.95,
  "timestamp": "2026-10-03T15:30:00Z",
  "received_at": "2026-10-03T15:30:01Z"
}
```

The backend's CORS policy allows `GET` and `POST`, the headers `Content-Type` and `X-API-Key`, and no credentials. Real authentication will need a CORS change on the backend (an `Authorization` header or credentials).

### What the backend does not provide yet

The frontend never invents endpoints. Until these capabilities exist, the UI uses labeled demo data or shows that the capability is unavailable:

- Authentication, sessions, users, roles, farms and worker invitations
- Video streaming, per-frame detections and video uploads (analyses store only their summary)
- Safe-zone geometry
- Person or vehicle detection, day/night security rules
- Event severity, zone, evidence and review state
- Real-time push (WebSocket/SSE) and notifications

---

## Data sources and mock data

`VITE_DATA_SOURCE` decides where each capability gets its data. Capabilities the backend supports are `backend`; the rest are `mock-only`.

```mermaid
flowchart TD
    start(["Service call"]) --> mode{"VITE_DATA_SOURCE"}
    mode -- mock --> mock["Demo data<br/>source: 'mock'"]
    mode -- hybrid --> cap1{"Backend supports it?"}
    mode -- api --> cap2{"Backend supports it?"}
    cap1 -- yes --> api["Real API<br/>source: 'api'"]
    cap1 -- no --> mock
    cap2 -- yes --> api
    cap2 -- no --> unavailable["null data<br/>source: 'unavailable'"]
```

| Capability | `mock` | `hybrid` | `api` |
|---|---|---|---|
| System status, events, registered cattle | demo | **API** | **API** |
| Cameras, detections, safe zones, detected count, farm | demo | demo | unavailable |
| Authentication | demo | demo | unavailable |

Rules:

- All fictional data lives in `src/mocks/` and starts with a `DEVELOPMENT MOCK DATA` header.
- Every service returns `{ data, source }`. When anything on screen comes from demo data, the UI shows a **"Datos de demostración"** badge.
- In `mock` mode the backend is never contacted, so the server pill reads **"Servidor: modo demostración"**, never "en línea". Only a real `/health` reply with `status: "ok"` shows the server online.
- A failed backend call is never replaced with demo data. Screens show the cause (no connection, timeout, HTTP 401/404/422/5xx or an unexpected response). If a background refresh fails, the last data stays on screen with a warning.
- Backend responses are validated in `src/api/validate.ts`. Events with an `event_type` the frontend does not know are skipped with a console warning, so one new type does not hide the rest.
- An empty `/api/animals` list is a normal state ("No hay animales registrados"), not an error.
- Demo detections are deterministic (seeded per camera) so screenshots and tests are stable.
- Event kinds that the backend does not emit yet (`person_detected`, `possible_intrusion`, ...) exist only in demo data.

### Event language

`src/lib/eventCatalog.ts` maps each event kind to a Spanish label, a category and a default severity. Object detection cannot know intent, so the UI never says "thief" or "robbery":

| Kind | Label (UI) | Category | Default severity |
|---|---|---|---|
| `cattle_out_of_zone` | Animal fuera de la zona segura | cattle | warning |
| `person_detected` | Persona detectada | security | info |
| `possible_intrusion` | Posible intrusión | security | critical |
| `external_animal_detected` | Animal externo detectado | cattle | warning |
| `possible_unauthorized_movement` | Posible movimiento no autorizado de ganado | security | critical |
| `camera_disconnected` | Cámara desconectada | system | warning |
| `ai_unavailable` | Servicio de visión no disponible | system | critical |

Severity from the catalog is a presentation default (`severitySource: 'catalog'`). When the backend sends severity (for example, a night-time rule), it takes precedence (`severitySource: 'backend'`).

---

## Authentication

The backend has no authentication yet, so login and registration run against a **demo service** behind the `AuthService` interface. Replacing it with a real implementation does not touch the screens.

```mermaid
sequenceDiagram
    actor U as User
    participant P as LoginPage
    participant C as AuthProvider
    participant S as AuthService (mock)
    participant L as localStorage (guarded)

    U->>P: username or email + password
    P->>P: validate fields
    P->>C: login(input)
    C->>S: login(input)
    S->>S: SHA-256 hash of password
    S->>L: read demo users
    alt credentials match
        S->>L: save session
        S-->>C: Session
        C-->>P: authenticated
        P->>U: redirect to requested page
    else wrong credentials
        S-->>C: AuthError("invalid_credentials")
        C-->>P: error
        P->>U: inline error in an aria-live region
    end
```

- **Demo accounts** (password `demo1234`): `carmen.rojas` / `dueno@sanjose.demo` (owner) and `julian.perez` / `trabajador@sanjose.demo` (worker). Sign in with the username or the email; the "Cuentas de demostración" disclosure fills them in.
- Registration asks for username, email, password and confirmation, with a live password strength meter and a caps-lock warning. It always creates an **owner**. Workers will join through an invitation from the owner, which needs backend support.
- After repeated failed attempts the form locks for a short cooldown with a visible countdown.
- "Recordarme" and "¿Olvidaste tu contraseña?" are visual only for now: the demo always keeps the session, and password recovery needs backend support (the link explains this).

| Sign up |
|---|
| ![Registration form with the password strength meter](docs/screenshots/register-desktop.png) |
- Passwords are stored as SHA-256 hashes, never in plain text. All storage access is wrapped in `try/catch` and falls back to memory.
- In `api` mode the login shows "Inicio de sesión no disponible" instead of pretending to work.
- Route guards and permissions (`src/lib/permissions.ts`) only shape the UI. **The backend must enforce access.**

| Permission | Owner | Worker |
|---|---|---|
| `monitoring:view`, `events:view`, `events:review` | yes | yes |
| `farm:edit`, `workers:manage`, `cameras:configure`, `alerts:configure`, `security-hours:configure` | yes | no |

---

## Routing and navigation

```mermaid
flowchart TB
    root(["/"]) --> pub["RedirectIfAuthenticated"]
    root --> priv["RequireAuth"]
    pub --> login["/login"]
    pub --> register["/register"]
    priv --> shell["AppShell"]
    shell --> d["/ Inicio"]
    shell --> m["/live En vivo"]
    shell --> e["/events Eventos"]
    shell --> c["/cattle Ganado"]
    shell --> pa["/pasture Potrero 3D (lazy)"]
    shell --> v["/videos Videos (lazy)"]
    shell --> an["/analytics Análisis (lazy)"]
    shell --> cam["/cameras Cámaras"]
    shell --> s["/settings Ajustes"]
    shell --> p["/profile Perfil"]
    shell --> nf["* Página no encontrada"]
```

- Anonymous visitors to a private route are redirected to `/login` and come back to the requested page after signing in.
- The navigation is defined once in `src/app/navigation.ts`.
- **Desktop (≥ 1024 px):** floating glass side rail with the nine sections, a green indicator that slides to the active page, the demo badge and the signed-in user.
- **Mobile:** glass top bar, a floating five-cell tab bar (Inicio, En vivo, Eventos, Ganado, Más) and a native `<dialog>` glass sheet for Potrero 3D, Videos, Análisis, Cámaras, Ajustes and Perfil.
- **Alarm banner:** when any part of the app raises a zone alarm (live map, 3D pasture, video analyzer), a red banner slides down with a "Silenciar" action.
- "Security" is a tab inside Events rather than a separate page: security alerts are events, and a separate page would duplicate the list and filters.

---

## Dashboard

The dashboard answers "is everything OK on the farm right now?" first, then where and what happened.

```mermaid
flowchart TB
    header["Status line<br/>San José · 1 alerta en la última hora<br/>+ server / vision / cameras status"]
    alert["Alert strip<br/>most important recent alert → Verificar cámara"]
    metrics["Real-time metrics<br/>animated counters + deltas vs session start"]
    plan["Live herd monitor<br/>animated cattle and people over the farm plan"]
    charts["Last 60 seconds + alerts per zone"]
    herd["Cattle<br/>registered vs detected now"]
    log["Field log<br/>24 h band + last 5 events"]
    header --> alert --> metrics --> plan --> charts
    metrics --> herd --> log
```

| Block | Source today | Notes |
|---|---|---|
| Server status | `GET /health`, `GET /api/status` | "Visión configurada" only means an AI URL is set |
| Events, alert strip, field log | `GET /api/events` (demo in `mock` mode) | Polled every 15 s |
| Registered cattle | `GET /api/animals` | Shows "Sin registros" while the backend list is empty |
| Detected now, cameras, farm plan, restricted hours | demo data | The plan is labeled "Esquema ilustrativo" |

Rules the dashboard follows:

- **"Active" alerts.** The backend has no review state, so the dashboard shows warning and critical events from the **last hour** and says so ("1 alerta en la última hora").
- **Never "all clear" without data.** If events fail to load or the server is offline, the headline reads **"Estado desconocido"**, not "Todo en orden".
- **Registered ≠ detected.** The two numbers are shown side by side with a note that occlusion, camera angle or lighting can lower the detected count.
- **Stale data stays visible.** A failed background refresh keeps the last data and shows the offline notice. Retries are automatic.
- **Time to scale.** The 24 h band places each event at its real time and shades the restricted hours.

| Server offline (hybrid mode) |
|---|
| ![Dashboard with the server offline](docs/screenshots/dashboard-offline-desktop.jpg) |

---

## Live monitoring

`/live?camera=<id>` shows one camera as the protagonist. Without a `camera` parameter it opens the camera with the most recent alert, so "Verificar cámara" on the dashboard lands on the evidence.

![Live monitoring with detections and safe zone](docs/screenshots/live-desktop.jpg)

The camera stage stacks independent layers over the picture. Overlay coordinates are normalized (0–1) and drawn in the picture's own pixel space, so boxes stay registered to the image at any size.

```mermaid
flowchart TB
    subgraph Stage["CameraStage (dark 16:9 viewfinder)"]
        direction TB
        bars["Top and bottom bars<br/>name, location, connection, counts, frame time"]
        labels["Labels (HTML, fixed 12 px)<br/>collision-aware placement"]
        boxes["Detection boxes (SVG)<br/>cattle solid · persons dashed · outside red + hatched"]
        zone["Safe zone (SVG)<br/>lindero polygon with vertex marks"]
        media["Picture<br/>StreamSource: image / mjpeg (hls and none show a message)"]
    end
    bars --- labels --- boxes --- zone --- media
```

| Stage state | When | What the user sees |
|---|---|---|
| Loading / connecting | Camera or stream loading, or camera reports `connecting` | Spinner and text |
| Live | `image` or `mjpeg` source | Picture with overlays, counts, layer toggles |
| No stream | Source `none` (every camera except the demo one today) | "Sin transmisión disponible" |
| Unsupported | Source `hls` (no player bundled yet) | "Formato de video no compatible" |
| Offline / error | Camera status | Message, plus last signal time when offline |
| Vision not configured | `ai_service.configured = false` | Warning notice; counts say there are no detections |
| Server offline | `/health` fails | Critical notice; data refresh retries automatically |

- **Demo picture.** No camera streams exist yet. The south pasture camera shows the illustrative dusk photo with hand-placed detections (one animal outside the zone), labeled "Imagen ilustrativa con detecciones simuladas".
- **Polygon zones.** A safe zone may carry an `outline` polygon; zone membership then uses the polygon (bottom-center of each box, the same anchor as the prototype rule) instead of the bounding box.
- **Layer toggles** (Detecciones, Zona segura, Etiquetas) only change the display. They never touch backend data.
- **Polling:** detections every 5 s, cameras, events and status every 15 s. Changing camera never shows the previous camera's data.
- **Mobile:** the camera strip scrolls horizontally and keeps the selected camera in view; persons and outside-zone labels stay, other labels hide on narrow screens to avoid clutter.

| No stream |
|---|
| ![Camera without a stream](docs/screenshots/live-nostream-desktop.jpg) |

---

## 3D pasture

`/pasture` ("Potrero 3D") shows the farm as an interactive 3D scene. The user orbits, pans and zooms around the farm, sees the herd grazing inside the fenced lots, workers walking the farm track and the cameras on their poles. When a cow leaves its lot, that lot's fence and ground turn red, a label appears over the animal and the exit is announced and logged.

![3D pasture with one lot breached](docs/screenshots/pasture-desktop.png)

<img src="docs/screenshots/pasture-mobile.png" alt="3D pasture on a phone" width="320">

The page is a **demo simulation**, labeled as such on screen. The backend has no animal positions yet, so the herd moves with a seeded simulation over the same farm plan the dashboard uses (`src/mocks/mockFarmPlan.ts`). When real detections with positions exist, the simulation can be replaced by that data without touching the scene.

```mermaid
flowchart LR
    plan["mockFarmPlan<br/>lots, cameras, track"] --> sim["simulation/herdSimulation.ts<br/>pure TS, seeded RNG"]
    sim --> hook["useHerdSimulation<br/>refs per frame, React state on change"]
    hook --> scene["scene/PastureScene<br/>Canvas, lights, OrbitControls"]
    hook --> ui["ui/ ZonePanel, ExitLog, SceneControls"]
    kit["kit/ terrain, fences, animals,<br/>people, structures, nature"] --> scene
```

- **Modular asset kit.** Every 3D asset is procedural (no model files) and lives in its own family folder, like a modular asset library: `kit/terrain`, `kit/fences`, `kit/animals`, `kit/people`, `kit/structures`, `kit/nature`. Geometries and materials are shared, and colors come from one palette derived from the design tokens.
- **Zone state.** Each lot is a safe zone. Membership is a point-in-polygon test on the lot boundary. A breached zone shows red, a pulsing outline, a label with the cow's name and the words "fuera de zona", so the state is never color-only.
- **Controls.** Pause/resume, "Provocar salida" (forces one cow out to demo the alert), name labels on/off and camera presets (overview and one per lot). The zone panel lists cows inside each lot; the exit log keeps the session's exits and returns.
- **Performance.** Positions update in refs inside the render loop; React state changes only when a zone's status changes. Device pixel ratio is capped at 2.
- **Fallbacks.** Without WebGL the page explains it instead of showing an empty canvas. With `prefers-reduced-motion` the simulation starts paused and camera presets jump instead of flying.

---

## Videos

`/videos` lets the user load farm recordings (drag and drop or "Elegir videos") and review them in the browser.

![Videos page](docs/screenshots/videos-desktop.png)

- Files are validated (video type, not empty, up to 1 GB). Rejected files get a reason.
- Each video gets a thumbnail, duration and resolution read in the browser, and can be assigned to a camera.
- **Assigned videos show on the camera.** A video assigned to a camera plays on that camera's card in Cámaras and on the En vivo stage, tagged "Video cargado · no es en vivo". No demo detections are drawn over it, because they would be fake.
| Assigned video on the camera card | Assigned video on the live stage |
|---|---|
| ![Camera card playing a loaded video](docs/screenshots/cameras-video-desktop.png) | ![Live stage playing a loaded video](docs/screenshots/live-video-desktop.png) |

- **Nothing is uploaded.** The backend has no upload endpoint, so videos stay in the browser as object URLs (released when removed) and the page says so. "Analizar con IA" is disabled with the reason written next to it.

---

## Analytics

`/analytics` ("Análisis") turns the event history into percentages and trends for the last 24 hours, 7 days or 30 days.

![Analytics page](docs/screenshots/analytics-desktop.png)

| Chart | Question it answers |
|---|---|
| KPI row | How many events, what share were cattle outside the zone, what share were critical, busiest hour and camera |
| Daily trend | How events evolve per day, stacked by category |
| Category donut | Cattle vs. security vs. system, in percent |
| Hour of day | When events happen |
| Severity bar | Share of info, warning and critical |
| Events per camera | Which camera reports the most |
| Detector confidence | Distribution of the confidence the detector reported per event |

- Percentages use largest-remainder rounding, so each chart adds up to exactly 100 %.
- Every chart has a one-line insight computed from the data and a visually hidden data table for screen readers.
- Confidence is labeled as the detector's per-event value, not model accuracy. A lower count is not presented as lost animals.
- Data comes from `GET /api/events` (demo events in `mock` mode, marked with the demo badge).

---

## Motion

Motion is short, calm and functional. Presets live in `src/motion/presets.ts` (ease-out curves, 140–600 ms) and mirror the CSS tokens.

| Where | What moves |
|---|---|
| Route change | Content fades in with a short rise |
| Side rail and mobile tab bar | The active marker slides between items (shared layout animation) |
| Dashboard | Sections reveal in sequence; herd figures count up on first view |
| Lists (events, field log, cattle, cameras, videos) | Items stagger in on first render, capped at 8 steps |
| Login and register | The headline rises word by word; fields fade in in order |
| Analytics | Range tabs slide their indicator; KPIs count up; charts draw in |
| Buttons | Press feedback (`scale(0.97)`) |

Only `transform` and `opacity` are animated. With `prefers-reduced-motion` every primitive falls back to a short fade or no motion.

---

## Design system

The visual direction is **"farm survey plan"**: safe zones are drawn as survey boundaries (*linderos*, dashed lines with vertex marks), cameras are observation points and the history reads as a field log. It deliberately avoids generic grey KPI-card dashboards and cartoon farm imagery.

All values live as CSS custom properties in `src/styles/tokens.css`. Components use tokens only.

| Role | Token | Value |
|---|---|---|
| Ground | `--color-ground` | `#EDECE6` |
| Surface | `--color-surface` | `#F8F7F3` |
| Ink | `--color-ink` | `#17201A` |
| Brand (rail, primary action) | `--color-brand` | `#2F4A36` |
| Earth (selection, accents) | `--color-earth` | `#8A6A4A` |
| Safe / connected | `--color-safe` | `#2E7D4F` |
| Warning | `--color-warning` | `#B7791F` |
| Critical | `--color-critical` | `#B42318` |
| Inactive / disconnected | `--color-inactive` | `#6F756F` |
| Camera stage | `--color-stage` | `#121614` |

- **Light app, dark camera stage.** Owners check the app outdoors in daylight, so the app is light; video sits on a dark viewfinder surface.
- **Typography:** Archivo Variable. The wide cut is for headings, the condensed cut for dense labels, with tabular figures for counts and times.
- **States** always combine an icon and a word, never color alone. Outside-zone areas are also hatched.
- **Motion:** short ease-out transitions (140–600 ms); see [Motion](#motion). Everything respects `prefers-reduced-motion`.
- Text selection, focus rings, the caret and scrollbars are themed from the palette.

## Accessibility

- Semantic landmarks, a "Saltar al contenido" skip link and one `h1` per page
- Visible focus ring on every interactive element
- Labels linked to inputs, `aria-invalid` and `aria-describedby` for errors and hints, focus moved to the first invalid field
- Touch targets of at least 44 px, 16 px inputs (no zoom on iOS), safe-area insets
- Status never conveyed by color alone
- `prefers-reduced-motion` disables decorative motion

## Testing and quality checks

```sh
npm test        # 189 tests
npm run lint
npm run build
```

Covered: configuration parsing, the HTTP client (success, HTTP error, network, timeout, invalid JSON), mappers, data-source resolution, every service in `api` and `mock` mode, the demo auth service, permissions, safe storage, form validation, date and number formatting, and the dashboard rules (recent alerts, unknown state, 24 h band positions and restricted hours across midnight).

Each change is also reviewed with desktop (1440 px) and mobile (390 px) screenshots and an automated design detector before it is committed.

---

## Implemented features

**Phase 1: Foundation**
- Vite + React + strict TypeScript project, ESLint, Vitest, `@/` alias
- Typed API client, data services, source resolution and centralized demo data
- Design tokens, self-hosted variable font, base styles and reduced-motion rules
- Responsive app shell: side rail (desktop), tab bar and sheet (mobile), route transitions
- Base components: Button, TextField (with password reveal), StatusPill, Notice, EmptyState, ErrorState, Skeleton
- Favicon (a *lindero* mark) and mobile meta tags

**Phase 2: Authentication**
- Login and registration on a real dusk pasture photo with a safe-zone overlay and simulated detections, including one outside the zone
- Field validation, error and loading states, demo-account shortcuts
- Demo auth service with owner and worker roles, session persistence, route guards
- Signed-in user in the rail and logout from the profile page

**Phase 3: Dashboard**
- Status line with the farm name and condition, plus server, vision and camera status
- Recent-alert strip with a direct link to verify the camera
- Schematic farm plan: lots drawn as linderos, cameras as observation points with view wedges, the alert lot hatched, a pulse on the alert camera and a camera list
- Registered vs. detected cattle with the occlusion note
- Field log over a true-scale 24 h band with restricted hours
- Loading, empty, error, offline and unknown states

**Phase 4: Live monitoring**
- Camera stage with picture, lindero safe zone and detection boxes registered to the image
- Distinct strokes for cattle, persons and outside-zone detections; collision-aware labels
- Layer toggles, detection counts and an outside-zone chip
- Camera switcher (side list on desktop, scrollable strip on mobile), per-camera events and service status
- Designed states: loading, connecting, live, no stream, unsupported format, offline, error, vision not configured, server offline

**Phase 5: Cameras**
- One card per camera (cameras are real objects, so they get cards): picture or a short placeholder, status, zone, last connection, detection counts, "Ver en vivo"
- Cameras with recent alerts first, then cameras with connection problems
- Owners see a note that adding or rezoning cameras needs backend support; no fake configuration controls

![Cameras page](docs/screenshots/cameras-desktop.jpg)

**Phase 6: Cattle**
- Herd figures: registered vs. detected now, with the occlusion note
- Cattle visible per camera and outside-zone counts, labeled as a per-camera view (cameras cover only part of the farm, so rows are not a herd total)
- Recent cattle movements (outside-zone exits, external animals)
- No veterinary data: no vaccines, treatments, weights or collars

![Cattle page](docs/screenshots/cattle-desktop.jpg)

**Phases 7 and 8: Events, alerts and security**
- Category tabs with counts: Todos, Seguridad, Ganado, Sistema (security is a tab, not a separate page, because security alerts are events)
- Client-side filters for period, camera and minimum severity (the backend returns the latest 1000 events without query options), with a clear-filters action and an empty state for no matches
- History grouped by day ("Hoy", "Ayer", full date); relative times count calendar days so they agree with the groups
- Event detail answering what, when, where, which camera, how severe and what evidence exists. Severity says whether the server assigned it or the app estimated it; evidence says plainly that the server does not store images yet
- Security tab: "Una detección de persona no indica intención", restricted hours shown, and security events during restricted hours marked "Horario restringido"
- Labels follow the event catalog: "Persona detectada", "Posible intrusión", "Posible movimiento no autorizado de ganado". Never "thief" or "robbery"
- Detail is a sticky side panel on desktop and a native `<dialog>` bottom sheet on phones; the selected event lives in the URL (`?event=<id>`)

| Security tab with detail | All events |
|---|---|
| ![Security tab](docs/screenshots/events-security-desktop.jpg) | ![Events history](docs/screenshots/events-desktop.jpg) |

**Phase 9: Settings**
- Account section for every user; farm, users, cameras and safe zones, security hours and alert classification for owners only (permissions from `src/lib/permissions.ts`)
- Everything is read-only and each section says why: the backend has no endpoints to change settings, invite workers, change passwords or send notifications yet
- Workers see their account and a note that the owner manages the rest

![Settings page](docs/screenshots/settings-desktop.jpg)

**3D pasture, videos, analytics and motion**
- Interactive 3D pasture with a procedural asset kit, a seeded herd simulation and zones that turn red when a cow leaves them
- Local video review with thumbnails and camera assignment; assigned videos play on the camera card and the live stage
- Analytics page with percentage charts, KPIs and accessible data tables
- App-wide motion: route transitions, sliding navigation marker, staggered lists, count-up figures, masked headlines

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation | Done |
| 2 | Authentication | Done |
| 3 | Dashboard: farm status line, farm plan with cameras and safe zones, registered vs. detected cattle, field log with 24 h band | Done |
| 4 | Live monitoring: camera stage, detection and safe-zone overlays, status panels, all connection states | Done |
| 5 | Cameras: list, states, live access | Done |
| 6 | Cattle: registered vs. detected, recent detections, zone states | Done |
| 7 | Events & alerts: history, filters, detail with evidence | Done |
| 8 | Security: person detection, possible intrusion, restricted hours | Done |
| 9 | Settings: farm, users, cameras, alerts, account (permission-aware) | Done |
| — | 3D pasture, videos, analytics, motion | Done |
| 10 | Quality: accessibility and responsive audit, motion review, `DESIGN.md` | Next |

Pending on the backend side: authentication, cameras, streaming, detections, safe zones, severity and notifications. The frontend is ready to switch each capability from demo data to the API as it lands.

## Credits

- Login photo: [Cows grazing in a field at sunset](https://unsplash.com/photos/cows-grazing-in-a-field-at-sunset-HaSohIaDVdI) by Uran Wang, [Unsplash License](https://unsplash.com/license). Used as an illustrative image, not farm footage. The detections drawn over it are simulated.
- Icons: [Lucide](https://lucide.dev) (ISC License).
- 3D: [three.js](https://threejs.org) and [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) (MIT License). All 3D assets are procedural and original to this project.
- Charts: [Recharts](https://recharts.org) (MIT License). Motion: [Motion](https://motion.dev) (MIT License).
- Font: [Archivo](https://fonts.google.com/specimen/Archivo) by Omnibus-Type (SIL Open Font License).
