import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useInterviewSession } from '@/hooks/useInterviewSession';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { VIPAccessGate } from '@/components/interview/VIPAccessGate';
import { InterviewFeedback } from '@/components/interview/InterviewFeedback';
import { InterviewAnalytics } from '@/components/interview/InterviewAnalytics';
import { TranscriptReview } from '@/components/interview/TranscriptReview';
import { AudioInterviewAvatar } from '@/components/interview/AudioInterviewAvatar';
import { ResponseTimer } from '@/components/interview/ResponseTimer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Mic,
  MicOff,
  Square,
  Clock,
  ArrowLeft,
  Loader2,
  Volume2,
  Languages,
  Timer,
  BarChart3,
  Target,
  Circle
} from 'lucide-react';

type SessionType = 'general' | 'university_specific' | 'visa' | 'document_based';
type LanguageTrack = 'korean' | 'english' | 'both';
type FocusTopic = 'all' | 'motivation' | 'academic' | 'career' | 'personal' | 'language';
type ViewState = 'setup' | 'analytics' | 'session' | 'feedback' | 'transcript';

const FOCUS_TOPICS: { value: FocusTopic; labelKey: string }[] = [
  { value: 'all', labelKey: 'interview.allTopics' },
  { value: 'motivation', labelKey: 'interview.topicMotivation' },
  { value: 'academic', labelKey: 'interview.topicAcademic' },
  { value: 'career', labelKey: 'interview.topicCareer' },
  { value: 'personal', labelKey: 'interview.topicPersonal' },
  { value: 'language', labelKey: 'interview.topicLanguage' },
];

const TIME_LIMITS = [
  { value: 30, label: '30s' },
  { value: 60, label: '60s' },
  { value: 90, label: '90s' },
];

export default function InterviewPractice() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [paymentPlan, setPaymentPlan] = useState<string | null>(null);
  const [languageTrack, setLanguageTrack] = useState<LanguageTrack>('korean');
  const [isVIP, setIsVIP] = useState<boolean | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);

  const [viewState, setViewState] = useState<ViewState>('setup');
  const [sessionType, setSessionType] = useState<SessionType>('general');
  const [focusTopic, setFocusTopic] = useState<FocusTopic>('all');
  const [currentLanguage, setCurrentLanguage] = useState<'ko' | 'en'>('ko');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [sessionDuration, setSessionDuration] = useState(0);

  // Timed mode state
  const [timedMode, setTimedMode] = useState(false);
  const [timeLimit, setTimeLimit] = useState(60);
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [isTimerActive, setIsTimerActive] = useState(false);

  // Recording state
  const [recordingEnabled, setRecordingEnabled] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const lastSpokenIdRef = useRef<string>('');
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const {
    session,
    messages,
    feedback,
    isLoading,
    isProcessing,
    error,
    startSession,
    sendMessage,
    endSession,
    resetSession,
  } = useInterviewSession();

  const {
    isRecording,
    startRecording,
    stopRecording,
    uploadRecording,
    cancelRecording,
    resetIndex,
  } = useAudioRecorder({
    sessionId: session?.id,
    userId: user?.id,
    enabled: recordingEnabled,
  });

  // Refs to avoid stale closures in speakWithTTS
  const isRecordingRef = useRef(isRecording);
  const stopRecordingRef = useRef(stopRecording);
  const uploadRecordingRef = useRef(uploadRecording);
  const recordingEnabledRef = useRef(recordingEnabled);
  const isMicEnabledRef = useRef(isMicEnabled);
  const sessionActiveRef = useRef(session?.status === 'active');
  const startListeningRef = useRef<() => void>(() => { });

  useEffect(() => {
    isRecordingRef.current = isRecording;
    stopRecordingRef.current = stopRecording;
    uploadRecordingRef.current = uploadRecording;
    recordingEnabledRef.current = recordingEnabled;
    isMicEnabledRef.current = isMicEnabled;
    sessionActiveRef.current = session?.status === 'active';
  }, [isRecording, stopRecording, uploadRecording, recordingEnabled, isMicEnabled, session?.status]);

  // Check VIP access and get language track
  useEffect(() => {
    async function checkAccess() {
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('payment_plan, language_track')
        .eq('user_id', user.id)
        .single();

      const plan = profile?.payment_plan;
      setPaymentPlan(plan || null);

      const track = (profile?.language_track as LanguageTrack) || 'korean';
      setLanguageTrack(track);
      setCurrentLanguage(track === 'english' ? 'en' : 'ko');

      const vipPlans = ['premium', 'no_risk', 'Premium', 'No Risk', 'NO RISK'];
      setIsVIP(plan ? vipPlans.includes(plan) : false);
      setCheckingAccess(false);
    }

    checkAccess();
  }, [user]);

  // Session timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (session?.status === 'active') {
      interval = setInterval(() => {
        setSessionDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [session?.status]);

  // Response timer logic
  useEffect(() => {
    if (timedMode && isTimerActive && !isSpeaking && session?.status === 'active') {
      timerIntervalRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Timer expired - send timeout message
            clearInterval(timerIntervalRef.current!);
            setIsTimerActive(false);
            toast.warning(t('interview.timeExpired', "Time's up!"));
            sendMessage('[No response - time expired]', sessionType, currentLanguage);
            return timeLimit;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
      };
    }
  }, [timedMode, isTimerActive, isSpeaking, session?.status, timeLimit, sendMessage, sessionType, currentLanguage, t]);

  // Speak with ElevenLabs TTS
  const speakWithTTS = useCallback(async (text: string, messageId: string) => {
    if (!text || messageId === lastSpokenIdRef.current) {
      console.log('[TTS] Skipped — already spoken or empty', { messageId, lastId: lastSpokenIdRef.current });
      return;
    }
    lastSpokenIdRef.current = messageId;
    console.log('[TTS] Starting TTS for message:', messageId, 'text length:', text.length);

    // Stop timer and listening when AI speaks
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setIsTimerActive(false);

    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setIsSpeaking(true);

    // Stop recording if active (using refs to avoid stale closure)
    if (isRecordingRef.current) {
      const result = await stopRecordingRef.current();
      if (result && recordingEnabledRef.current) {
        await uploadRecordingRef.current(result.blob);
      }
    }

    try {
      const voiceId = currentLanguage === 'ko' ? 'cgSgspJ2msm6clMCkdW9' : 'nPczCjzI2devNBz1zQrb';

      console.log('[TTS] Fetching audio from elevenlabs-tts...');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text, voiceId }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[TTS] Error:', response.status, errorText);

        if (response.status === 401 && errorText.includes('detected_unusual_activity')) {
          toast.error('ElevenLabs free tier disabled. Please upgrade to a paid plan.', {
            duration: 10000,
          });
          setIsSpeaking(false);
          return;
        }

        throw new Error(`TTS request failed: ${response.status}`);
      }

      const audioBuffer = await response.arrayBuffer();
      console.log('[TTS] Audio received, size:', audioBuffer.byteLength);

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }

      const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      audioUrlRef.current = audioUrl;

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        console.log('[TTS] Audio playback ended');
        setIsSpeaking(false);
        if (audioUrlRef.current === audioUrl) {
          URL.revokeObjectURL(audioUrl);
          audioUrlRef.current = null;
        }
        // Reset and start timer when AI finishes speaking
        if (timedMode) {
          setTimeRemaining(timeLimit);
          setIsTimerActive(true);
        }
        // Auto-enable mic after AI finishes — directly, not via useEffect
        if (isMicEnabledRef.current && sessionActiveRef.current) {
          setTimeout(() => startListeningRef.current(), 600);
        }
      };

      audio.onerror = (e) => {
        console.error('[TTS] Audio playback error:', e);
        setIsSpeaking(false);
        toast.error('Audio ijro etishda xatolik yuz berdi');
        if (audioUrlRef.current === audioUrl) {
          URL.revokeObjectURL(audioUrl);
          audioUrlRef.current = null;
        }
      };

      // Direct play instead of oncanplaythrough for reliability
      try {
        console.log('[TTS] Calling audio.play()...');
        await audio.play();
        console.log('[TTS] Audio playing successfully');
      } catch (playErr) {
        console.error('[TTS] Autoplay blocked:', playErr);
        setIsSpeaking(false);
        toast.error('Ovozni eshitish uchun sahifaga bosing', { duration: 5000 });
      }
    } catch (err) {
      console.error('[TTS] Error:', err);
      setIsSpeaking(false);
      toast.error('Ovozli javob olishda xatolik. Matnni o\'qing.');
    }
  }, [currentLanguage, timedMode, timeLimit]);

  // Keep speakWithTTS ref updated
  const speakWithTTSRef = useRef(speakWithTTS);
  useEffect(() => {
    speakWithTTSRef.current = speakWithTTS;
  }, [speakWithTTS]);

  // Handle new interviewer message — trigger TTS
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (
      lastMessage?.role === 'interviewer' &&
      session?.status === 'active' &&
      !isRecordingRef.current // Don't start TTS if user is still speaking
    ) {
      console.log('[Interview] New interviewer message detected:', lastMessage.id);
      speakWithTTSRef.current(lastMessage.content, lastMessage.id);
    }
  }, [messages, session?.status]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (isSpeaking || !session || session.status !== 'active' || !isMicEnabled) {
      return;
    }

    if (recognitionRef.current) {
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Speech recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.lang = currentLanguage === 'ko' ? 'ko-KR' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      // Start recording when listening starts
      if (recordingEnabled) {
        startRecording();
      }
    };

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript.trim()) {
        setIsListening(false);
        recognitionRef.current = null;

        // Stop timer when user responds
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
        setIsTimerActive(false);

        await sendMessage(transcript, sessionType, currentLanguage);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    try {
      recognition.start();
    } catch (err) {
      console.error('Failed to start recognition:', err);
      recognitionRef.current = null;
    }
  }, [currentLanguage, isSpeaking, session, sendMessage, sessionType, isMicEnabled, recordingEnabled, startRecording]);

  // Keep startListeningRef updated
  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  // Auto-start listening when AI finishes speaking
  useEffect(() => {
    if (!isSpeaking && isMicEnabled && session?.status === 'active' && !isListening && !recognitionRef.current) {
      const timer = setTimeout(() => {
        startListening();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isSpeaking, isMicEnabled, session?.status, isListening, startListening]);

  const toggleMic = useCallback(() => {
    if (isMicEnabled) {
      stopListening();
      setIsMicEnabled(false);
      if (isRecording) {
        cancelRecording();
      }
    } else {
      setIsMicEnabled(true);
      if (!isSpeaking && session?.status === 'active') {
        setTimeout(() => startListening(), 100);
      }
    }
  }, [isMicEnabled, isSpeaking, session, stopListening, startListening, isRecording, cancelRecording]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartInterview = async () => {
    try {
      lastSpokenIdRef.current = '';
      setIsMicEnabled(true);
      resetIndex();
      setTimeRemaining(timeLimit);
      await startSession(sessionType, undefined, currentLanguage);
      setSessionDuration(0);
      setViewState('session');
    } catch (err) {
      console.error('Failed to start interview:', err);
    }
  };

  const handleEndInterview = async () => {
    stopListening();
    cancelRecording();
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setIsTimerActive(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    await endSession(currentLanguage);
    setViewState('feedback');
  };

  const handlePracticeAgain = () => {
    resetSession();
    setSessionDuration(0);
    lastSpokenIdRef.current = '';
    setViewState('setup');
  };

  const handleLanguageSwitch = (lang: 'ko' | 'en') => {
    setCurrentLanguage(lang);
    stopListening();
    setTimeout(() => startListening(), 100);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
      cancelRecording();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, [stopListening, cancelRecording]);

  // Loading state
  if (checkingAccess) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // VIP gate
  if (!isVIP) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <header className="border-b p-4">
          <Button variant="ghost" onClick={() => navigate('/portal')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('common.back', 'Back')}
          </Button>
        </header>
        <VIPAccessGate currentPlan={paymentPlan} />
      </div>
    );
  }

  // Analytics view
  if (viewState === 'analytics') {
    return (
      <div className="min-h-[100dvh] bg-background">
        <InterviewAnalytics onBack={() => setViewState('setup')} />
      </div>
    );
  }

  // Transcript review view
  if (viewState === 'transcript' && feedback) {
    const transcriptMessages = messages.map((m, i) => ({
      id: m.id || `msg-${i}`,
      role: m.role,
      content: m.content,
      created_at: m.created_at,
      audio_url: null, // TODO: Add audio URLs from recordings
    }));

    return (
      <div className="min-h-[100dvh] bg-background">
        <TranscriptReview
          messages={transcriptMessages}
          messageScores={[]} // TODO: Get from feedback.message_scores
          onBack={() => setViewState('feedback')}
        />
      </div>
    );
  }

  // Feedback view
  if (viewState === 'feedback' && feedback) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <header className="border-b p-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <h1 className="text-lg font-semibold">{t('interview.feedback', 'Interview Feedback')}</h1>
            <Button variant="outline" size="sm" onClick={() => setViewState('transcript')}>
              {t('interview.reviewTranscript', 'Review Transcript')}
            </Button>
          </div>
        </header>
        <InterviewFeedback
          feedback={feedback}
          onPracticeAgain={handlePracticeAgain}
          onGoHome={() => navigate('/portal')}
        />
        <div className="max-w-2xl mx-auto p-4 pt-0">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setViewState('analytics')}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            {t('interview.viewProgress', 'View Your Progress')}
          </Button>
        </div>
      </div>
    );
  }

  // Pre-session setup
  if (viewState === 'setup' && !session) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <header className="border-b p-4">
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <Button variant="ghost" onClick={() => navigate('/portal')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('common.back', 'Back')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setViewState('analytics')}>
              <BarChart3 className="h-4 w-4 mr-2" />
              {t('interview.viewProgress', 'View Progress')}
            </Button>
          </div>
        </header>

        <div className="max-w-lg mx-auto p-6">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Volume2 className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>{t('interview.practice', 'Interview Practice')}</CardTitle>
              <CardDescription>
                {t('interview.audioDesc', 'AI-powered audio interview practice. Speak naturally and get real-time feedback.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Language Selection for 'both' track */}
              {languageTrack === 'both' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Languages className="h-4 w-4" />
                    {t('interview.selectLanguage', 'Interview Language')}
                  </label>
                  <Select value={currentLanguage} onValueChange={(v) => setCurrentLanguage(v as 'ko' | 'en')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ko">🇰🇷 한국어 (Korean)</SelectItem>
                      <SelectItem value="en">🇺🇸 English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Fixed language indicator for single-track students */}
              {languageTrack !== 'both' && (
                <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-2">
                  <Languages className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {languageTrack === 'korean'
                      ? '🇰🇷 Korean Track (한국어)'
                      : '🇺🇸 English Track'}
                  </span>
                </div>
              )}

              {/* Session Type Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t('interview.sessionType', 'Interview Type')}
                </label>
                <Select value={sessionType} onValueChange={(v) => setSessionType(v as SessionType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">
                      {t('interview.general', 'General Admission')}
                    </SelectItem>
                    <SelectItem value="document_based">
                      {t('interview.documentBased', 'Based on Your Study Plan')}
                    </SelectItem>
                    <SelectItem value="university_specific">
                      {t('interview.universitySpecific', 'University Specific')}
                    </SelectItem>
                    <SelectItem value="visa">
                      {t('interview.visa', 'Visa Interview')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Focus Topic Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  {t('interview.focusTopic', 'Focus Topic (Optional)')}
                </label>
                <Select value={focusTopic} onValueChange={(v) => setFocusTopic(v as FocusTopic)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FOCUS_TOPICS.map(topic => (
                      <SelectItem key={topic.value} value={topic.value}>
                        {t(topic.labelKey, topic.value === 'all' ? 'All Topics' : topic.value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Advanced Options */}
              <div className="space-y-4 pt-2 border-t">
                <h4 className="text-sm font-medium text-muted-foreground">
                  {t('interview.advancedOptions', 'Advanced Options')}
                </h4>

                {/* Timed Mode Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="timed-mode" className="text-sm">
                      {t('interview.timedMode', 'Timed Response Mode')}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    {timedMode && (
                      <Select
                        value={timeLimit.toString()}
                        onValueChange={(v) => setTimeLimit(parseInt(v))}
                      >
                        <SelectTrigger className="w-20 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_LIMITS.map(tl => (
                            <SelectItem key={tl.value} value={tl.value.toString()}>
                              {tl.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Switch
                      id="timed-mode"
                      checked={timedMode}
                      onCheckedChange={setTimedMode}
                    />
                  </div>
                </div>

                {/* Recording Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Circle className="h-4 w-4 text-red-500" />
                    <Label htmlFor="record-mode" className="text-sm">
                      {t('interview.recordResponses', 'Record My Responses')}
                    </Label>
                  </div>
                  <Switch
                    id="record-mode"
                    checked={recordingEnabled}
                    onCheckedChange={setRecordingEnabled}
                  />
                </div>
              </div>

              {/* Tips */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h4 className="font-medium text-sm">{t('interview.tips', 'Tips')}</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• {t('interview.tip1', 'Speak clearly and at a moderate pace')}</li>
                  <li>• {t('interview.tip2', 'Take your time to think before answering')}</li>
                  <li>• {t('interview.voiceTip', 'The AI will listen automatically after speaking')}</li>
                  {timedMode && (
                    <li>• {t('interview.timedTip', `You have ${timeLimit} seconds to respond to each question`)}</li>
                  )}
                </ul>
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
                  {error}
                </div>
              )}

              {/* Start Button */}
              <Button
                className="w-full"
                size="lg"
                onClick={handleStartInterview}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('interview.starting', 'Starting...')}
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4 mr-2" />
                    {t('interview.startVoiceInterview', 'Start Voice Interview')}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Active voice interview session
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(sessionDuration)}
          </Badge>
          <Badge variant={session?.status === 'active' ? 'default' : 'secondary'}>
            {session?.status === 'active'
              ? t('interview.inProgress', 'In Progress')
              : t('interview.ended', 'Ended')}
          </Badge>
          <Badge variant="outline">
            {currentLanguage === 'ko' ? '🇰🇷 한국어' : '🇺🇸 English'}
          </Badge>
          {timedMode && (
            <Badge variant="outline" className="gap-1">
              <Timer className="h-3 w-3" />
              {t('interview.timed', 'Timed')}
            </Badge>
          )}
          {isRecording && (
            <Badge variant="destructive" className="gap-1 animate-pulse">
              <Circle className="h-2 w-2 fill-current" />
              {t('interview.recording', 'REC')}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {languageTrack === 'both' && (
            <div className="flex gap-1">
              <Button
                variant={currentLanguage === 'ko' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleLanguageSwitch('ko')}
                disabled={isSpeaking || isProcessing}
              >
                🇰🇷
              </Button>
              <Button
                variant={currentLanguage === 'en' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleLanguageSwitch('en')}
                disabled={isSpeaking || isProcessing}
              >
                🇺🇸
              </Button>
            </div>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={handleEndInterview}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Square className="h-3 w-3 mr-1" />
                {t('interview.endInterview', 'End Interview')}
              </>
            )}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 p-6">
        {/* Left: Audio Avatar */}
        <div className="flex-1 flex flex-col">
          <AudioInterviewAvatar
            isSpeaking={isSpeaking}
            isListening={isListening && isMicEnabled}
            className="w-full aspect-video max-h-[50vh]"
          />

          {/* Response Timer */}
          {timedMode && !isSpeaking && session?.status === 'active' && (
            <div className="mt-4 max-w-md mx-auto w-full">
              <ResponseTimer
                timeRemaining={timeRemaining}
                timeLimit={timeLimit}
                isActive={isTimerActive}
              />
            </div>
          )}

          {/* Controls */}
          <div className="mt-4 flex items-center justify-center gap-4">
            <Button
              variant={isMicEnabled ? "default" : "outline"}
              size="lg"
              className={cn(
                "rounded-full w-14 h-14",
                isMicEnabled && isListening && "ring-2 ring-green-500/50 animate-pulse"
              )}
              onClick={toggleMic}
              disabled={isSpeaking || isProcessing}
            >
              {isMicEnabled ? (
                <Mic className="h-6 w-6" />
              ) : (
                <MicOff className="h-6 w-6" />
              )}
            </Button>

            <div className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all",
              isListening && isMicEnabled
                ? "bg-green-500/20 text-green-600"
                : isSpeaking
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
            )}>
              {isSpeaking
                ? t('interview.aiSpeaking', 'AI Speaking...')
                : isListening && isMicEnabled
                  ? t('interview.listening', 'Listening...')
                  : !isMicEnabled
                    ? t('interview.micMuted', 'Mic Muted')
                    : t('interview.ready', 'Ready')}
            </div>

            {isProcessing && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 text-primary">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm font-medium">{t('interview.thinking', 'Thinking...')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Transcript */}
        <div className="lg:w-96 flex flex-col">
          <h3 className="font-semibold mb-3">{t('interview.transcript', 'Transcript')}</h3>
          <Card className="flex-1">
            <CardContent className="p-4 h-full max-h-[60vh] overflow-y-auto">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "mb-3 last:mb-0",
                    msg.role === 'interviewer' ? 'text-left' : 'text-right'
                  )}
                >
                  <Badge variant={msg.role === 'interviewer' ? 'secondary' : 'default'} className="mb-1">
                    {msg.role === 'interviewer' ? t('interview.interviewer', 'Interviewer') : t('interview.you', 'You')}
                  </Badge>
                  <p className={cn(
                    "text-sm rounded-lg p-3 inline-block max-w-[90%]",
                    msg.role === 'interviewer'
                      ? 'bg-muted text-left'
                      : 'bg-primary text-primary-foreground text-left'
                  )}>
                    {msg.content}
                  </p>
                </div>
              ))}
              {messages.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">
                  {t('interview.waitingToStart', 'Interview will begin shortly...')}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
