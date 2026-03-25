import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Call } from '@/hooks/useCalls';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

interface CallFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  call?: Call | null;
  onSubmit: (data: any) => Promise<boolean>;
}

export function CallForm({ open, onOpenChange, call, onSubmit }: CallFormProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<Tables<'profiles'>[]>([]);
  
  const [formData, setFormData] = useState({
    phone_number: '',
    direction: 'outgoing' as 'incoming' | 'outgoing',
    status: 'completed',
    duration: 0,
    recording_url: '',
    notes: '',
    student_id: '',
  });

  useEffect(() => {
    if (call) {
      setFormData({
        phone_number: call.phone_number,
        direction: call.direction,
        status: call.status,
        duration: call.duration,
        recording_url: call.recording_url || '',
        notes: call.notes || '',
        student_id: call.student_id || '',
      });
    } else {
      setFormData({
        phone_number: '',
        direction: 'outgoing',
        status: 'completed',
        duration: 0,
        recording_url: '',
        notes: '',
        student_id: '',
      });
    }
  }, [call, open]);

  useEffect(() => {
    const fetchStudents = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');
      if (data) setStudents(data);
    };
    fetchStudents();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const submitData = {
      ...formData,
      student_id: formData.student_id || undefined,
      recording_url: formData.recording_url || undefined,
      notes: formData.notes || undefined,
    };
    
    const success = await onSubmit(submitData);
    setLoading(false);
    
    if (success) {
      onOpenChange(false);
    }
  };

  const formatDurationInput = (minutes: number, seconds: number) => {
    return minutes * 60 + seconds;
  };

  const getDurationParts = (totalSeconds: number) => {
    return {
      minutes: Math.floor(totalSeconds / 60),
      seconds: totalSeconds % 60,
    };
  };

  const durationParts = getDurationParts(formData.duration);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{call ? 'Edit Call' : 'Log New Call'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone_number">Phone Number *</Label>
              <Input
                id="phone_number"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                placeholder="+1 234 567 8900"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="student">Student</Label>
              <Select
                value={formData.student_id || 'none'}
                onValueChange={(value) => setFormData({ ...formData, student_id: value === 'none' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No student</SelectItem>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.user_id}>
                      {student.full_name || 'Unnamed'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="direction">Direction</Label>
              <Select
                value={formData.direction}
                onValueChange={(value: 'incoming' | 'outgoing') => 
                  setFormData({ ...formData, direction: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outgoing">Outgoing</SelectItem>
                  <SelectItem value="incoming">Incoming</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="missed">Missed</SelectItem>
                  <SelectItem value="no_answer">No Answer</SelectItem>
                  <SelectItem value="busy">Busy</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Duration</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                value={durationParts.minutes}
                onChange={(e) => setFormData({
                  ...formData,
                  duration: formatDurationInput(parseInt(e.target.value) || 0, durationParts.seconds)
                })}
                className="w-20"
              />
              <span className="text-muted-foreground">min</span>
              <Input
                type="number"
                min="0"
                max="59"
                value={durationParts.seconds}
                onChange={(e) => setFormData({
                  ...formData,
                  duration: formatDurationInput(durationParts.minutes, parseInt(e.target.value) || 0)
                })}
                className="w-20"
              />
              <span className="text-muted-foreground">sec</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recording_url">Recording URL</Label>
            <Input
              id="recording_url"
              type="url"
              value={formData.recording_url}
              onChange={(e) => setFormData({ ...formData, recording_url: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Call notes..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : call ? 'Update Call' : 'Log Call'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
