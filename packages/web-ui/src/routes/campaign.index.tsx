import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/campaign/')({
  beforeLoad: () => {
    throw redirect({ to: '/' });
  },
});
