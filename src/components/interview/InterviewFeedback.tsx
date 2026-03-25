import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, 
  Shield, 
  FileText, 
  Languages, 
  Star,
  TrendingUp,
  AlertCircle,
  RotateCcw,
  Home
} from 'lucide-react';

interface MessageScore {
  message_id: string;
  score: number;
  strengths: string[];
  suggestions: string[];
  ideal_hint?: string;
}

interface FeedbackData {
  communication_score: number;
  confidence_score: number;
  content_score: number;
  language_score: number;
  overall_score: number;
  strengths: string[];
  improvements: string[];
  detailed_feedback: string;
  message_scores?: MessageScore[];
}

interface InterviewFeedbackProps {
  feedback: FeedbackData;
  onPracticeAgain: () => void;
  onGoHome: () => void;
}

export function InterviewFeedback({ 
  feedback, 
  onPracticeAgain, 
  onGoHome 
}: InterviewFeedbackProps) {
  const { t } = useTranslation();

  const scoreCategories = [
    { 
      key: 'communication', 
      label: t('interview.communication', 'Communication'),
      score: feedback.communication_score,
      icon: MessageSquare,
      color: 'text-blue-500'
    },
    { 
      key: 'confidence', 
      label: t('interview.confidence', 'Confidence'),
      score: feedback.confidence_score,
      icon: Shield,
      color: 'text-green-500'
    },
    { 
      key: 'content', 
      label: t('interview.content', 'Content Quality'),
      score: feedback.content_score,
      icon: FileText,
      color: 'text-purple-500'
    },
    { 
      key: 'language', 
      label: t('interview.language', 'Language'),
      score: feedback.language_score,
      icon: Languages,
      color: 'text-orange-500'
    },
  ];

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-500';
    if (score >= 6) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 9) return t('interview.excellent', 'Excellent');
    if (score >= 7) return t('interview.good', 'Good');
    if (score >= 5) return t('interview.average', 'Average');
    return t('interview.needsWork', 'Needs Work');
  };

  return (
    <div className="space-y-6 p-4 max-w-2xl mx-auto">
      {/* Overall Score Card */}
      <Card className="border-2">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-lg">
            {t('interview.overallScore', 'Overall Score')}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <div className="relative inline-flex items-center justify-center">
            <div className="text-6xl font-bold">
              <span className={getScoreColor(feedback.overall_score)}>
                {feedback.overall_score}
              </span>
              <span className="text-2xl text-muted-foreground">/10</span>
            </div>
          </div>
          <Badge 
            variant="secondary" 
            className="mt-2 text-base px-4 py-1"
          >
            {getScoreLabel(feedback.overall_score)}
          </Badge>
        </CardContent>
      </Card>

      {/* Category Scores */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4" />
            {t('interview.categoryScores', 'Category Scores')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {scoreCategories.map((category) => (
            <div key={category.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <category.icon className={`h-4 w-4 ${category.color}`} />
                  <span className="text-sm font-medium">{category.label}</span>
                </div>
                <span className={`font-bold ${getScoreColor(category.score)}`}>
                  {category.score}/10
                </span>
              </div>
              <Progress 
                value={category.score * 10} 
                className="h-2"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Strengths */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-green-600">
            <TrendingUp className="h-4 w-4" />
            {t('interview.strengths', 'Your Strengths')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {feedback.strengths.map((strength, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span className="text-sm">{strength}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Areas for Improvement */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-yellow-600">
            <AlertCircle className="h-4 w-4" />
            {t('interview.improvements', 'Areas to Improve')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {feedback.improvements.map((improvement, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-yellow-500 mt-0.5">→</span>
                <span className="text-sm">{improvement}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Detailed Feedback */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('interview.detailedFeedback', 'Detailed Feedback')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {feedback.detailed_feedback}
          </p>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <Button 
          variant="outline" 
          className="flex-1"
          onClick={onGoHome}
        >
          <Home className="h-4 w-4 mr-2" />
          {t('navigation.home', 'Home')}
        </Button>
        <Button 
          className="flex-1"
          onClick={onPracticeAgain}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          {t('interview.practiceAgain', 'Practice Again')}
        </Button>
      </div>
    </div>
  );
}
