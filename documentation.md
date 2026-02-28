# Bethunana Academy - Code Documentation

## 1. Project Overview

This repository contains a React + Vite frontend for the Bethunana Academy learning platform.

Core capabilities currently implemented:

- User login (mock, client-side)
- Role-aware navigation (`student` and `admin`)
- Subject/topic/video browsing
- Video watch page
- Admin content management page (mock upload + lesson management UI)

The app uses mock data and does not yet connect to a production backend API.

## 2. Tech Stack

- React 18
- TypeScript
- Vite
- React Router v7 (`react-router`)
- Tailwind CSS v4
- Radix UI-based component primitives (under `src/app/components/ui`)
- Lucide icons

## 3. Folder Structure

```txt
src/
  app/
    App.tsx                  # App root, auth state, router initialization
    routes.tsx               # Route definitions and role guards
    data/
      mockData.ts            # Mock users, subjects, topics, videos + selectors
    layouts/
      RootLayout.tsx         # Shared app shell (Header, Outlet, Footer)
    components/
      Header.tsx             # Top navigation and user actions
      Footer.tsx             # Footer
      ui/                    # Reusable UI components
    pages/
      admin/
        AdminPanel.tsx
      learner/
        Home.tsx
        Profile.tsx
        SubjectPage.tsx
        TopicPage.tsx
        VideoWatch.tsx
      Login.tsx
      NotFound.tsx
```

## 4. Application Flow

### 4.1 Authentication State

File: `src/app/App.tsx`

- `currentUser` is stored in component state.
- On mount, user is loaded from `localStorage` key `bethunana_user`.
- `handleLogin` saves user to state and `localStorage`.
- `handleLogout` clears state and `localStorage`.
- Router is created via `createRouter(currentUser, handleLogin, handleLogout)`.

### 4.2 Routing and Access Control

File: `src/app/routes.tsx`

Routes:

- `/` -> redirects to `/home` when logged in, else `/login`
- `/login` -> login page (redirects to `/home` if already logged in)
- `/home` -> authenticated users only
- `/profile` -> authenticated users only
- `/subject/:subjectId` -> authenticated users only
- `/subject/:subjectId/topic/:topicId` -> authenticated users only
- `/watch/:videoId` -> authenticated users only
- `/admin` -> admin users only (`currentUser?.role === 'admin'`)
- `*` -> redirects to `/`

Shared layout:

- `RootLayout` wraps authenticated routes and renders:
  - `Header`
  - `Outlet` (active page)
  - `Footer`

## 5. Data Model

File: `src/app/data/mockData.ts`

Interfaces:

- `Video`
- `Topic`
- `Subject`
- `User`

Exports include:

- Mock users: `mockUser`, `mockAdminUser`
- Content arrays: `subjects`, `topics`, `videos`
- Query helpers:
  - `getSubjectById`
  - `getTopicById`
  - `getTopicsBySubject`
  - `getVideoById`
  - `getVideosByTopic`
  - `getVideosBySubject`

## 6. Page Responsibilities

### 6.1 `Login.tsx`

- Handles user sign-in using mock logic.
- Creates a client-side user object and calls `onLogin`.

### 6.2 `Home.tsx`

- Displays learning dashboard entry points.
- Surfaces subject cards and summary content.

### 6.3 `SubjectPage.tsx`

- Reads `subjectId` route param.
- Displays selected subject details and its topics.

### 6.4 `TopicPage.tsx`

- Reads `subjectId` + `topicId`.
- Displays topic context and list of videos in that topic.

### 6.5 `VideoWatch.tsx`

- Reads `videoId`.
- Displays embedded lesson video and metadata.

### 6.6 `AdminPanel.tsx`

- Admin-only page.
- Provides:
  - Lesson upload form (mock behavior)
  - Platform stats card
  - Table of existing lessons
- Uses local component state for form data and topic filtering.

### 6.7 `Profile.tsx`

- Displays current user profile details and account actions.

### 6.8 `NotFound.tsx`

- Not currently used by router wildcard (router currently redirects to `/`).

## 7. Shared Components

### 7.1 `Header.tsx`

- Shows brand and user menu.
- Shows admin CTA when `user.role === 'admin'`.
- Includes navigation to Profile and Admin panel.
- Exposes logout action.

### 7.2 `Footer.tsx`

- Static footer for platform branding/context.

### 7.3 `components/ui/*`

- Reusable design-system style components (buttons, inputs, cards, dialogs, tables, etc.).
- Used by page-level components for consistent UI composition.

## 8. Admin Behavior (Current)

- Admin access is front-end guarded by route checks.
- Admin actions in `AdminPanel.tsx` are mock behaviors (no backend persistence).
- Upload submit currently shows success alert and resets form.

## 9. Running and Building

From project root:

- Install dependencies: `npm i`
- Run dev server: `npm run dev`
- Build production bundle: `npm run build`

## 10. Current Limitations

- Authentication and authorization are client-side only.
- No backend API integration for users/content management yet.
- No automated tests configured in this repository.
- Data is static mock data in source files.

## 11. Suggested Next Engineering Steps

1. Replace mock login with backend auth.
2. Move role and access checks to server-backed authorization.
3. Add API service layer for content and admin operations.
4. Add unit/integration tests (routing, auth guards, core page flows).
5. Introduce shared type modules to avoid repeated user type definitions.
