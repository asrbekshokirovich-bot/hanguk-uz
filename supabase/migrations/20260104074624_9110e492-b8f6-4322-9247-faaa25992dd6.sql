-- Create universities table
CREATE TABLE public.universities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_uz TEXT NOT NULL,
    name_ko TEXT,
    name_ru TEXT,
    name_en TEXT,
    city_uz TEXT,
    city_ko TEXT,
    city_ru TEXT,
    city_en TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    website TEXT,
    logo_url TEXT,
    description_uz TEXT,
    description_ko TEXT,
    description_ru TEXT,
    description_en TEXT,
    tuition_min INTEGER,
    tuition_max INTEGER,
    ranking INTEGER,
    acceptance_rate DECIMAL(5, 2),
    is_partner BOOLEAN DEFAULT false,
    programs TEXT[],
    requirements_uz TEXT,
    requirements_ko TEXT,
    requirements_ru TEXT,
    requirements_en TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on universities
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;

-- Universities are public to read
CREATE POLICY "Universities are viewable by everyone"
ON public.universities
FOR SELECT
USING (true);

-- Only admins/owners can manage universities
CREATE POLICY "Admins can manage universities"
ON public.universities
FOR ALL
USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

-- Create applications table
CREATE TABLE public.applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    university_id UUID REFERENCES public.universities(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'documents_collection',
    status_history JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE,
    decision_at TIMESTAMP WITH TIME ZONE,
    decision TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(student_id, university_id)
);

-- Enable RLS on applications
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Students can view their own applications
CREATE POLICY "Students can view their own applications"
ON public.applications
FOR SELECT
USING (auth.uid() = student_id);

-- Staff can view all applications
CREATE POLICY "Staff can view all applications"
ON public.applications
FOR SELECT
USING (
    public.has_role(auth.uid(), 'owner') OR 
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'call_operator') OR 
    public.has_role(auth.uid(), 'document_handler')
);

-- Staff can manage applications
CREATE POLICY "Staff can manage applications"
ON public.applications
FOR ALL
USING (
    public.has_role(auth.uid(), 'owner') OR 
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'document_handler')
);

-- Create documents table
CREATE TABLE public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    status TEXT NOT NULL DEFAULT 'uploaded',
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Students can view their own documents
CREATE POLICY "Students can view their own documents"
ON public.documents
FOR SELECT
USING (auth.uid() = student_id);

-- Students can upload their own documents
CREATE POLICY "Students can upload their own documents"
ON public.documents
FOR INSERT
WITH CHECK (auth.uid() = student_id);

-- Staff can view all documents
CREATE POLICY "Staff can view all documents"
ON public.documents
FOR SELECT
USING (
    public.has_role(auth.uid(), 'owner') OR 
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'document_handler')
);

-- Staff can manage documents
CREATE POLICY "Staff can manage documents"
ON public.documents
FOR ALL
USING (
    public.has_role(auth.uid(), 'owner') OR 
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'document_handler')
);

-- Create storage bucket for student documents
INSERT INTO storage.buckets (id, name, public) VALUES ('student-documents', 'student-documents', false);

-- Storage policies for student documents
CREATE POLICY "Students can upload their own documents"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'student-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Students can view their own documents"
ON storage.objects
FOR SELECT
USING (bucket_id = 'student-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Students can delete their own documents"
ON storage.objects
FOR DELETE
USING (bucket_id = 'student-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Staff can view all student documents"
ON storage.objects
FOR SELECT
USING (
    bucket_id = 'student-documents' AND (
        public.has_role(auth.uid(), 'owner') OR 
        public.has_role(auth.uid(), 'admin') OR 
        public.has_role(auth.uid(), 'document_handler')
    )
);

-- Add triggers for updated_at
CREATE TRIGGER update_universities_updated_at
BEFORE UPDATE ON public.universities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_applications_updated_at
BEFORE UPDATE ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample Korean universities
INSERT INTO public.universities (name_uz, name_ko, name_ru, name_en, city_uz, city_ko, city_ru, city_en, latitude, longitude, tuition_min, tuition_max, ranking, acceptance_rate, is_partner, programs) VALUES
('Seoul Milliy Universiteti', '서울대학교', 'Сеульский национальный университет', 'Seoul National University', 'Seul', '서울', 'Сеул', 'Seoul', 37.4597, 126.9527, 3000, 6000, 1, 15.5, true, ARRAY['Engineering', 'Business', 'Medicine', 'Arts']),
('Korea Universiteti', '고려대학교', 'Университет Корё', 'Korea University', 'Seul', '서울', 'Сеул', 'Seoul', 37.5895, 127.0322, 4000, 7000, 2, 20.0, true, ARRAY['Engineering', 'Business', 'Law', 'Computer Science']),
('Yonsei Universiteti', '연세대학교', 'Университет Ёнсе', 'Yonsei University', 'Seul', '서울', 'Сеул', 'Seoul', 37.5665, 126.9385, 4000, 7500, 3, 18.5, true, ARRAY['Medicine', 'Engineering', 'Business', 'International Studies']),
('KAIST', '한국과학기술원', 'КАИСТ', 'KAIST', 'Daejon', '대전', 'Тэджон', 'Daejeon', 36.3701, 127.3604, 3500, 5500, 4, 12.0, false, ARRAY['Engineering', 'Science', 'Technology', 'AI']),
('Sungkyunkwan Universiteti', '성균관대학교', 'Университет Сонгюнгван', 'Sungkyunkwan University', 'Seul', '서울', 'Сеул', 'Seoul', 37.5874, 126.9929, 4500, 8000, 5, 22.0, true, ARRAY['Business', 'Engineering', 'Medicine', 'Humanities']),
('Hanyang Universiteti', '한양대학교', 'Университет Ханьян', 'Hanyang University', 'Seul', '서울', 'Сеул', 'Seoul', 37.5574, 127.0446, 4000, 7000, 6, 25.0, true, ARRAY['Engineering', 'Architecture', 'Business', 'Arts']),
('POSTECH', '포항공과대학교', 'ПОСТЕХ', 'POSTECH', 'Pohang', '포항', 'Пхохан', 'Pohang', 36.0102, 129.3213, 3000, 5000, 7, 10.0, false, ARRAY['Engineering', 'Science', 'Technology']),
('Ewha Womans Universiteti', '이화여자대학교', 'Женский университет Ихва', 'Ewha Womans University', 'Seul', '서울', 'Сеул', 'Seoul', 37.5618, 126.9465, 4000, 6500, 8, 28.0, true, ARRAY['Liberal Arts', 'Business', 'Medicine', 'Arts']),
('Busan Milliy Universiteti', '부산대학교', 'Пусанский национальный университет', 'Pusan National University', 'Busan', '부산', 'Пусан', 'Busan', 35.2333, 129.0794, 2500, 5000, 10, 30.0, true, ARRAY['Engineering', 'Marine Science', 'Business', 'Arts']),
('Kyung Hee Universiteti', '경희대학교', 'Университет Кёнхи', 'Kyung Hee University', 'Seul', '서울', 'Сеул', 'Seoul', 37.5973, 127.0512, 4000, 7000, 11, 26.0, true, ARRAY['Medicine', 'International Studies', 'Hotel Management', 'Arts']);