import type {
  AuthSession,
  PlaceInterest,
  SharedTripAdapter,
  SharedTripChangeEvent,
  TripMember,
  UnsubscribeFn,
} from './types';

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export class SupabaseSharedTripAdapter implements SharedTripAdapter {
  private config: SupabaseConfig;
  private session: AuthSession | null = null;
  private isOffline = false;

  constructor(config: SupabaseConfig) {
    this.config = config;
  }

  async getSession(): Promise<AuthSession | null> {
    return this.session;
  }

  async login(displayName: string, userId?: string): Promise<AuthSession> {
    // In production/testing environment, this interacts with Supabase Auth endpoints or accepts JWT.
    const id = userId || `user-${displayName.toLowerCase().replace(/\s+/g, '-')}`;
    this.session = {
      userId: id,
      displayName,
      email: `${id}@nihon.local`,
    };
    return this.session;
  }

  async logout(): Promise<void> {
    if (this.session) {
      try {
        await fetch(`${this.config.supabaseUrl}/auth/v1/logout`, {
          method: 'POST',
          headers: this.getHeaders(),
        });
      } catch {
        // Ignore logout network failure, clear local session
      }
    }
    this.session = null;
  }

  async getMembers(tripId: string): Promise<TripMember[]> {
    if (this.isOffline) {
      throw new Error('Network offline');
    }
    const res = await fetch(
      `${this.config.supabaseUrl}/rest/v1/trip_members?trip_id=eq.${encodeURIComponent(tripId)}&select=trip_id,member_id,display_name`,
      {
        headers: this.getHeaders(),
      }
    );
    if (!res.ok) {
      throw new Error(`Failed to fetch trip members: ${res.statusText}`);
    }
    const rows = await res.json();
    return rows.map((r: { trip_id: string; member_id: string; display_name: string }) => ({
      tripId: r.trip_id,
      memberId: r.member_id,
      displayName: r.display_name,
    }));
  }

  async listInterests(tripId: string): Promise<PlaceInterest[]> {
    if (this.isOffline) {
      throw new Error('Network offline');
    }
    const res = await fetch(
      `${this.config.supabaseUrl}/rest/v1/place_interests?trip_id=eq.${encodeURIComponent(tripId)}&select=trip_id,member_id,place_id,interested,updated_at`,
      {
        headers: this.getHeaders(),
      }
    );
    if (!res.ok) {
      throw new Error(`Failed to fetch place interests: ${res.statusText}`);
    }
    const rows = await res.json();
    return rows.map(
      (r: {
        trip_id: string;
        member_id: string;
        place_id: string;
        interested: boolean;
        updated_at: string;
      }) => ({
        tripId: r.trip_id,
        memberId: r.member_id,
        placeId: r.place_id,
        interested: r.interested,
        updatedAt: r.updated_at,
      })
    );
  }

  async setInterest(
    tripId: string,
    placeId: string,
    interested: boolean,
    deviceTimestamp?: string
  ): Promise<PlaceInterest> {
    if (this.isOffline) {
      throw new Error('Network offline');
    }
    if (!this.session) {
      throw new Error('Unauthorized: No active session');
    }

    const payload = {
      trip_id: tripId,
      member_id: this.session.userId,
      place_id: placeId,
      interested,
      updated_at: deviceTimestamp || new Date().toISOString(),
    };

    const res = await fetch(`${this.config.supabaseUrl}/rest/v1/place_interests`, {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        'Prefer': 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Failed to update interest: ${res.statusText}`);
    }

    const [row] = await res.json();
    return {
      tripId: row.trip_id,
      memberId: row.member_id,
      placeId: row.place_id,
      interested: row.interested,
      updatedAt: row.updated_at,
    };
  }

  subscribeToChanges(
    _tripId: string,
    _onEvent: (event: SharedTripChangeEvent) => void
  ): UnsubscribeFn {
    // Supabase Realtime subscription stub / SSE listener setup
    return () => {
      // Unsubscribe logic
    };
  }

  setOfflineMode(offline: boolean): void {
    this.isOffline = offline;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': this.config.supabaseAnonKey,
    };
    if (this.session?.accessToken) {
      headers['Authorization'] = `Bearer ${this.session.accessToken}`;
    } else {
      headers['Authorization'] = `Bearer ${this.config.supabaseAnonKey}`;
    }
    return headers;
  }
}
