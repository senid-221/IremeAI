-- Ireme AI education knowledge base: source registry, searchable document chunks and seed subjects.
-- Apply after 001_initial_schema.sql, 002_learning_persistence_indexes.sql and 003_student_library_and_schedule.sql.
CREATE TABLE IF NOT EXISTS education_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  publisher TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('curriculum','textbook','teacher_guide','past_exam','assessment','school_directory','tvet_module','official_notice','other')),
  education_level TEXT,
  subject_name TEXT,
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en','rw','fr')),
  academic_year TEXT,
  source_url TEXT NOT NULL,
  file_url TEXT,
  is_official BOOLEAN NOT NULL DEFAULT false,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','rejected','archived')),
  published_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (publisher, title, source_url)
);
CREATE TABLE IF NOT EXISTS education_document_chunks (
  id BIGSERIAL PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES education_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  heading TEXT,
  content TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en','rw','fr')),
  grade_level TEXT,
  subject_name TEXT,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(heading,'') || ' ' || coalesce(subject_name,'') || ' ' || content)
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(document_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS education_documents_filter_idx ON education_documents(verification_status, document_type, education_level, subject_name);
CREATE INDEX IF NOT EXISTS education_chunks_search_idx ON education_document_chunks USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS education_chunks_grade_subject_idx ON education_document_chunks(grade_level, subject_name);

INSERT INTO subjects(name,name_rw,description) VALUES
('Mathematics','Imibare','Mathematics across Rwanda education levels'),
('Kinyarwanda','Ikinyarwanda','Kinyarwanda language and literacy'),
('English','Icyongereza','English language and literacy'),
('French','Igifaransa','French language'),
('Kiswahili','Igiswahili','Kiswahili language'),
('Physics','Ubugenge','Physics and physical sciences'),
('Chemistry','Ubutabire','Chemistry'),
('Biology','Ubugenge bw’ibinyabuzima','Biology and life sciences'),
('General Science','Ubumenyi rusange','Integrated science'),
('Social Studies','Amateka n’Imibereho y’Abaturage','Social studies and history/geography'),
('Geography','Ubumenyi bw’Isi','Geography'),
('History','Amateka','History'),
('Entrepreneurship','Kwihangira imirimo','Entrepreneurship and business'),
('ICT','Ikoranabuhanga','Information and communication technology'),
('Computer Science','Ubumenyi bwa mudasobwa','Computing, coding and software'),
('Fine Art','Ubugeni','Fine art and visual arts'),
('Music','Umuziki','Music and performing arts'),
('Agriculture','Ubuhinzi','Agriculture and food production'),
('Technical and Vocational Education','Imyuga n’ubumenyingiro','TVET programmes and practical skills'),
('Physical Education','Imikino n’imyitozo ngororamubiri','Physical education and sport')
ON CONFLICT (name) DO NOTHING;

INSERT INTO education_documents(title,publisher,document_type,education_level,source_url,file_url,is_official,verification_status,language)
VALUES
('REB Curriculum, Teaching and Learning Resources','Rwanda Basic Education Board','curriculum','Nursery, Primary, Secondary','https://www.reb.gov.rw/curriculum-teaching-learning-resources-department','https://www.reb.gov.rw/curriculum-teaching-learning-resources-department',true,'verified','en'),
('REB E-Learning: Textbooks and lessons','Rwanda Basic Education Board','textbook','Primary, Secondary','https://elearning.reb.rw/','https://elearning.reb.rw/',true,'verified','en'),
('REB official publications','Rwanda Basic Education Board','teacher_guide','Basic Education','https://www.reb.gov.rw/publications','https://www.reb.gov.rw/publications',true,'verified','en'),
('NESA official resources and assessment materials','National Examination and School Inspection Authority','assessment','Primary, Secondary','https://www.nesa.gov.rw/1/resources','https://www.nesa.gov.rw/1/resources',true,'verified','en'),
('NESA official website and notices','National Examination and School Inspection Authority','official_notice','National examinations','https://www.nesa.gov.rw/','https://www.nesa.gov.rw/',true,'verified','en'),
('RTB TVET curricula by qualification level','Rwanda TVET Board','tvet_module','TVET Levels 1–5','https://tvetmanagement.rtb.gov.rw/curricula','https://tvetmanagement.rtb.gov.rw/curricula',true,'verified','en'),
('RTB published curricula portal','Rwanda TVET Board','tvet_module','TVET Levels 1–5','https://curricula.rtb.gov.rw/','https://curricula.rtb.gov.rw/',true,'verified','en'),
('RTB E-Learning courses','Rwanda TVET Board','tvet_module','TVET Levels 1–5','https://www.elearning.rtb.gov.rw/course/index.php?categoryid=4','https://www.elearning.rtb.gov.rw/course/index.php?categoryid=4',true,'verified','en'),
('RTB official publications and PDF guides','Rwanda TVET Board','teacher_guide','TVET','https://www.rtb.gov.rw/publications','https://www.rtb.gov.rw/publications',true,'verified','en'),
('Rwanda Schools Directory','Rwanda Schools Directory','school_directory','Nursery through university','https://www.rwandaschoolsdirectory.rw/','https://www.rwandaschoolsdirectory.rw/',false,'pending','rw'),
('Rwanda national examination past papers directory','National Examination Questions and Answers portal','past_exam','Primary and Secondary','https://nationalexamination.rw/?taxonomy=nav_menu&term=past-papers','https://nationalexamination.rw/?taxonomy=nav_menu&term=past-papers',false,'pending','en')
ON CONFLICT (publisher,title,source_url) DO NOTHING;

-- Seed concise, source-linked index records. Full PDFs must be ingested and checked before
-- their contents can be used as official document excerpts.
INSERT INTO education_document_chunks(document_id,chunk_index,heading,content,language,grade_level,subject_name)
SELECT id,0,'Scope and official source',
CASE
 WHEN publisher='Rwanda Basic Education Board' AND document_type='curriculum' THEN 'REB is the official source for Rwanda basic education curricula, teaching and learning materials, teacher guides and methodologies for nursery, primary, secondary, specialised and adult literacy education. Open the source URL to verify the exact grade, subject and school-year document.'
 WHEN publisher='Rwanda Basic Education Board' AND document_type='textbook' THEN 'REB E-Learning is the official online learning platform for basic education books and learning content. Open the source URL to locate the current textbook or lesson. This index entry does not contain the full book text.'
 WHEN publisher='Rwanda Basic Education Board' THEN 'REB official publications page. Check the actual publication date and document before citing requirements or using its contents.'
 WHEN publisher='National Examination and School Inspection Authority' AND document_type='assessment' THEN 'NESA official resources for assessment standards, examination guidance and published resources. Verify the exact examination level, year and subject in the original document. This index entry is not itself a past paper.'
 WHEN publisher='National Examination and School Inspection Authority' THEN 'NESA official website for official notices and examination updates. Do not infer current dates or rules without opening the relevant notice.'
 WHEN publisher='Rwanda TVET Board' AND document_type='tvet_module' THEN 'RTB is the official source for technical and vocational education and training curricula, modules and qualification levels 1 to 5. Select the appropriate level, sector, trade and school year in the original portal.'
 WHEN publisher='Rwanda TVET Board' THEN 'RTB publications page can contain trainer guides, TVET frameworks, timetables and official PDF documents. Confirm the publication and date on the source page.'
 ELSE 'A directory that may help locate education institutions or examination resources. Treat records as unverified until the institution or source details are confirmed.'
END,
'en',education_level,NULL
FROM education_documents d
WHERE NOT EXISTS (SELECT 1 FROM education_document_chunks c WHERE c.document_id=d.id);

