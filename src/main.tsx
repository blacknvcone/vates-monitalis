import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createRouter, redirect } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/lib/auth';
import { routeTree } from './routeTree.gen';
import './app.css';

// Create router with auth context
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  context: {
    auth: undefined!,
    queryClient: undefined!,
  },
});

// Register router type
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// Create query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

// App component that passes auth context to router
function App() {
  const auth = useAuth();

  return (
    <RouterProvider
      router={router}
      context={{ auth, queryClient }}
    />
  );
}

// Render
const rootElement = document.getElementById('root')!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </React.StrictMode>,
  );
}
