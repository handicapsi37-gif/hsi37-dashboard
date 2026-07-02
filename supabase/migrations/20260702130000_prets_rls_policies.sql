ALTER TABLE prets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture authentifiée" ON prets
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Écriture authentifiée" ON prets
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
