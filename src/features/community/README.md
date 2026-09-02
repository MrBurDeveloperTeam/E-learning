# Community feature

This folder owns the Community frontend module.

```text
api/          Supabase reads and mutations
components/   Community-only UI components
hooks/        React Query hooks and feature state
pages/        Route-level Community screens
types/        Community domain types
index.ts      Public exports used outside the feature
```

Shared application primitives such as `Button`, `Navbar`, `UserAvatar`, authentication state, and the Supabase client remain outside this folder because other features also use them.

The production Community database schema is managed separately from this frontend module. Runtime access uses the configured `VITE_SUPABASE_URL` and publishable key.
