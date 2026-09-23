import { useContext } from 'react';
import { DraftSetupContext } from '../context/contexts';

/** Open the Draft Setup flow from anywhere: openDraftSetup({ typeId?, source }). */
export function useDraftSetup() {
  const context = useContext(DraftSetupContext);
  if (!context) throw new Error('useDraftSetup must be used inside <DraftSetupProvider>.');
  return context;
}
