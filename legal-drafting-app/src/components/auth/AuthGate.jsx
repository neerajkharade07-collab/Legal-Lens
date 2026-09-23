import { useAuth } from '../../hooks/useAuth';
import { PageLoader } from '../common/PageLoader';
import { SignInPanel } from './SignInPanel';

/** Shows the page when signed in, the sign-in panel otherwise. */
export function AuthGate({ children }) {
  const { status } = useAuth();
  if (status === 'checking') return <PageLoader />;
  if (status !== 'authenticated') return <SignInPanel />;
  return children;
}
