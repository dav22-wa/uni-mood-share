-- Fix security vulnerabilities and set up DM messaging infrastructure

-- 1. Fix profiles table security - require authentication for SELECT
DROP POLICY IF EXISTS "Users can view profiles of people with mood check-ins" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Authenticated users can view all profiles (needed for contacts/messaging)
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Users can only update their own profile
-- (existing policy is fine, just ensuring it's there)

-- 2. Fix mood_checkins security - require authentication
DROP POLICY IF EXISTS "Users can view mood check-ins from last 24h" ON public.mood_checkins;

CREATE POLICY "Users can view their own mood check-ins"
ON public.mood_checkins
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 3. Fix reported_messages security - only reporters and admins can view
CREATE POLICY "Users can view their own reports"
ON public.reported_messages
FOR SELECT
TO authenticated
USING (auth.uid() = reporter_id);

-- 4. Create contacts/friends table
CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, contact_id),
  CHECK (user_id != contact_id)
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own contacts"
ON public.contacts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can add contacts"
ON public.contacts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their contacts"
ON public.contacts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 5. Create direct_messages table
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  image_url text,
  reply_to uuid REFERENCES public.direct_messages(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CHECK (sender_id != receiver_id)
);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own messages"
ON public.direct_messages
FOR SELECT
TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages"
ON public.direct_messages
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can delete their own messages"
ON public.direct_messages
FOR DELETE
TO authenticated
USING (auth.uid() = sender_id);

-- 6. Create read_receipts table
CREATE TABLE IF NOT EXISTS public.read_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

ALTER TABLE public.read_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view read receipts for their messages"
ON public.read_receipts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.direct_messages
    WHERE id = message_id
    AND (sender_id = auth.uid() OR receiver_id = auth.uid())
  )
);

CREATE POLICY "Users can mark messages as read"
ON public.read_receipts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 7. Add avatar_url to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- 8. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_contact_id ON public.contacts(contact_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender ON public.direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver ON public.direct_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_created_at ON public.direct_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_read_receipts_message_id ON public.read_receipts(message_id);

-- 9. Enable realtime for direct messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.read_receipts;