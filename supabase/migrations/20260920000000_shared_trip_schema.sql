-- Migration: 20260920000000_shared_trip_schema.sql
-- Description: Schema, RLS policies, and Realtime publication for private shared trip interests (Lorena & Fernando)

-- 1. Create Tables

CREATE TABLE IF NOT EXISTS public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.trip_members (
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (trip_id, member_id)
);

CREATE TABLE IF NOT EXISTS public.place_interests (
  trip_id UUID NOT NULL,
  member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id TEXT NOT NULL,
  interested BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (trip_id, member_id, place_id),
  FOREIGN KEY (trip_id, member_id) REFERENCES public.trip_members(trip_id, member_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.trip_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

-- 2. Enable Row Level Security (RLS)

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_invitations ENABLE ROW LEVEL SECURITY;

-- 3. RLS Helper Functions

CREATE OR REPLACE FUNCTION public.is_trip_member(lookup_trip_id UUID, lookup_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_members
    WHERE trip_id = lookup_trip_id AND member_id = lookup_user_id
  );
$$;

-- 4. RLS Policies

-- TRIPS: A user can read a trip if they are a member.
CREATE POLICY "Members can view their trips" ON public.trips
  FOR SELECT
  USING (public.is_trip_member(id, auth.uid()));

-- TRIP_MEMBERS: Members of a trip can see who else is in the trip.
CREATE POLICY "Members can view trip co-members" ON public.trip_members
  FOR SELECT
  USING (public.is_trip_member(trip_id, auth.uid()));

-- PLACE_INTERESTS:
-- Read: Authorized trip members can view interests of both members in the same trip.
CREATE POLICY "Members can view trip place interests" ON public.place_interests
  FOR SELECT
  USING (public.is_trip_member(trip_id, auth.uid()));

-- Write (Insert/Update): A user can ONLY modify their own interest record for a trip they belong to.
CREATE POLICY "Members can insert their own place interest" ON public.place_interests
  FOR INSERT
  WITH CHECK (
    member_id = auth.uid() AND public.is_trip_member(trip_id, auth.uid())
  );

CREATE POLICY "Members can update their own place interest" ON public.place_interests
  FOR UPDATE
  USING (
    member_id = auth.uid() AND public.is_trip_member(trip_id, auth.uid())
  )
  WITH CHECK (
    member_id = auth.uid() AND public.is_trip_member(trip_id, auth.uid())
  );

CREATE POLICY "Members can delete their own place interest" ON public.place_interests
  FOR DELETE
  USING (
    member_id = auth.uid() AND public.is_trip_member(trip_id, auth.uid())
  );

-- 5. Realtime Publication Setup
ALTER PUBLICATION supabase_realtime ADD TABLE public.place_interests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_members;
