-- Drop old policies for chat_messages
DROP POLICY IF EXISTS "Users can view messages in their mood room" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can create messages in their mood room" ON public.chat_messages;

-- New policy: Users can only view messages in rooms matching their current mood
CREATE POLICY "Users can view messages in their mood room" 
ON public.chat_messages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM mood_checkins mc
    JOIN mood_chat_rooms mcr ON mc.mood = mcr.mood
    WHERE mc.user_id = auth.uid()
    AND mc.created_at > (now() - interval '24 hours')
    AND mcr.id = chat_messages.room_id
  )
);

-- New policy: Users can only create messages in rooms matching their current mood
CREATE POLICY "Users can create messages in their mood room" 
ON public.chat_messages 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 
    FROM mood_checkins mc
    JOIN mood_chat_rooms mcr ON mc.mood = mcr.mood
    WHERE mc.user_id = auth.uid()
    AND mc.created_at > (now() - interval '24 hours')
    AND mcr.id = chat_messages.room_id
  )
);

-- Update mood_chat_rooms policy to allow creating any mood room
DROP POLICY IF EXISTS "Allow creation of general mood room" ON public.mood_chat_rooms;

CREATE POLICY "Users can create mood rooms for their mood"
ON public.mood_chat_rooms
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM mood_checkins
    WHERE mood_checkins.user_id = auth.uid()
    AND mood_checkins.mood = mood_chat_rooms.mood
    AND mood_checkins.created_at > (now() - interval '24 hours')
  )
);