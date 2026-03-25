-- Create interview_sessions table
CREATE TABLE public.interview_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  session_type TEXT NOT NULL DEFAULT 'general' CHECK (session_type IN ('general', 'university_specific', 'visa')),
  target_university_id UUID REFERENCES public.universities(id),
  heygen_session_id TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create interview_messages table
CREATE TABLE public.interview_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('interviewer', 'student')),
  content TEXT NOT NULL,
  audio_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create interview_feedback table
CREATE TABLE public.interview_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL UNIQUE REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
  communication_score INTEGER CHECK (communication_score >= 1 AND communication_score <= 10),
  confidence_score INTEGER CHECK (confidence_score >= 1 AND confidence_score <= 10),
  content_score INTEGER CHECK (content_score >= 1 AND content_score <= 10),
  language_score INTEGER CHECK (language_score >= 1 AND language_score <= 10),
  overall_score INTEGER CHECK (overall_score >= 1 AND overall_score <= 10),
  strengths JSONB DEFAULT '[]'::jsonb,
  improvements JSONB DEFAULT '[]'::jsonb,
  detailed_feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create interview_questions table
CREATE TABLE public.interview_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('motivation', 'academic', 'personal', 'visa', 'university_specific')),
  difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  question_ko TEXT NOT NULL,
  question_en TEXT,
  question_uz TEXT,
  question_ru TEXT,
  sample_answer TEXT,
  tips TEXT,
  university_id UUID REFERENCES public.universities(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_questions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for interview_sessions
CREATE POLICY "Students can view their own sessions"
  ON public.interview_sessions FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Students can create their own sessions"
  ON public.interview_sessions FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update their own sessions"
  ON public.interview_sessions FOR UPDATE
  USING (auth.uid() = student_id);

-- RLS Policies for interview_messages
CREATE POLICY "Students can view messages from their sessions"
  ON public.interview_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.interview_sessions 
    WHERE id = interview_messages.session_id 
    AND student_id = auth.uid()
  ));

CREATE POLICY "Students can insert messages to their sessions"
  ON public.interview_messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.interview_sessions 
    WHERE id = interview_messages.session_id 
    AND student_id = auth.uid()
  ));

-- RLS Policies for interview_feedback
CREATE POLICY "Students can view feedback for their sessions"
  ON public.interview_feedback FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.interview_sessions 
    WHERE id = interview_feedback.session_id 
    AND student_id = auth.uid()
  ));

CREATE POLICY "System can insert feedback"
  ON public.interview_feedback FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.interview_sessions 
    WHERE id = interview_feedback.session_id 
    AND student_id = auth.uid()
  ));

-- RLS Policies for interview_questions (readable by all authenticated users)
CREATE POLICY "Authenticated users can read active questions"
  ON public.interview_questions FOR SELECT
  USING (is_active = true);

-- Staff can manage questions
CREATE POLICY "Staff can manage questions"
  ON public.interview_questions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid()
  ));

-- Create indexes for performance
CREATE INDEX idx_interview_sessions_student_id ON public.interview_sessions(student_id);
CREATE INDEX idx_interview_sessions_status ON public.interview_sessions(status);
CREATE INDEX idx_interview_messages_session_id ON public.interview_messages(session_id);
CREATE INDEX idx_interview_questions_category ON public.interview_questions(category);
CREATE INDEX idx_interview_questions_university_id ON public.interview_questions(university_id);