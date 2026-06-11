import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Crown, Video, MessageSquare, Star, Lock, Smartphone } from 'lucide-react';
import { usePlatform } from '@/hooks/usePlatform';

interface VIPAccessGateProps {
  currentPlan?: string | null;
  onUpgrade?: () => void;
  onNativeUpgrade?: () => void;
}

export function VIPAccessGate({ currentPlan, onUpgrade, onNativeUpgrade }: VIPAccessGateProps) {
  const { t } = useTranslation();
  const { isDespia } = usePlatform();

  const vipFeatures = [
    {
      icon: Video,
      title: t('interview.features.avatar', 'Realistic AI Interviewer'),
      description: t('interview.features.avatarDesc', 'Practice with a lifelike Korean interviewer avatar'),
    },
    {
      icon: MessageSquare,
      title: t('interview.features.realtime', 'Real-time Conversation'),
      description: t('interview.features.realtimeDesc', 'Natural bidirectional dialogue with instant responses'),
    },
    {
      icon: Star,
      title: t('interview.features.feedback', 'Detailed Feedback'),
      description: t('interview.features.feedbackDesc', 'Get scored on communication, confidence, and content'),
    },
  ];

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="flex items-center justify-center gap-2 text-2xl">
            <Crown className="h-6 w-6 text-warning" />
            {t('interview.vipOnly', 'VIP Feature')}
          </CardTitle>
          <CardDescription className="text-base mt-2">
            {t('interview.vipDescription', 'Practice with a realistic AI interviewer to prepare for your Korean university admission interview.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Plan Badge */}
          {currentPlan && (
            <div className="text-center">
              <span className="text-sm text-muted-foreground">
                {t('interview.currentPlan', 'Current Plan')}:
              </span>
              <span className="ml-2 px-3 py-1 bg-muted rounded-full text-sm font-medium">
                {currentPlan}
              </span>
            </div>
          )}

          {/* Features List */}
          <div className="space-y-4">
            {vipFeatures.map((feature, index) => (
              <div key={index} className="flex gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium">{feature.title}</h4>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* VIP Plans */}
          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground text-center mb-4">
              {t('interview.availableFor', 'Available for Premium and No Risk plan students')}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 border rounded-lg text-center bg-gradient-to-br from-info to-primary dark:from-info/20 dark:to-primary/20 border-info/30 dark:border-info">
                <div className="font-medium text-info dark:text-info">PREMIUM</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t('interview.premiumDesc', '10M UZS - AI Interview + Embassy docs')}
                </div>
              </div>
              <div className="p-3 border rounded-lg text-center bg-gradient-to-br from-warning to-warning dark:from-warning/20 dark:to-warning/20 border-warning/30 dark:border-warning">
                <div className="font-medium text-warning dark:text-warning">NO RISK</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t('interview.noRiskDesc', '$5,000 - Full VIP + Flight & Apartment')}
                </div>
              </div>
            </div>
          </div>

          {/* Platform-aware Upgrade Button */}
          {isDespia && onNativeUpgrade ? (
            <Button onClick={onNativeUpgrade} className="w-full" size="lg">
              <Smartphone className="h-4 w-4 mr-2" />
              {t('interview.upgradeInApp', 'Upgrade via In-App Purchase')}
            </Button>
          ) : onUpgrade ? (
            <Button onClick={onUpgrade} className="w-full" size="lg">
              <Crown className="h-4 w-4 mr-2" />
              {t('interview.upgradeToVIP', 'Upgrade to VIP')}
            </Button>
          ) : null}

          <p className="text-xs text-center text-muted-foreground">
            {isDespia 
              ? t('interview.inAppPurchaseNote', 'Upgrade through in-app purchase for instant access')
              : t('interview.contactStaff', 'Contact your consultant to upgrade your plan')
            }
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
