export type ConnectionState = 'loading' | 'saving' | 'synced' | 'offline' | 'error';

export interface AuthSession {
  userId: string;
  email?: string;
  displayName: string;
  accessToken?: string;
}

export interface TripMember {
  tripId: string;
  memberId: string;
  displayName: string;
}

export interface PlaceInterest {
  tripId: string;
  memberId: string;
  placeId: string;
  interested: boolean;
  updatedAt: string; // ISO-8601 string or timestamp
}

export type SharedTripChangeEvent =
  | { type: 'interest_updated'; interest: PlaceInterest }
  | { type: 'member_joined'; member: TripMember }
  | { type: 'member_left'; memberId: string }
  | { type: 'connection_state_changed'; state: ConnectionState; error?: string };

export type UnsubscribeFn = () => void;

export interface SharedTripAdapter {
  getSession(): Promise<AuthSession | null>;
  login(displayName: string, userId?: string): Promise<AuthSession>;
  logout(): Promise<void>;

  getMembers(tripId: string): Promise<TripMember[]>;
  listInterests(tripId: string): Promise<PlaceInterest[]>;

  setInterest(
    tripId: string,
    placeId: string,
    interested: boolean,
    deviceTimestamp?: string
  ): Promise<PlaceInterest>;

  subscribeToChanges(
    tripId: string,
    onEvent: (event: SharedTripChangeEvent) => void
  ): UnsubscribeFn;

  // Utility methods for testing / offline simulation
  setOfflineMode?(offline: boolean): void;
  getCache?(tripId: string): { members: TripMember[]; interests: PlaceInterest[] } | null;
}
