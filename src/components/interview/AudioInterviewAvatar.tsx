import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Volume2, Mic, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioInterviewAvatarProps {
  isSpeaking: boolean;
  isListening: boolean;
  className?: string;
}

export function AudioInterviewAvatar({
  isSpeaking,
  isListening,
  className
}: AudioInterviewAvatarProps) {
  const { t } = useTranslation();
  const [waveformValues, setWaveformValues] = useState<number[]>([0.3, 0.5, 0.7, 0.5, 0.3, 0.6, 0.4, 0.8, 0.5, 0.4, 0.6, 0.3]);
  const animationFrameRef = useRef<number>();

  // Animate waveform when speaking
  useEffect(() => {
    if (isSpeaking) {
      const animate = () => {
        setWaveformValues(prev => 
          prev.map(() => 0.2 + Math.random() * 0.8)
        );
        animationFrameRef.current = requestAnimationFrame(animate);
      };
      
      // Start animation at ~15fps for smooth but not too fast motion
      const interval = setInterval(() => {
        animate();
      }, 66);

      return () => {
        clearInterval(interval);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    } else {
      // Reset to idle state
      setWaveformValues([0.3, 0.5, 0.7, 0.5, 0.3, 0.6, 0.4, 0.8, 0.5, 0.4, 0.6, 0.3]);
    }
  }, [isSpeaking]);

  return (
    <Card className={cn(
      "relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900",
      className
    )}>
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(var(--primary),0.3),transparent_70%)]" />
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)`,
          backgroundSize: '32px 32px'
        }} />
      </div>

      {/* Main content */}
      <div className="relative flex flex-col items-center justify-center h-full min-h-[300px] p-8">
        {/* Avatar circle with animated ring */}
        <div className={cn(
          "relative mb-6 transition-all duration-300",
          isSpeaking && "scale-105"
        )}>
          {/* Outer animated rings */}
          {isSpeaking && (
            <>
              <div className="absolute -inset-4 rounded-full bg-primary/20 animate-ping" />
              <div className="absolute -inset-2 rounded-full bg-primary/30 animate-pulse" />
            </>
          )}
          
          {/* Avatar circle */}
          <div className={cn(
            "relative w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300",
            isSpeaking 
              ? "bg-gradient-to-br from-primary to-primary/60 shadow-lg shadow-primary/30" 
              : isListening
              ? "bg-gradient-to-br from-green-500 to-green-600 shadow-lg shadow-green-500/30"
              : "bg-gradient-to-br from-slate-600 to-slate-700"
          )}>
            <User className="w-14 h-14 text-white" />
          </div>
        </div>

        {/* Waveform visualization */}
        <div className="flex items-center justify-center gap-1 h-16 mb-4">
          {waveformValues.map((value, idx) => (
            <div
              key={idx}
              className={cn(
                "w-1.5 rounded-full transition-all duration-150",
                isSpeaking 
                  ? "bg-primary" 
                  : isListening
                  ? "bg-green-500"
                  : "bg-slate-600"
              )}
              style={{
                height: `${value * 100}%`,
                opacity: isSpeaking || isListening ? 1 : 0.5,
                transform: `scaleY(${isSpeaking ? 1 : 0.3})`,
              }}
            />
          ))}
        </div>

        {/* Status text */}
        <div className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
          isSpeaking 
            ? "bg-primary/20 text-primary" 
            : isListening
            ? "bg-green-500/20 text-green-400"
            : "bg-slate-700/50 text-slate-400"
        )}>
          {isSpeaking ? (
            <>
              <Volume2 className="w-4 h-4 animate-pulse" />
              <span>{t('interview.aiSpeaking', 'AI Speaking...')}</span>
            </>
          ) : isListening ? (
            <>
              <Mic className="w-4 h-4 animate-pulse" />
              <span>{t('interview.listening', 'Listening...')}</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-slate-500" />
              <span>{t('interview.ready', 'Ready')}</span>
            </>
          )}
        </div>

        {/* AI Interviewer label */}
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <div className={cn(
            "w-2 h-2 rounded-full",
            isSpeaking || isListening ? "bg-green-500" : "bg-slate-500"
          )} />
          <span className="text-xs text-white/70 font-medium">
            {t('interview.aiInterviewer', 'AI Interviewer')}
          </span>
        </div>

        {/* Audio mode indicator */}
        <div className="absolute top-4 right-4">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/10 text-white/70 text-xs">
            <Volume2 className="w-3 h-3" />
            <span>{t('interview.audioMode', 'Audio Mode')}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
