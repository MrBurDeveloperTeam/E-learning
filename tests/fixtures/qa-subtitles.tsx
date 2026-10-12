// Development-only isolated UI fixture. No user session or production auth changes.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, createRootRoute, createRoute, createMemoryHistory, RouterProvider, Outlet } from '@tanstack/react-router'
import { AdminSubtitles } from '/src/pages/admin/AdminSubtitles'
import { useAuthStore } from '/src/store/authStore'
import '/src/index.css'
if (!import.meta.env.DEV) throw new Error('This fixture is only for local development.')
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
queryClient.setQueryData(['admin-sidebar-badges'], 0)
queryClient.setQueryData(['admin-dental-review-count'], 0)
useAuthStore.setState({ profile: { account_type: 'admin' }, user: null, isLoading: false })
const root = createRootRoute({ component: Outlet })
const route = createRoute({ getParentRoute: () => root, path: '/admin/subtitles', component: AdminSubtitles })
const router = createRouter({ routeTree: root.addChildren([route]), history: createMemoryHistory({ initialEntries: ['/admin/subtitles'] }) })
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>)
