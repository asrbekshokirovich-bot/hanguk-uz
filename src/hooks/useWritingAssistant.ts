import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export interface WritingSuggestion {
  type: 'vocabulary' | 'grammar' | 'style' | 'structure';
  original: string;
  suggestion: string;
  reason: string;
}

export interface SectionProgress {
  id: string;
  name: string;
  detected: boolean;
  keywords: string[];
}

export interface WritingAssistantState {
  formalityScore: number;
  wordCount: number;
  characterCount: number;
  sentenceCount: number;
  paragraphCount: number;
  avgSentenceLength: number;
  avgWordLength: number;
  suggestions: WritingSuggestion[];
  sectionCompletion: SectionProgress[];
  readabilityLevel: 'easy' | 'moderate' | 'advanced';
  isAnalyzing: boolean;
}

// Common weak words to suggest alternatives for
const weakWordsMap: Record<string, string[]> = {
  'good': ['excellent', 'outstanding', 'remarkable', 'exceptional'],
  'bad': ['inadequate', 'poor', 'unsatisfactory', 'substandard'],
  'very': ['extremely', 'remarkably', 'exceptionally', 'highly'],
  'really': ['genuinely', 'truly', 'particularly', 'especially'],
  'nice': ['pleasant', 'delightful', 'wonderful', 'admirable'],
  'big': ['significant', 'substantial', 'considerable', 'extensive'],
  'small': ['minor', 'modest', 'limited', 'compact'],
  'thing': ['aspect', 'element', 'factor', 'component'],
  'things': ['aspects', 'elements', 'factors', 'components'],
  'get': ['obtain', 'acquire', 'receive', 'achieve'],
  'got': ['obtained', 'acquired', 'received', 'achieved'],
  'make': ['create', 'develop', 'establish', 'produce'],
  'want': ['desire', 'aspire', 'seek', 'aim'],
  'like': ['appreciate', 'enjoy', 'admire', 'prefer'],
  'a lot': ['considerably', 'significantly', 'extensively', 'substantially'],
};

// Required sections for study plans
const studyPlanSections: SectionProgress[] = [
  { id: 'intro', name: 'Introduction', detected: false, keywords: ['my name', 'i am', 'introduction', '자기소개', '저는'] },
  { id: 'why_korea', name: 'Why Korea', detected: false, keywords: ['why korea', 'korean culture', 'south korea', '한국을 선택', '왜 한국'] },
  { id: 'why_university', name: 'Why This University', detected: false, keywords: ['university', 'chose this', 'selected', '대학교', '이 대학'] },
  { id: 'study_goals', name: 'Study Goals', detected: false, keywords: ['study goal', 'academic goal', 'learn', 'research', '학업 목표', '공부'] },
  { id: 'career_plans', name: 'Career Plans', detected: false, keywords: ['career', 'future plan', 'after graduation', 'profession', '진로', '졸업 후'] },
  { id: 'conclusion', name: 'Conclusion', detected: false, keywords: ['in conclusion', 'finally', 'thank you', 'opportunity', '결론', '감사'] },
];

// Personal statement sections
const personalStatementSections: SectionProgress[] = [
  { id: 'background', name: 'Personal Background', detected: false, keywords: ['grew up', 'childhood', 'family', 'background', '성장', '가족'] },
  { id: 'motivation', name: 'Motivation', detected: false, keywords: ['motivation', 'inspired', 'passion', 'interest', '동기', '열정'] },
  { id: 'experience', name: 'Relevant Experience', detected: false, keywords: ['experience', 'worked', 'project', 'participated', '경험', '프로젝트'] },
  { id: 'skills', name: 'Skills & Strengths', detected: false, keywords: ['skill', 'strength', 'ability', 'capable', '능력', '강점'] },
  { id: 'goals', name: 'Future Goals', detected: false, keywords: ['goal', 'dream', 'aspire', 'future', '목표', '꿈'] },
  { id: 'fit', name: 'Why You\'re a Good Fit', detected: false, keywords: ['fit', 'contribute', 'bring', 'offer', '적합', '기여'] },
];

export function useWritingAssistant(
  content: string,
  documentType: 'study_plan' | 'personal_statement' = 'study_plan',
  debounceMs: number = 500
) {
  const { t } = useTranslation();
  const [state, setState] = useState<WritingAssistantState>({
    formalityScore: 0,
    wordCount: 0,
    characterCount: 0,
    sentenceCount: 0,
    paragraphCount: 0,
    avgSentenceLength: 0,
    avgWordLength: 0,
    suggestions: [],
    sectionCompletion: documentType === 'study_plan' ? studyPlanSections : personalStatementSections,
    readabilityLevel: 'moderate',
    isAnalyzing: false,
  });

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const analyzeContent = useCallback((text: string) => {
    if (!text.trim()) {
      setState(prev => ({
        ...prev,
        formalityScore: 0,
        wordCount: 0,
        characterCount: 0,
        sentenceCount: 0,
        paragraphCount: 0,
        avgSentenceLength: 0,
        avgWordLength: 0,
        suggestions: [],
        sectionCompletion: (documentType === 'study_plan' ? studyPlanSections : personalStatementSections)
          .map(s => ({ ...s, detected: false })),
        readabilityLevel: 'moderate',
        isAnalyzing: false,
      }));
      return;
    }

    setState(prev => ({ ...prev, isAnalyzing: true }));

    // Basic metrics
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    const characterCount = text.length;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const sentenceCount = sentences.length;
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
    const paragraphCount = paragraphs.length || 1;

    const avgSentenceLength = sentenceCount > 0 ? Math.round(wordCount / sentenceCount) : 0;
    const avgWordLength = wordCount > 0 
      ? Math.round((words.reduce((sum, w) => sum + w.length, 0) / wordCount) * 10) / 10 
      : 0;

    // Formality analysis
    const informalPatterns = [
      /\bi'm\b/gi, /\bdon't\b/gi, /\bcan't\b/gi, /\bwon't\b/gi,
      /\bwanna\b/gi, /\bgonna\b/gi, /\bgotta\b/gi,
      /!!+/g, /\?{2,}/g, /\.{3,}/g,
      /\blol\b/gi, /\bomg\b/gi, /\bbtw\b/gi,
    ];
    
    const formalPatterns = [
      /\bfurthermore\b/gi, /\bmoreover\b/gi, /\bhowever\b/gi,
      /\btherefore\b/gi, /\bconsequently\b/gi, /\bnevertheless\b/gi,
      /\bin addition\b/gi, /\bas a result\b/gi, /\bin conclusion\b/gi,
    ];

    let formalScore = 5; // Start at neutral
    informalPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) formalScore -= matches.length * 0.5;
    });
    formalPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) formalScore += matches.length * 0.5;
    });
    
    // Adjust based on sentence structure
    if (avgSentenceLength > 15 && avgSentenceLength < 25) formalScore += 1;
    if (avgWordLength > 5) formalScore += 0.5;
    
    const formalityScore = Math.max(1, Math.min(10, Math.round(formalScore)));

    // Vocabulary suggestions
    const suggestions: WritingSuggestion[] = [];
    const lowerText = text.toLowerCase();
    
    Object.entries(weakWordsMap).forEach(([weak, alternatives]) => {
      const regex = new RegExp(`\\b${weak}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches && matches.length > 0) {
        suggestions.push({
          type: 'vocabulary',
          original: weak,
          suggestion: alternatives.slice(0, 2).join(' or '),
          reason: `"${weak}" is informal. Consider: ${alternatives.slice(0, 3).join(', ')}`,
        });
      }
    });

    // Long sentence warnings
    sentences.forEach((sentence, i) => {
      const sentenceWords = sentence.split(/\s+/).filter(w => w.length > 0);
      if (sentenceWords.length > 40) {
        suggestions.push({
          type: 'style',
          original: sentence.substring(0, 50) + '...',
          suggestion: 'Break into shorter sentences',
          reason: `Sentence ${i + 1} has ${sentenceWords.length} words. Consider breaking it up.`,
        });
      }
    });

    // Section detection
    const sections = documentType === 'study_plan' ? studyPlanSections : personalStatementSections;
    const sectionCompletion = sections.map(section => ({
      ...section,
      detected: section.keywords.some(keyword => 
        lowerText.includes(keyword.toLowerCase())
      ),
    }));

    // Readability level
    let readabilityLevel: 'easy' | 'moderate' | 'advanced' = 'moderate';
    if (avgSentenceLength < 12 && avgWordLength < 4.5) readabilityLevel = 'easy';
    if (avgSentenceLength > 20 && avgWordLength > 5.5) readabilityLevel = 'advanced';

    setState({
      formalityScore,
      wordCount,
      characterCount,
      sentenceCount,
      paragraphCount,
      avgSentenceLength,
      avgWordLength,
      suggestions: suggestions.slice(0, 10), // Limit suggestions
      sectionCompletion,
      readabilityLevel,
      isAnalyzing: false,
    });
  }, [documentType]);

  // Debounced analysis
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      analyzeContent(content);
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [content, analyzeContent, debounceMs]);

  const completedSections = useMemo(() => 
    state.sectionCompletion.filter(s => s.detected).length,
    [state.sectionCompletion]
  );

  const sectionCompletionPercentage = useMemo(() => 
    Math.round((completedSections / state.sectionCompletion.length) * 100),
    [completedSections, state.sectionCompletion.length]
  );

  return {
    ...state,
    completedSections,
    sectionCompletionPercentage,
  };
}
