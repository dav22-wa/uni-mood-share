-- Fix the mood_chat_rooms table to allow 'general' mood
ALTER TYPE mood_type ADD VALUE IF NOT EXISTS 'general';

-- Update RLS policies for profiles table to restrict access
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

-- Users can only view profiles of people they're chatting with or in the same mood room
CREATE POLICY "Users can view profiles of chat participants" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() = id OR
  -- Can see profiles of people they're in direct messages with
  EXISTS (
    SELECT 1 FROM direct_messages 
    WHERE (sender_id = auth.uid() AND receiver_id = profiles.id)
       OR (receiver_id = auth.uid() AND sender_id = profiles.id)
  ) OR
  -- Can see profiles of people in the same mood room today
  EXISTS (
    SELECT 1 FROM mood_checkins mc1
    INNER JOIN mood_checkins mc2 ON mc1.mood = mc2.mood
    WHERE mc1.user_id = auth.uid() 
      AND mc2.user_id = profiles.id
      AND mc1.created_at > now() - interval '24 hours'
      AND mc2.created_at > now() - interval '24 hours'
  )
);