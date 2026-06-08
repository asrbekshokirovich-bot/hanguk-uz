import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserRole } from '@/hooks/useUserRole';
import { useCalls, Call } from '@/hooks/useCalls';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CallList } from '@/components/calls/CallList';
import { CallForm } from '@/components/calls/CallForm';
import { CallDetail } from '@/components/calls/CallDetail';
import { Button } from '@/components/ui/button';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Plus,
  Clock,
} from 'lucide-react';

export default function CallsContent() {
  const { t } = useTranslation();
  const { isCallOperator } = useUserRole();
  const { calls, loading: callsLoading, createCall, updateCall, deleteCall } = useCalls();

  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCall, setEditingCall] = useState<Call | null>(null);

  const handleCreateCall = async (data: any) => {
    return await createCall(data);
  };

  const handleUpdateCall = async (data: any) => {
    if (!editingCall) return false;
    return await updateCall(editingCall.id, data);
  };

  const handleDeleteCall = async (callId: string) => {
    if (confirm('Are you sure you want to delete this call log?')) {
      await deleteCall(callId);
      if (selectedCall?.id === callId) {
        setSelectedCall(null);
      }
    }
  };

  const handleEdit = () => {
    if (selectedCall) {
      setEditingCall(selectedCall);
      setFormOpen(true);
    }
  };

  // Calculate stats
  const totalCalls = calls.length;
  const incomingCalls = calls.filter((c) => c.direction === 'incoming').length;
  const outgoingCalls = calls.filter((c) => c.direction === 'outgoing').length;
  const missedCalls = calls.filter((c) => c.status === 'missed' || c.status === 'no_answer').length;
  const totalDuration = calls.reduce((acc, c) => acc + c.duration, 0);
  const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Calls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{totalCalls}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Incoming
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <PhoneIncoming className="h-5 w-5 text-success" />
              <span className="text-2xl font-bold">{incomingCalls}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Outgoing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <PhoneOutgoing className="h-5 w-5 text-info" />
              <span className="text-2xl font-bold">{outgoingCalls}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Missed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <PhoneMissed className="h-5 w-5 text-destructive" />
              <span className="text-2xl font-bold">{missedCalls}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              <span className="text-2xl font-bold">
                {Math.floor(avgDuration / 60)}:{(avgDuration % 60).toString().padStart(2, '0')}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      {isCallOperator && (
        <div className="flex justify-end">
          <Button onClick={() => {
            setEditingCall(null);
            setFormOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Log Call
          </Button>
        </div>
      )}

      {/* Main Content */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 overflow-hidden">
          <CallList
            calls={calls}
            selectedCall={selectedCall}
            onSelectCall={setSelectedCall}
            onDeleteCall={handleDeleteCall}
          />
        </Card>

        <Card className="md:col-span-2">
          {selectedCall ? (
            <CallDetail call={selectedCall} onEdit={handleEdit} />
          ) : (
            <div className="h-full flex items-center justify-center p-8 text-center">
              <div>
                <Phone className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">Select a Call</h3>
                <p className="text-muted-foreground">
                  Choose a call from the list to view details
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Form Dialog */}
      <CallForm
        open={formOpen}
        onOpenChange={setFormOpen}
        call={editingCall}
        onSubmit={editingCall ? handleUpdateCall : handleCreateCall}
      />
    </div>
  );
}
