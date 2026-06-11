import { useState } from 'react';
import { ClickToCall } from '@/components/calls/ClickToCall';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Call } from '@/hooks/useCalls';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Search,
  Clock,
  User,
  Play,
  Trash2,
} from 'lucide-react';

interface CallListProps {
  calls: Call[];
  selectedCall: Call | null;
  onSelectCall: (call: Call) => void;
  onDeleteCall: (callId: string) => void;
}

export function CallList({ calls, selectedCall, onSelectCall, onDeleteCall }: CallListProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredCalls = calls.filter((call) => {
    const matchesSearch =
      call.phone_number.toLowerCase().includes(search.toLowerCase()) ||
      call.student?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      call.notes?.toLowerCase().includes(search.toLowerCase());

    const matchesDirection = directionFilter === 'all' || call.direction === directionFilter;
    const matchesStatus = statusFilter === 'all' || call.status === statusFilter;

    return matchesSearch && matchesDirection && matchesStatus;
  });

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getDirectionIcon = (direction: string, status: string) => {
    if (status === 'missed' || status === 'no_answer') {
      return <PhoneMissed className="h-4 w-4 text-destructive" />;
    }
    return direction === 'incoming' ? (
      <PhoneIncoming className="h-4 w-4 text-success" />
    ) : (
      <PhoneOutgoing className="h-4 w-4 text-info" />
    );
  };

  const getStatusBadge = (status: string) => {
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
      <Badge variant={variants[status] || 'outline'} className="text-xs">
        {labels[status] || status}
      </Badge>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search calls..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={directionFilter} onValueChange={setDirectionFilter}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Direction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Directions</SelectItem>
              <SelectItem value="incoming">Incoming</SelectItem>
              <SelectItem value="outgoing">Outgoing</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="missed">Missed</SelectItem>
              <SelectItem value="no_answer">No Answer</SelectItem>
              <SelectItem value="busy">Busy</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {filteredCalls.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Phone className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No calls found</p>
            </div>
          ) : (
            filteredCalls.map((call) => (
              <Card
                key={call.id}
                className={`cursor-pointer transition-colors hover:bg-accent/50 ${
                  selectedCall?.id === call.id ? 'border-primary bg-accent' : ''
                }`}
                onClick={() => onSelectCall(call)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getDirectionIcon(call.direction, call.status)}
                      <div>
                        <ClickToCall phoneNumber={call.phone_number} studentId={call.student_id || undefined} showIcon={false} className="font-medium" />
                        {call.student?.full_name && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {call.student.full_name}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {call.recording_url && (
                        <Play className="h-4 w-4 text-primary" />
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteCall(call.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(call.status)}
                      {call.duration > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(call.duration)}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(call.started_at), 'MMM d, HH:mm')}
                    </span>
                  </div>
                  
                  {call.notes && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-1">
                      {call.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
