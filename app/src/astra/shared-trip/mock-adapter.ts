import type {
  AuthSession,
  PlaceInterest,
  SharedTripAdapter,
  SharedTripChangeEvent,
  TripMember,
  UnsubscribeFn,
} from './types';

// Shared backend server store to simulate Supabase / PostgREST / Realtime across multiple sessions
export class MockSharedTripStore {
  private members: Map<string, TripMember[]> = new Map();
  // tripId -> Map<"memberId:placeId", PlaceInterest>
  private interests: Map<string, Map<string, PlaceInterest>> = new Map();
  private subscribers: Map<string, Set<(event: SharedTripChangeEvent) => void>> = new Map();

  public seedTrip(tripId: string, members: TripMember[], interests: PlaceInterest[] = []) {
    this.members.set(tripId, [...members]);
    let tripInterestMap = this.interests.get(tripId);
    if (!tripInterestMap) {
      tripInterestMap = new Map();
      this.interests.set(tripId, tripInterestMap);
    }
    for (const item of interests) {
      tripInterestMap.set(`${item.memberId}:${item.placeId}`, { ...item });
    }
  }

  public getMembers(tripId: string, userId: string): TripMember[] {
    this.checkAuthorized(tripId, userId);
    return this.members.get(tripId) || [];
  }

  public listInterests(tripId: string, userId: string): PlaceInterest[] {
    this.checkAuthorized(tripId, userId);
    const tripInterestMap = this.interests.get(tripId);
    if (!tripInterestMap) return [];
    return Array.from(tripInterestMap.values());
  }

  public setInterest(
    tripId: string,
    userId: string,
    placeId: string,
    interested: boolean,
    deviceTimestamp?: string
  ): PlaceInterest {
    this.checkAuthorized(tripId, userId);

    let tripInterestMap = this.interests.get(tripId);
    if (!tripInterestMap) {
      tripInterestMap = new Map();
      this.interests.set(tripId, tripInterestMap);
    }

    const key = `${userId}:${placeId}`;
    const updatedAt = deviceTimestamp || new Date().toISOString();

    const interestRecord: PlaceInterest = {
      tripId,
      memberId: userId,
      placeId,
      interested,
      updatedAt,
    };

    tripInterestMap.set(key, interestRecord);

    // Broadcast real-time change event to all connected subscribers for this trip
    this.notifySubscribers(tripId, {
      type: 'interest_updated',
      interest: interestRecord,
    });

    return interestRecord;
  }

  public subscribe(
    tripId: string,
    userId: string,
    onEvent: (event: SharedTripChangeEvent) => void
  ): UnsubscribeFn {
    this.checkAuthorized(tripId, userId);

    let set = this.subscribers.get(tripId);
    if (!set) {
      set = new Set();
      this.subscribers.set(tripId, set);
    }
    set.add(onEvent);

    return () => {
      const currentSet = this.subscribers.get(tripId);
      if (currentSet) {
        currentSet.delete(onEvent);
      }
    };
  }

  private notifySubscribers(tripId: string, event: SharedTripChangeEvent) {
    const set = this.subscribers.get(tripId);
    if (set) {
      for (const listener of Array.from(set)) {
        try {
          listener(event);
        } catch {
          // ignore
        }
      }
    }
  }

  private checkAuthorized(tripId: string, userId: string) {
    const members = this.members.get(tripId) || [];
    const isMember = members.some((m) => m.memberId === userId);
    if (!isMember) {
      throw new Error('Forbidden: User is not a member of this trip');
    }
  }
}

export class MockSharedTripAdapter implements SharedTripAdapter {
  private store: MockSharedTripStore;
  private session: AuthSession | null = null;
  private isOffline = false;
  private offlineQueue: Array<{
    tripId: string;
    placeId: string;
    interested: boolean;
    updatedAt: string;
  }> = [];

  constructor(initialSession?: AuthSession, store?: MockSharedTripStore) {
    this.session = initialSession || null;
    this.store = store || new MockSharedTripStore();
  }

  public seedTrip(tripId: string, members: TripMember[], interests: PlaceInterest[] = []) {
    this.store.seedTrip(tripId, members, interests);
  }

  async getSession(): Promise<AuthSession | null> {
    return this.session;
  }

  async login(displayName: string, userId?: string): Promise<AuthSession> {
    const id = userId || `user-${displayName.toLowerCase().replace(/\s+/g, '-')}`;
    this.session = {
      userId: id,
      displayName,
      email: `${id}@nihon.local`,
    };
    return this.session;
  }

  async logout(): Promise<void> {
    this.session = null;
  }

  async getMembers(tripId: string): Promise<TripMember[]> {
    if (this.isOffline) {
      throw new Error('Network offline');
    }
    if (!this.session) {
      throw new Error('Unauthorized: User not logged in');
    }
    return this.store.getMembers(tripId, this.session.userId);
  }

  async listInterests(tripId: string): Promise<PlaceInterest[]> {
    if (this.isOffline) {
      throw new Error('Network offline');
    }
    if (!this.session) {
      throw new Error('Unauthorized: User not logged in');
    }
    return this.store.listInterests(tripId, this.session.userId);
  }

  async setInterest(
    tripId: string,
    placeId: string,
    interested: boolean,
    deviceTimestamp?: string
  ): Promise<PlaceInterest> {
    if (!this.session) {
      throw new Error('Unauthorized: User not logged in');
    }

    if (this.isOffline) {
      this.offlineQueue.push({
        tripId,
        placeId,
        interested,
        updatedAt: deviceTimestamp || new Date().toISOString(),
      });
      throw new Error('Network offline: Queued for retry');
    }

    return this.store.setInterest(
      tripId,
      this.session.userId,
      placeId,
      interested,
      deviceTimestamp
    );
  }

  subscribeToChanges(
    tripId: string,
    onEvent: (event: SharedTripChangeEvent) => void
  ): UnsubscribeFn {
    if (!this.session) {
      throw new Error('Unauthorized: User not logged in');
    }
    return this.store.subscribe(tripId, this.session.userId, onEvent);
  }

  setOfflineMode(offline: boolean): void {
    const previous = this.isOffline;
    this.isOffline = offline;

    if (previous && !offline) {
      this.flushOfflineQueue();
    }
  }

  getCache(tripId: string): { members: TripMember[]; interests: PlaceInterest[] } | null {
    if (!this.session) return null;
    try {
      const members = this.store.getMembers(tripId, this.session.userId);
      const interests = this.store.listInterests(tripId, this.session.userId);
      return { members, interests };
    } catch {
      return null;
    }
  }

  private flushOfflineQueue() {
    const queue = [...this.offlineQueue];
    this.offlineQueue = [];
    for (const item of queue) {
      this.setInterest(item.tripId, item.placeId, item.interested, item.updatedAt).catch(
        () => {
          // ignore retry fail
        }
      );
    }
  }
}
