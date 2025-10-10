-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view messages in their mood room" ON public.chat_messages;

-- Create new policy that allows viewing general room messages OR matching mood rooms
CREATE POLICY "Users can view messages in their mood room" 
ON public.chat_messages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM mood_checkins
    WHERE mood_checkins.user_id = auth.uid()
    AND mood_checkins.created_at > (now() - interval '24 hours')
  )
  AND (
    -- Allow viewing general room messages if user has checked in
    (SELECT mood FROM mood_chat_rooms WHERE id = chat_messages.room_id) = 'general'
    OR
    -- Or allow viewing if user's mood matches room mood
    EXISTS (
      SELECT 1 FROM mood_checkins mc
      JOIN mood_chat_rooms mcr ON mc.mood = mcr.mood
      WHERE mc.user_id = auth.uid()
      AND mc.created_at > (now() - interval '24 hours')
      AND mcr.id = chat_messages.room_id
    )
  )
);