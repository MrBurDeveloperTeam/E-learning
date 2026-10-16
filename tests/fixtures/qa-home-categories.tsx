// Isolated QA only: the real Home, horizontal-scroll hook and unified feed;
// authentication, telemetry and data endpoints use local in-memory fixtures.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, createRootRoute, createRoute, createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { Home } from '../../src/pages/Home'
import '../../src/index.css'
const root = createRootRoute()
const route = createRoute({ getParentRoute: () => root, path: '/explore', component: Home })
const router = createRouter({ routeTree: root.addChildren([route]), history: createMemoryHistory({ initialEntries: ['/explore'] }) })
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>)
