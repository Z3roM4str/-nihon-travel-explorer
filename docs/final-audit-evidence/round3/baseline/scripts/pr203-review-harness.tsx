// Independent review fixture. Product modules are imported unchanged.
import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { useTravellers } from './src/useTravellers';
import { usePlanningDraft } from './src/usePlanningDraft';
import { usePortableBackup } from './src/usePortableBackup';
import { flushAllPendingWrites, notifyStorageReplaced, getProtectionSnapshot } from './src/lib/stored-document';
import { retryPersistence, getPersistenceState } from './src/lib/device-storage';
import { reloadRefreshingModules } from './src/lib/lazy-surface';
import { planRestore, buildPortableBackup } from './src/lib/portable-backup';
export function Harness() {
  const travellers = useTravellers();
  const planning = usePlanningDraft(travellers.savedIds);
  const backup = usePortableBackup();
  useEffect(() => {
    (window as any).review = { travellers, planning, backup, flushAllPendingWrites,
      notifyStorageReplaced, getProtectionSnapshot, retryPersistence, getPersistenceState, reloadRefreshingModules,
      makeRestorePlan: (travellers: any, draft: any) => planRestore(buildPortableBackup(travellers,draft,new Date().toISOString()), ['JP-044','JP-021','JP-077']) };
  });
  return <pre>{JSON.stringify({ travellers: travellers.savedIds, days: planning.planningDays?.length })}</pre>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
