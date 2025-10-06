-- Add reply_to column to chat_messages for threaded replies
ALTER TABLE chat_messages
ADD COLUMN reply_to uuid REFERENCES chat_messages(id) ON DELETE SET NULL;

-- Add RLS policy for users to delete their own messages
CREATE POLICY "Users can delete their own messages"
ON chat_messages
FOR DELETE
USING (auth.uid() = user_id);