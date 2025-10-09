-- Allow system to create general mood chat room
CREATE POLICY "Allow creation of general mood room" 
ON public.mood_chat_rooms 
FOR INSERT 
WITH CHECK (mood = 'general');