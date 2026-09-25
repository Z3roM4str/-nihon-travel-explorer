export type TripMember = {
  tripId: string;
  memberId: string; // e.g. "fernando", "lorena"
  displayName: string;
};

export type PlaceInterest = {
  tripId: string;
  memberId: string;
  placeId: string;
  interested: boolean;
  updatedAt: string;
};

export type SyncState = "loading" | "saving" | "synced" | "offline" | "error" | "local-only";

export interface InterestAdapter {
  members: TripMember[];
  interests: PlaceInterest[];
  syncState: SyncState;
  saveError: string | null;
  getInterestsForMember(memberId: string): string[];
  getCoincidences(): string[]; // places interested by both Fernando & Lorena
  toggleInterest(memberId: string, placeId: string): void;
  retrySave(): void;
}
