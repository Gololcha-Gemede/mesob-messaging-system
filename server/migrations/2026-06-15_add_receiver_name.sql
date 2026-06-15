ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS receiver_name VARCHAR(255) NULL AFTER receiver_id;
