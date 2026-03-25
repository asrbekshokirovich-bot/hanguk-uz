import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Users,
  Send,
  Star,
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  ThumbsUp,
  ThumbsDown,
  Loader2,
} from 'lucide-react';
import { PeerReview, PeerReviewQueueItem, usePeerReview } from '@/hooks/usePeerReview';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface PeerReviewPanelProps {
  currentDraftId?: string;
  documentType: 'study_plan' | 'personal_statement';
  language?: string;
  universityId?: string;
}

export function PeerReviewPanel({
  currentDraftId,
  documentType,
  language = 'en',
  universityId,
}: PeerReviewPanelProps) {
  const { t } = useTranslation();
  const {
    myReviewsReceived,
    myReviewsToGive,
    availableForReview,
    isLoading,
    requestReview,
    claimReview,
    submitReview,
    pendingReviewsCount,
    completedReviewsCount,
  } = usePeerReview();

  const [isRequesting, setIsRequesting] = useState(false);
  const [selectedReview, setSelectedReview] = useState<PeerReview | null>(null);
  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [rating, setRating] = useState(0);
  const [strengths, setStrengths] = useState<string[]>([]);
  const [improvements, setImprovements] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRequestReview = async () => {
    if (!currentDraftId) return;

    setIsRequesting(true);
    await requestReview(currentDraftId, documentType, language, universityId);
    setIsRequesting(false);
  };

  const handleClaimReview = async (queueItem: PeerReviewQueueItem) => {
    const review = await claimReview(queueItem.id, queueItem.draft_id);
    if (review) {
      setSelectedReview(review);
      setReviewFormOpen(true);
    }
  };

  const handleSubmitReview = async () => {
    if (!selectedReview || !feedbackText.trim() || rating === 0) return;

    setIsSubmitting(true);
    const success = await submitReview(
      selectedReview.id,
      feedbackText,
      rating,
      strengths,
      improvements
    );
    if (success) {
      setReviewFormOpen(false);
      setSelectedReview(null);
      setFeedbackText('');
      setRating(0);
      setStrengths([]);
      setImprovements([]);
    }
    setIsSubmitting(false);
  };

  const completedReviews = myReviewsReceived.filter(r => r.status === 'completed');
  const pendingRequests = myReviewsReceived.filter(r => r.status === 'pending');

  return (
    <>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">{t('study.peerReview', 'Peer Review')}</span>
            {pendingReviewsCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
                {pendingReviewsCount}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {t('study.peerReviewSystem', 'Peer Review System')}
            </SheetTitle>
            <SheetDescription>
              {t('study.peerReviewDesc', 'Get feedback from other students and help others improve')}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="h-[calc(100dvh-10rem)] mt-6">
            <div className="space-y-6 pr-4">
              {/* Request Review */}
              {currentDraftId && (
                <Card className="border-primary/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{t('study.requestReview', 'Request a Review')}</CardTitle>
                    <CardDescription>
                      {t('study.requestReviewDesc', 'Submit your current draft for anonymous peer review')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={handleRequestReview}
                      disabled={isRequesting}
                      className="w-full gap-2"
                    >
                      {isRequesting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      {t('study.submitForReview', 'Submit for Peer Review')}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* My Pending Requests */}
              {pendingRequests.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-500" />
                    {t('study.awaitingReviews', 'Awaiting Reviews')}
                  </h3>
                  <div className="space-y-2">
                    {pendingRequests.map(review => (
                      <div key={review.id} className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">{t('study.pendingReview', 'Pending review')}</span>
                          <Badge variant="outline" className="text-xs">
                            {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reviews to Give */}
              {myReviewsToGive.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-blue-500" />
                    {t('study.reviewsToGive', 'Reviews to Complete')} ({myReviewsToGive.length})
                  </h3>
                  <div className="space-y-2">
                    {myReviewsToGive.map(review => (
                      <Card key={review.id} className="cursor-pointer hover:border-primary/50 transition-colors"
                        onClick={() => {
                          setSelectedReview(review);
                          setReviewFormOpen(true);
                        }}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="secondary">{review.anonymous_name}</Badge>
                            <Badge variant="outline" className="text-xs">
                              {review.status === 'in_progress' ? 'In Progress' : 'Pending'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {review.draft_content?.substring(0, 150) || 'Click to view draft...'}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Completed Reviews Received */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  {t('study.feedbackReceived', 'Feedback Received')} ({completedReviews.length})
                </h3>
                {completedReviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t('study.noFeedbackYet', 'No feedback received yet')}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {completedReviews.map(review => (
                      <Card key={review.id} className="border-green-200 dark:border-green-800">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{review.anonymous_name}</Badge>
                              {review.rating && (
                                <div className="flex items-center gap-1">
                                  {[...Array(5)].map((_, i) => (
                                    <Star
                                      key={i}
                                      className={cn(
                                        'h-3 w-3',
                                        i < review.rating! ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'
                                      )}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {review.completed_at && formatDistanceToNow(new Date(review.completed_at), { addSuffix: true })}
                            </span>
                          </div>

                          {review.review_feedback && (
                            <p className="text-sm mb-3">{review.review_feedback}</p>
                          )}

                          {review.strengths && review.strengths.length > 0 && (
                            <div className="mb-2">
                              <p className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                                <ThumbsUp className="h-3 w-3" /> {t('study.strengths', 'Strengths')}
                              </p>
                              <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                {review.strengths.map((s, i) => (
                                  <li key={i}>• {s}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {review.improvements && review.improvements.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                <ThumbsDown className="h-3 w-3" /> {t('study.improvements', 'To Improve')}
                              </p>
                              <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                {review.improvements.map((s, i) => (
                                  <li key={i}>• {s}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Available for Review */}
              {availableForReview.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Plus className="h-4 w-4 text-primary" />
                    {t('study.helpOthers', 'Help Others')}
                  </h3>
                  <div className="space-y-2">
                    {availableForReview.slice(0, 3).map(item => (
                      <Card key={item.id} className="hover:border-primary/50 transition-colors">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="secondary" className="capitalize">
                              {item.document_type.replace('_', ' ')}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {item.language === 'ko' ? '🇰🇷 Korean' : '🇺🇸 English'}
                            </Badge>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full mt-2"
                            onClick={() => handleClaimReview(item)}
                          >
                            {t('study.claimToReview', 'Claim to Review')}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Review Form Dialog */}
      <Dialog open={reviewFormOpen} onOpenChange={setReviewFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('study.provideReview', 'Provide Your Review')}</DialogTitle>
            <DialogDescription>
              {t('study.anonymousReviewDesc', 'Your review will be shared anonymously with the author')}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {/* Draft Content */}
              {selectedReview?.draft_content && (
                <div className="bg-muted rounded-lg p-4 max-h-48 overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap">{selectedReview.draft_content}</p>
                </div>
              )}

              {/* Rating */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('study.overallRating', 'Overall Rating')}</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(value => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRating(value)}
                      className="focus:outline-none"
                    >
                      <Star className={cn(
                        'h-8 w-8 transition-colors',
                        value <= rating ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground hover:text-amber-300'
                      )} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Feedback */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('study.detailedFeedback', 'Detailed Feedback')}</label>
                <Textarea
                  placeholder={t('study.feedbackPlaceholder', 'Share your thoughts on the content, structure, and writing style...')}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  className="min-h-[120px]"
                />
              </div>

              {/* Strengths */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-green-600">{t('study.whatWorksWell', 'What works well?')}</label>
                <Textarea
                  placeholder={t('study.strengthsPlaceholder', 'List strengths, one per line...')}
                  value={strengths.join('\n')}
                  onChange={(e) => setStrengths(e.target.value.split('\n').filter(Boolean))}
                  className="min-h-[80px]"
                />
              </div>

              {/* Improvements */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-amber-600">{t('study.whatToImprove', 'What could be improved?')}</label>
                <Textarea
                  placeholder={t('study.improvementsPlaceholder', 'List suggestions, one per line...')}
                  value={improvements.join('\n')}
                  onChange={(e) => setImprovements(e.target.value.split('\n').filter(Boolean))}
                  className="min-h-[80px]"
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewFormOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={handleSubmitReview}
              disabled={isSubmitting || !feedbackText.trim() || rating === 0}
              className="gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {t('study.submitReview', 'Submit Review')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
