import { createRootRoute, Outlet } from '@tanstack/react-router';

function RootComponent() {
  return (
    <div>
      <h1>Monetalis Root</h1>
      <Outlet />
    </div>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
});
