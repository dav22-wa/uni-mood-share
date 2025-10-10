-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can create messages in their mood room" ON public.chat_messages;

-- Create new policy that allows posting to general room OR matching mood rooms
CREATE POLICY "Users can create messages in their mood room" 
ON public.chat_messages 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 FROM mood_checkins
    WHERE mood_checkins.user_id = auth.uid()
    AND mood_checkins.created_at > (now() - interval '24 hours')
  )
  AND (
    -- Allow posting to general room if user has checked in
    (SELECT mood FROM mood_chat_rooms WHERE id = chat_messages.room_id) = 'general'
    OR
    -- Or allow posting if user's mood matches room mood
    EXISTS (
      SELECT 1 FROM mood_checkins mc
      JOIN mood_chat_rooms mcr ON mc.mood = mcr.mood
      WHERE mc.user_id = auth.uid()
      AND mc.created_at > (now() - interval '24 hours')
      AND mcr.id = chat_messages.room_id
    )
  )
);