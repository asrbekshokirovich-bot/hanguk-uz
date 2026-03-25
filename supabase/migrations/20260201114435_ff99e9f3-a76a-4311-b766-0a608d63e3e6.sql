-- Create study_plan_sessions table
CREATE TABLE public.study_plan_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('study_plan', 'personal_statement')),
  target_university_id UUID REFERENCES public.universities(id) ON DELETE SET NULL,
  current_step INTEGER NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 1 AND 4),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create study_plan_drafts table
CREATE TABLE public.study_plan_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.study_plan_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  word_count INTEGER,
  source TEXT NOT NULL DEFAULT 'typed' CHECK (source IN ('typed', 'uploaded', 'ai_generated')),
  file_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create study_plan_analyses table
CREATE TABLE public.study_plan_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.study_plan_sessions(id) ON DELETE CASCADE,
  draft_id UUID NOT NULL REFERENCES public.study_plan_drafts(id) ON DELETE CASCADE,
  overall_score INTEGER CHECK (overall_score BETWEEN 1 AND 10),
  grammar_errors JSONB DEFAULT '[]'::jsonb,
  content_feedback TEXT,
  strengths JSONB DEFAULT '[]'::jsonb,
  improvements JSONB DEFAULT '[]'::jsonb,
  ai_response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create study_plan_chat_history table
CREATE TABLE public.study_plan_chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.study_plan_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.study_plan_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_plan_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_plan_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_plan_chat_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for study_plan_sessions
CREATE POLICY "Students can view own sessions" ON public.study_plan_sessions
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Students can create own sessions" ON public.study_plan_sessions
  FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update own sessions" ON public.study_plan_sessions
  FOR UPDATE USING (auth.uid() = student_id);

CREATE POLICY "Students can delete own sessions" ON public.study_plan_sessions
  FOR DELETE USING (auth.uid() = student_id);

-- RLS Policies for study_plan_drafts
CREATE POLICY "Students can view own drafts" ON public.study_plan_drafts
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Students can create own drafts" ON public.study_plan_drafts
  FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update own drafts" ON public.study_plan_drafts
  FOR UPDATE USING (auth.uid() = student_id);

CREATE POLICY "Students can delete own drafts" ON public.study_plan_drafts
  FOR DELETE USING (auth.uid() = student_id);

-- RLS Policies for study_plan_analyses
CREATE POLICY "Students can view own analyses" ON public.study_plan_analyses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.study_plan_sessions s 
      WHERE s.id = study_plan_analyses.session_id 
      AND s.student_id = auth.uid()
    )
  );

CREATE POLICY "Students can create analyses for own sessions" ON public.study_plan_analyses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.study_plan_sessions s 
      WHERE s.id = study_plan_analyses.session_id 
      AND s.student_id = auth.uid()
    )
  );

-- RLS Policies for study_plan_chat_history
CREATE POLICY "Students can view own chat history" ON public.study_plan_chat_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.study_plan_sessions s 
      WHERE s.id = study_plan_chat_history.session_id 
      AND s.student_id = auth.uid()
    )
  );

CREATE POLICY "Students can create chat messages for own sessions" ON public.study_plan_chat_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.study_plan_sessions s 
      WHERE s.id = study_plan_chat_history.session_id 
      AND s.student_id = auth.uid()
    )
  );

-- Create indexes for better query performance
CREATE INDEX idx_study_plan_sessions_student_id ON public.study_plan_sessions(student_id);
CREATE INDEX idx_study_plan_sessions_status ON public.study_plan_sessions(status);
CREATE INDEX idx_study_plan_drafts_session_id ON public.study_plan_drafts(session_id);
CREATE INDEX idx_study_plan_drafts_student_id ON public.study_plan_drafts(student_id);
CREATE INDEX idx_study_plan_analyses_session_id ON public.study_plan_analyses(session_id);
CREATE INDEX idx_study_plan_analyses_draft_id ON public.study_plan_analyses(draft_id);
CREATE INDEX idx_study_plan_chat_history_session_id ON public.study_plan_chat_history(session_id);

-- Create trigger for updated_at on sessions
CREATE TRIGGER update_study_plan_sessions_updated_at
  BEFORE UPDATE ON public.study_plan_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();