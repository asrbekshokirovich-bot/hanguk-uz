-- Feature 2: University Document Requirements
CREATE TABLE university_document_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID REFERENCES universities(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('study_plan', 'personal_statement')),
  min_word_count INT DEFAULT 500,
  max_word_count INT DEFAULT 1000,
  required_sections JSONB DEFAULT '[]',
  language_requirements TEXT,
  formatting_notes TEXT,
  tips TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(university_id, document_type)
);

-- Feature 4: Student Achievements
CREATE TABLE student_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  achievement_type TEXT NOT NULL,
  achievement_data JSONB DEFAULT '{}',
  earned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, achievement_type)
);

-- Feature 4: Writing Streaks
CREATE TABLE writing_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL UNIQUE,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  last_activity_date DATE,
  total_words_written INT DEFAULT 0,
  total_sessions_completed INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Feature 5: Peer Reviews
CREATE TABLE peer_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID REFERENCES study_plan_drafts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  reviewer_id UUID,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'expired')),
  anonymous_name TEXT,
  review_feedback TEXT,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  strengths TEXT[],
  improvements TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days')
);

-- Feature 5: Peer Review Queue
CREATE TABLE peer_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID REFERENCES study_plan_drafts(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  university_id UUID REFERENCES universities(id),
  submitted_at TIMESTAMPTZ DEFAULT now(),
  is_matched BOOLEAN DEFAULT false
);

-- Enable RLS on all new tables
ALTER TABLE university_document_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE writing_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE peer_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE peer_review_queue ENABLE ROW LEVEL SECURITY;

-- RLS for university_document_requirements
CREATE POLICY "Anyone can view document requirements"
ON university_document_requirements FOR SELECT
USING (true);

CREATE POLICY "Staff can manage document requirements"
ON university_document_requirements FOR ALL
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'document_handler'));

-- RLS for student_achievements
CREATE POLICY "Students can view own achievements"
ON student_achievements FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Students can earn achievements"
ON student_achievements FOR INSERT
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Staff can view all achievements"
ON student_achievements FOR SELECT
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'));

-- RLS for writing_streaks
CREATE POLICY "Students can view own streaks"
ON writing_streaks FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Students can update own streaks"
ON writing_streaks FOR INSERT
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can modify own streaks"
ON writing_streaks FOR UPDATE
USING (auth.uid() = student_id);

CREATE POLICY "Staff can view all streaks"
ON writing_streaks FOR SELECT
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'));

-- RLS for peer_reviews
CREATE POLICY "Authors can view own reviews received"
ON peer_reviews FOR SELECT
USING (auth.uid() = author_id);

CREATE POLICY "Reviewers can view assigned reviews"
ON peer_reviews FOR SELECT
USING (auth.uid() = reviewer_id);

CREATE POLICY "Authors can request reviews"
ON peer_reviews FOR INSERT
WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Reviewers can update assigned reviews"
ON peer_reviews FOR UPDATE
USING (auth.uid() = reviewer_id);

CREATE POLICY "Staff can manage all reviews"
ON peer_reviews FOR ALL
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'));

-- RLS for peer_review_queue
CREATE POLICY "Students can add to queue"
ON peer_review_queue FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM study_plan_drafts d
  JOIN study_plan_sessions s ON d.session_id = s.id
  WHERE d.id = draft_id AND s.student_id = auth.uid()
));

CREATE POLICY "Students can view queue"
ON peer_review_queue FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can manage queue"
ON peer_review_queue FOR ALL
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'));

-- Enable realtime for peer_reviews
ALTER PUBLICATION supabase_realtime ADD TABLE peer_reviews;