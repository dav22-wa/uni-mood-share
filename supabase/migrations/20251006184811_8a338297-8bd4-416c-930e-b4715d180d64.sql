-- Update RLS policy to allow viewing profiles of users with recent mood check-ins
CREATE POLICY "Users can view profiles of people with mood check-ins"
ON profiles
FOR SELECT
USING (
  id IN (
    SELECT user_id 
    FROM mood_checkins 
    WHERE created_at > (now() - '24:00:00'::interval)
  )
);