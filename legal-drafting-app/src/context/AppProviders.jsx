import { ToastProvider } from './ToastProvider';
import { AuthProvider } from './AuthProvider';
import { DocumentsProvider } from './DocumentsProvider';
import { DraftSetupProvider } from './DraftSetupProvider';

/** Must render inside the router: DraftSetupProvider navigates after generation. */
export function AppProviders({ children }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <DocumentsProvider>
          <DraftSetupProvider>{children}</DraftSetupProvider>
        </DocumentsProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
