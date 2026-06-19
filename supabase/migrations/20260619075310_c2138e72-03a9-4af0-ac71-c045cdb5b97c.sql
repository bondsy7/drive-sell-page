-- Realtime channel authorization: scope topic subscriptions to the owning user.
-- Convention: clients use private channels named "user:<auth.uid>:<suffix>".
-- postgres_changes delivery additionally honors source-table RLS (already present on sales_notifications).

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own user-scoped realtime topics" ON realtime.messages;
DROP POLICY IF EXISTS "Users write own user-scoped realtime topics" ON realtime.messages;
DROP POLICY IF EXISTS "Service role manages all realtime messages" ON realtime.messages;

-- Authenticated users may only receive messages on a topic prefixed with their own user id.
CREATE POLICY "Users read own user-scoped realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE ('user:' || (SELECT auth.uid()::text) || ':%')
);

-- Authenticated users may only broadcast/presence on a topic prefixed with their own user id.
CREATE POLICY "Users write own user-scoped realtime topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE ('user:' || (SELECT auth.uid()::text) || ':%')
);

-- Service role keeps full access for edge functions that publish to user topics.
CREATE POLICY "Service role manages all realtime messages"
ON realtime.messages
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);