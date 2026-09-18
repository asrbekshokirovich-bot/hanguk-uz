-- Data-collection field types for surveys.
--
-- The survey builder only offered quiz-shaped questions (single/multiple
-- choice, rating) plus one generic text box. Staff actually use surveys to
-- collect student records — email, address, zip code, dormitory, each
-- parent's occupation and phone — so the answers need typed fields that
-- validate and open the right mobile keyboard.
--
-- Widening the CHECK only; the existing four types keep working and no rows
-- change. `options` stays null for every one of these, same as 'text'.

ALTER TABLE public.survey_questions
  DROP CONSTRAINT survey_questions_question_type_check;

ALTER TABLE public.survey_questions
  ADD CONSTRAINT survey_questions_question_type_check
  CHECK (question_type IN (
    'single_choice',
    'multiple_choice',
    'text',
    'rating',
    'email',
    'phone',
    'number',
    'long_text',
    'date'
  ));
