import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseAudioRecorderOptions {
  sessionId?: string;
  userId?: string;
  enabled?: boolean;
}

interface RecordingResult {
  blob: Blob;
  url: string;
}

export function useAudioRecorder({ sessionId, userId, enabled = true }: UseAudioRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingIndexRef = useRef(0);

  const startRecording = useCallback(async (): Promise<boolean> => {
    if (!enabled) return false;
    
    try {
      setError(null);
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        }
      });
      streamRef.current = stream;
      
      // Determine best supported format
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start recording';
      setError(message);
      console.error('Recording error:', err);
      return false;
    }
  }, [enabled]);

  const stopRecording = useCallback(async (): Promise<RecordingResult | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        resolve(null);
        return;
      }
      
      mediaRecorderRef.current.onstop = async () => {
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        // Clean up stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        setIsRecording(false);
        chunksRef.current = [];
        
        resolve({ blob, url });
      };
      
      mediaRecorderRef.current.stop();
    });
  }, []);

  const uploadRecording = useCallback(async (blob: Blob): Promise<string | null> => {
    if (!sessionId || !userId) {
      console.error('Session ID and User ID required for upload');
      return null;
    }
    
    try {
      const fileExt = blob.type.includes('webm') ? 'webm' : 'mp4';
      const fileName = `student_${recordingIndexRef.current}.${fileExt}`;
      const filePath = `${userId}/${sessionId}/${fileName}`;
      
      recordingIndexRef.current++;
      
      const { error: uploadError } = await supabase.storage
        .from('interview-recordings')
        .upload(filePath, blob, {
          contentType: blob.type,
          upsert: true,
        });
      
      if (uploadError) {
        console.error('Upload error:', uploadError);
        return null;
      }
      
      const { data: { publicUrl } } = supabase.storage
        .from('interview-recordings')
        .getPublicUrl(filePath);
      
      return publicUrl;
    } catch (err) {
      console.error('Failed to upload recording:', err);
      return null;
    }
  }, [sessionId, userId]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsRecording(false);
    chunksRef.current = [];
  }, []);

  const resetIndex = useCallback(() => {
    recordingIndexRef.current = 0;
  }, []);

  return {
    isRecording,
    error,
    startRecording,
    stopRecording,
    uploadRecording,
    cancelRecording,
    resetIndex,
  };
}
