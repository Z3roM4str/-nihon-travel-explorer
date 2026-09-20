import { describe, expect, it } from 'vitest';
import { MockSharedTripAdapter, MockSharedTripStore } from './mock-adapter';
import type { SharedTripChangeEvent, TripMember } from './types';

describe('Shared Trip Infrastructure (Lorena & Fernando)', () => {
  const TRIP_ID = 'japan-trip-2027';
  const UNAUTHORIZED_TRIP_ID = 'other-secret-trip';

  const FERNANDO: TripMember = {
    tripId: TRIP_ID,
    memberId: 'user-fernando',
    displayName: 'Fernando',
  };

  const LORENA: TripMember = {
    tripId: TRIP_ID,
    memberId: 'user-lorena',
    displayName: 'Lorena',
  };

  const MEMBERS = [FERNANDO, LORENA];

  function setupSharedAdapters() {
    const store = new MockSharedTripStore();

    store.seedTrip(TRIP_ID, MEMBERS, []);
    store.seedTrip(UNAUTHORIZED_TRIP_ID, [
      { tripId: UNAUTHORIZED_TRIP_ID, memberId: 'user-stranger', displayName: 'Stranger' },
    ]);

    const fernandoAdapter = new MockSharedTripAdapter(
      {
        userId: FERNANDO.memberId,
        displayName: FERNANDO.displayName,
        email: 'fernando@nihon.local',
      },
      store
    );

    const lorenaAdapter = new MockSharedTripAdapter(
      {
        userId: LORENA.memberId,
        displayName: LORENA.displayName,
        email: 'lorena@nihon.local',
      },
      store
    );

    const strangerAdapter = new MockSharedTripAdapter(
      {
        userId: 'user-stranger',
        displayName: 'Stranger',
        email: 'stranger@nihon.local',
      },
      store
    );

    return { fernandoAdapter, lorenaAdapter, strangerAdapter, store };
  }

  it('1. Two independent authenticated sessions view both members', async () => {
    const { fernandoAdapter, lorenaAdapter } = setupSharedAdapters();

    const fernandoMembers = await fernandoAdapter.getMembers(TRIP_ID);
    const lorenaMembers = await lorenaAdapter.getMembers(TRIP_ID);

    expect(fernandoMembers).toEqual(MEMBERS);
    expect(lorenaMembers).toEqual(MEMBERS);
  });

  it('2. Fernando marks a place and Lorena receives update without page reload', async () => {
    const { fernandoAdapter, lorenaAdapter } = setupSharedAdapters();

    const lorenaEvents: SharedTripChangeEvent[] = [];
    lorenaAdapter.subscribeToChanges(TRIP_ID, (event) => {
      lorenaEvents.push(event);
    });

    // Fernando marks Fushimi Inari
    const fernandoInterest = await fernandoAdapter.setInterest(TRIP_ID, 'kyoto-fushimi-inari', true);

    expect(fernandoInterest.memberId).toBe('user-fernando');
    expect(fernandoInterest.placeId).toBe('kyoto-fushimi-inari');
    expect(fernandoInterest.interested).toBe(true);

    // Lorena's subscriber receives event
    expect(lorenaEvents).toHaveLength(1);
    expect(lorenaEvents[0]).toEqual({
      type: 'interest_updated',
      interest: fernandoInterest,
    });
  });

  it('3. Lorena marks the same place and both interests coexist (logical key tripId+memberId+placeId)', async () => {
    const { fernandoAdapter, lorenaAdapter } = setupSharedAdapters();

    await fernandoAdapter.setInterest(TRIP_ID, 'tokyo-akihabara', true);
    await lorenaAdapter.setInterest(TRIP_ID, 'tokyo-akihabara', true);

    const interests = await fernandoAdapter.listInterests(TRIP_ID);

    expect(interests).toHaveLength(2);
    const fernandoRecord = interests.find((i) => i.memberId === 'user-fernando');
    const lorenaRecord = interests.find((i) => i.memberId === 'user-lorena');

    expect(fernandoRecord?.interested).toBe(true);
    expect(lorenaRecord?.interested).toBe(true);
  });

  it('4. One person unmarks a place without deleting or overwriting the other person interest', async () => {
    const { fernandoAdapter, lorenaAdapter } = setupSharedAdapters();

    // Both mark Ghibli Museum
    await fernandoAdapter.setInterest(TRIP_ID, 'tokyo-ghibli-museum', true);
    await lorenaAdapter.setInterest(TRIP_ID, 'tokyo-ghibli-museum', true);

    // Fernando unmarks Ghibli Museum
    await fernandoAdapter.setInterest(TRIP_ID, 'tokyo-ghibli-museum', false);

    const interests = await lorenaAdapter.listInterests(TRIP_ID);

    const fernandoRecord = interests.find((i) => i.memberId === 'user-fernando');
    const lorenaRecord = interests.find((i) => i.memberId === 'user-lorena');

    expect(fernandoRecord?.interested).toBe(false);
    expect(lorenaRecord?.interested).toBe(true);
  });

  it('5. Simultaneous changes to different places are both preserved', async () => {
    const { fernandoAdapter, lorenaAdapter } = setupSharedAdapters();

    await Promise.all([
      fernandoAdapter.setInterest(TRIP_ID, 'osaka-dotonbori', true),
      lorenaAdapter.setInterest(TRIP_ID, 'nara-park', true),
    ]);

    const interests = await fernandoAdapter.listInterests(TRIP_ID);

    expect(interests).toHaveLength(2);
    expect(interests.some((i) => i.placeId === 'osaka-dotonbori' && i.memberId === 'user-fernando')).toBe(true);
    expect(interests.some((i) => i.placeId === 'nara-park' && i.memberId === 'user-lorena')).toBe(true);
  });

  it('6. Unauthorized third user attempts to read, write, or subscribe to trip are rejected', async () => {
    const { strangerAdapter } = setupSharedAdapters();

    await expect(strangerAdapter.getMembers(TRIP_ID)).rejects.toThrow('Forbidden');
    await expect(strangerAdapter.listInterests(TRIP_ID)).rejects.toThrow('Forbidden');
    await expect(strangerAdapter.setInterest(TRIP_ID, 'kyoto-kiyomizudera', true)).rejects.toThrow('Forbidden');
    expect(() => strangerAdapter.subscribeToChanges(TRIP_ID, () => {})).toThrow('Forbidden');
  });

  it('7. Disconnection, offline queuing, and resynchronization upon reconnection', async () => {
    const { fernandoAdapter, lorenaAdapter } = setupSharedAdapters();

    // Simulate Fernando going offline
    fernandoAdapter.setOfflineMode(true);

    await expect(fernandoAdapter.setInterest(TRIP_ID, 'hakone-ropeway', true)).rejects.toThrow('Network offline');

    // Lorena does not see offline action yet
    let lorenaInterests = await lorenaAdapter.listInterests(TRIP_ID);
    expect(lorenaInterests).toHaveLength(0);

    // Reconnect Fernando
    fernandoAdapter.setOfflineMode(false);

    // Resynchronize and verify
    lorenaInterests = await lorenaAdapter.listInterests(TRIP_ID);
    expect(lorenaInterests).toHaveLength(1);
    expect(lorenaInterests[0].placeId).toBe('hakone-ropeway');
  });

  it('8. Session logout purges cached local session and returns null session', async () => {
    const { fernandoAdapter } = setupSharedAdapters();

    let session = await fernandoAdapter.getSession();
    expect(session?.userId).toBe('user-fernando');

    await fernandoAdapter.logout();

    session = await fernandoAdapter.getSession();
    expect(session).toBeNull();

    await expect(fernandoAdapter.listInterests(TRIP_ID)).rejects.toThrow('Unauthorized');
  });
});
