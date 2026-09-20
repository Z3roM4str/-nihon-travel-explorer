import { useCallback, useEffect, useState } from 'react';
import type {
  AuthSession,
  ConnectionState,
  PlaceInterest,
  SharedTripAdapter,
  TripMember,
} from './types';

export interface UseSharedTripOptions {
  adapter: SharedTripAdapter;
  tripId: string;
}

export function useSharedTrip({ adapter, tripId }: UseSharedTripOptions) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [interests, setInterests] = useState<PlaceInterest[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshState = useCallback(async () => {
    try {
      setConnectionState('loading');
      setErrorMessage(null);
      const currentSession = await adapter.getSession();
      setSession(currentSession);

      if (!currentSession) {
        setMembers([]);
        setInterests([]);
        setConnectionState('synced');
        return;
      }

      const [mList, iList] = await Promise.all([
        adapter.getMembers(tripId),
        adapter.listInterests(tripId),
      ]);

      setMembers(mList);
      setInterests(iList);
      setConnectionState('synced');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching trip state';
      setErrorMessage(msg);
      if (msg.includes('offline')) {
        setConnectionState('offline');
      } else {
        setConnectionState('error');
      }
    }
  }, [adapter, tripId]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const currentSession = await adapter.getSession();
        if (!active) return;
        setSession(currentSession);

        if (!currentSession) {
          setMembers([]);
          setInterests([]);
          setConnectionState('synced');
          return;
        }

        const [mList, iList] = await Promise.all([
          adapter.getMembers(tripId),
          adapter.listInterests(tripId),
        ]);

        if (!active) return;
        setMembers(mList);
        setInterests(iList);
        setConnectionState('synced');
      } catch (err: unknown) {
        if (!active) return;
        const msg = err instanceof Error ? err.message : 'Error fetching trip state';
        setErrorMessage(msg);
        if (msg.includes('offline')) {
          setConnectionState('offline');
        } else {
          setConnectionState('error');
        }
      }
    }

    load();

    // Subscribe to real-time changes
    const unsubscribe = adapter.subscribeToChanges(tripId, (event) => {
      if (!active) return;
      if (event.type === 'interest_updated') {
        setInterests((prev) => {
          const index = prev.findIndex(
            (item) =>
              item.memberId === event.interest.memberId &&
              item.placeId === event.interest.placeId
          );
          if (index >= 0) {
            const next = [...prev];
            next[index] = event.interest;
            return next;
          }
          return [...prev, event.interest];
        });
      } else if (event.type === 'member_joined') {
        setMembers((prev) => {
          if (prev.some((m) => m.memberId === event.member.memberId)) {
            return prev;
          }
          return [...prev, event.member];
        });
      } else if (event.type === 'member_left') {
        setMembers((prev) => prev.filter((m) => m.memberId !== event.memberId));
      } else if (event.type === 'connection_state_changed') {
        setConnectionState(event.state);
        if (event.error) {
          setErrorMessage(event.error);
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [adapter, tripId]);

  const toggleInterest = useCallback(
    async (placeId: string, interested: boolean) => {
      if (!session) {
        throw new Error('User not logged in');
      }
      setConnectionState('saving');
      setErrorMessage(null);

      try {
        const updated = await adapter.setInterest(
          tripId,
          placeId,
          interested,
          new Date().toISOString()
        );
        setInterests((prev) => {
          const index = prev.findIndex(
            (item) =>
              item.memberId === updated.memberId && item.placeId === updated.placeId
          );
          if (index >= 0) {
            const next = [...prev];
            next[index] = updated;
            return next;
          }
          return [...prev, updated];
        });
        setConnectionState('synced');
        return updated;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to set interest';
        setErrorMessage(msg);
        if (msg.includes('offline')) {
          setConnectionState('offline');
        } else {
          setConnectionState('error');
        }
        throw err;
      }
    },
    [adapter, tripId, session]
  );

  return {
    session,
    members,
    interests,
    connectionState,
    errorMessage,
    refreshState,
    toggleInterest,
  };
}
