
-- Allow anon (unauthenticated) users to read system map nodes
CREATE POLICY "Public can read nodes"
  ON public.system_map_nodes
  FOR SELECT
  TO anon
  USING (true);

-- Allow anon (unauthenticated) users to read system map connections
CREATE POLICY "Public can read connections"
  ON public.system_map_connections
  FOR SELECT
  TO anon
  USING (true);
