import { createFileRoute } from '@tanstack/react-router';

function LoginPage() {
  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <h1>Monetalis Login</h1>
      <p>Testing if page renders...</p>
    </div>
  );
}

export const Route = createFileRoute('/login')({
  component: LoginPage,
});
