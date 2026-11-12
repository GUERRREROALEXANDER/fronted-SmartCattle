# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite + TypeScript SPA, plain CSS (CSS Modules + custom properties). Consumes the existing Python FastAPI backend (`SmartCattle-Backend`, separate repository). The backend is not rewritten or changed from this repository.

## Users

Two roles, both with their own account:

- **Owner / admin**: the farm owner. Watches the herd, reviews alerts and events, manages workers and farm settings. Uses the app on a phone in the field and on a computer in the office, roughly equally.
- **Farm worker / foreman**: associated with one farm through a secure backend relationship (invitation or assignment), never by typing a farm name. Needs monitoring, cameras, alerts, event review and security notifications.

## Product Purpose

SmartCattle monitors cattle farms with cameras and computer vision (YOLO-based detection in a separate AI service). It lets the farm see what is happening without being there, learn in time when an animal leaves the safe zone or a person appears where they should not, and review afterwards what happened.

Success: a user receives and understands an alert fast, verifies it on the live camera, and finds the event in the history with when, where, which camera and what evidence.

## Positioning

Monitoring through computer vision on cameras: no collars, electronic ear tags, GPS or sensors on the animal. Detection, safe zones and security events are the core, not manual herd record keeping.

## Operating Context

- Cameras installed on the farm; an AI service runs detection and posts events to the backend.
- Safe zones defined over camera views; leaving them produces an event.
- Field use on phones with variable connectivity; office use on desktop.
- Day and night: the same detection can mean different severity depending on restricted hours (backend rule).

## Capabilities and Constraints

Real backend capabilities today (FastAPI, in-memory storage):
- `GET /health`, `GET /api/status` (version, `ai_service.configured`, storage).
- `GET /api/animals` (always empty for now).
- `GET /api/events` (latest 1000; only `event_type = cattle_out_of_zone`; fields: id, camera_id, detected_object, confidence, timestamp, received_at).
- `POST /api/ai/events` is for the AI service only.
- CORS: GET/POST, headers `Content-Type` and `X-API-Key`, no credentials.

Not in the backend yet (frontend uses centralized, labeled mock data; endpoints are never invented): authentication and sessions, users and roles, farms and worker association, cameras, video streaming, per-frame detections, safe-zone geometry, person/vehicle detection, event severity, zone, evidence and review state, real-time push, notifications, day/night rules.

Scope limits: not veterinary software. No vaccines, reproduction, treatments, medical records, weighing, GPS collars or physical sensors unless explicitly requested.

Language: all source code, comments, docs and commits in English; the visible UI is in Spanish.

## Brand Commitments

Name: SmartCattle. No logo or established visual identity. The previous prototype (plain white backgrounds, cartoon illustrations, weak hierarchy) is an anti-reference. Desired personality: professional, calm, trustworthy, rural but technological, realistic. No cartoon cows or childish illustration.

## Evidence on Hand

None yet: no real camera footage, model accuracy metrics, customers or testimonials. Login imagery will use verified free-license stock photography until the user provides farm footage. Never fabricate accuracy figures, farm counts or testimonials; mock data is always labeled.

## Product Principles

1. The alert comes first: an animal outside the safe zone or a possible intrusion is seen and understood in seconds, on phone or desktop.
2. Verify before acting: every alert leads to evidence (live camera or event capture).
3. Detection is not intention: say "Person detected" or "Possible intrusion", never "Thief" or "Robbery".
4. Registered is not detected: a lower detected count can be occlusion, camera angle or lighting, not a lost animal.
5. Honest system state: offline cameras, unavailable AI and demo data are always stated, never hidden.

## Accessibility & Inclusion

WCAG 2.2 AA contrast, keyboard operation, semantic HTML, non-color-only status, 44px touch targets, `prefers-reduced-motion` respected.
