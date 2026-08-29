# CRM SAIDHARA 2.0 — Local Setup

## 1. Install

```bash
npm install
npm run dev
```

## 2. Firebase

Create a Firebase Web App and enable:
- Authentication → Email/Password
- Firestore Database
- Storage

Copy `.env.example` to `.env.local` and fill the six `VITE_FIREBASE_*` values. Never commit `.env.local`.

## 3. First administrator

Create the first account in Firebase Authentication. Then create a Firestore document at `users/{AUTH_UID}` with:

```json
{
  "name": "Administrator",
  "email": "admin@example.com",
  "role": "admin",
  "active": true
}
```

Use the exact Authentication UID as the Firestore document ID. This is required because Firestore security rules use the authenticated UID to resolve the role.

## 4. Operational roles

Supported roles are:
- `admin`
- `crm`
- `warehouse`
- `pdi`
- `logistics`

Admin can eventually manage these from the application UI. Until the User Management screen is connected, create initial operational profiles in Firestore using the same structure.

## 5. Firebase rules

Deploy both:

```bash
firebase deploy --only firestore:rules,storage
```

## 6. Vercel

The project is a standard Vite SPA. Vercel should build with `npm run build` and serve `dist`. Add the same six Firebase `VITE_*` variables to the Vercel project environment settings.

Do not commit Firebase secrets or `.env.local`.
