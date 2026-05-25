-- Migration: Add Flagging Support
-- Date: 2026-05-15
-- Description: Adds flagging, archiving, and view count tracking to messages

ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT FALSE AFTER status,
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE AFTER is_flagged,
ADD COLUMN IF NOT EXISTS view_count INT DEFAULT 0 AFTER is_archived,
ADD COLUMN IF NOT EXISTS last_activity_at DATETIME AFTER view_count;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_is_flagged ON messages(is_flagged);
CREATE INDEX IF NOT EXISTS idx_messages_is_archived ON messages(is_archived);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_status ON messages(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_messages_sender_status ON messages(sender_id, status);

-- Add status badge helper function (MySQL user-defined function)
-- This helps identify messages that need action
