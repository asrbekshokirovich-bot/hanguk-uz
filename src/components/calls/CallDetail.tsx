import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Call } from '@/hooks/useCalls';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Clock,
  User,
  Calendar,
  Edit,
  FileText,
  Headphones,
} from 'lucide-react';
import { RecordingPlayer } from './RecordingPlayer';

interface CallDetailProps {
  call: Call;
  onEdit: () => void;
}

export function CallDetail({ call, onEdit }: CallDetailProps) {
  const { t } = useTranslation();

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins} min ${secs} sec`;
  };

  const getDirectionIcon = () => {
    if (call.status === 'missed' || call.status === 'no_answer') {
      return <PhoneMissed className="h-6 w-6 text-destructive" />;
    }
    return call.direction === 'incoming' ? (
      <PhoneIncoming className="h-6 w-6 text-green-500" />
    ) : (
      <PhoneOutgoing className="h-6 w-6 text-blue-500" />
    );
  };

  const getStatusBadge = () => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      completed: 'default',
      missed: 'destructive',
      busy: 'secondary',
      no_answer: 'destructive',
      failed: 'destructive',
    };

    const labels: Record<string, string> = {
      completed: 'Completed',
      missed: 'Missed',
      busy: 'Busy',
      no_answer: 'No Answer',
      failed: 'Failed',
    };

    return (
      <Badge variant={variants[call.status] || 'outline'}>
        {labels[call.status] || call.status}
      </Badge>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          {getDirectionIcon()}
          <div>
            <h2 className="text-lg font-semibold">{call.phone_number}</h2>
            <p className="text-sm text-muted-foreground capitalize">{call.direction} Call</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Status & Duration */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Call Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              {getStatusBadge()}
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Duration
              </span>
              <span className="font-medium">
                {call.duration > 0 ? formatDuration(call.duration) : 'N/A'}
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Date & Time
              </span>
              <span className="font-medium">
                {format(new Date(call.started_at), 'PPp')}
              </span>
            </div>
            {call.ended_at && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Ended At</span>
                  <span className="font-medium">
                    {format(new Date(call.ended_at), 'HH:mm:ss')}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Participants */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Participants
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {call.student?.full_name && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Student</span>
                  <span className="font-medium">{call.student.full_name}</span>
                </div>
                <Separator />
              </>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Staff</span>
              <span className="font-medium">
                {call.staff?.full_name || 'Unknown'}
              </span>
            </div>
            {call.voip_provider !== 'manual' && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Provider</span>
                  <Badge variant="outline">{call.voip_provider}</Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Recording */}
        {call.recording_url && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Headphones className="h-4 w-4" />
                Recording
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RecordingPlayer callId={call.id} />
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {call.notes && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{call.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* External ID */}
        {call.external_call_id && (
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">External ID</span>
                <code className="bg-muted px-2 py-1 rounded text-xs">
                  {call.external_call_id}
                </code>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
