import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  Briefcase, GraduationCap, Users, MapPin, 
  ChevronRight, Sparkles, Building
} from 'lucide-react';

export interface StudentPreferences {
  studyWorkPriority: 'study' | 'work' | 'balanced';
  hasKoreanConnections: 'yes_family' | 'yes_friends' | 'no';
  preferredRegion: 'seoul' | 'busan' | 'daegu' | 'incheon' | 'no_preference';
  budgetPriority: 'low_tuition' | 'quality' | 'balanced';
  programInterest: 'stem' | 'business' | 'arts' | 'language' | 'other';
}

interface ComparisonQuestionnaireProps {
  onComplete: (preferences: StudentPreferences) => void;
  onSkip: () => void;
}

const questions = [
  {
    id: 'studyWorkPriority',
    icon: Briefcase,
    options: [
      { value: 'study', icon: GraduationCap },
      { value: 'work', icon: Briefcase },
      { value: 'balanced', icon: Building },
    ]
  },
  {
    id: 'hasKoreanConnections',
    icon: Users,
    options: [
      { value: 'yes_family' },
      { value: 'yes_friends' },
      { value: 'no' },
    ]
  },
  {
    id: 'preferredRegion',
    icon: MapPin,
    options: [
      { value: 'seoul' },
      { value: 'busan' },
      { value: 'daegu' },
      { value: 'incheon' },
      { value: 'no_preference' },
    ]
  },
  {
    id: 'budgetPriority',
    icon: Building,
    options: [
      { value: 'low_tuition' },
      { value: 'quality' },
      { value: 'balanced' },
    ]
  },
  {
    id: 'programInterest',
    icon: GraduationCap,
    options: [
      { value: 'stem' },
      { value: 'business' },
      { value: 'arts' },
      { value: 'language' },
      { value: 'other' },
    ]
  },
] as const;

export function ComparisonQuestionnaire({ onComplete, onSkip }: ComparisonQuestionnaireProps) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<StudentPreferences>>({});

  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / questions.length) * 100;
  const isLastQuestion = currentStep === questions.length - 1;

  const handleAnswer = (value: string) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: value
    }));
  };

  const handleNext = () => {
    if (isLastQuestion) {
      onComplete(answers as StudentPreferences);
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const currentAnswer = answers[currentQuestion.id as keyof StudentPreferences];
  const QuestionIcon = currentQuestion.icon;

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between mb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {t('universities.helpUsHelp')}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onSkip} className="text-xs">
            {t('common.skip')}
          </Button>
        </div>
        <Progress value={progress} className="h-1" />
        <p className="text-xs text-muted-foreground mt-2">
          {t('universities.questionProgress', { current: currentStep + 1, total: questions.length })}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <QuestionIcon className="h-5 w-5 text-primary" />
          </div>
          <h3 className="font-medium">
            {t(`universities.questions.${currentQuestion.id}`)}
          </h3>
        </div>

        <RadioGroup 
          value={currentAnswer || ''} 
          onValueChange={handleAnswer}
          className="space-y-2"
        >
          {currentQuestion.options.map(option => (
            <div key={option.value} className="flex items-center space-x-3">
              <RadioGroupItem value={option.value} id={option.value} />
              <Label 
                htmlFor={option.value} 
                className="flex-1 cursor-pointer text-sm py-2"
              >
                {t(`universities.answers.${option.value}`)}
              </Label>
            </div>
          ))}
        </RadioGroup>

        <div className="flex gap-2 mt-4">
          {currentStep > 0 && (
            <Button 
              variant="outline"
              onClick={() => setCurrentStep(prev => prev - 1)}
              className="flex-1"
            >
              {t('common.back', 'Back')}
            </Button>
          )}
          <Button 
            onClick={handleNext}
            disabled={!currentAnswer}
            className="flex-1"
          >
            {isLastQuestion ? (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                {t('universities.startComparison')}
              </>
            ) : (
              <>
                {t('common.next')}
                <ChevronRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
