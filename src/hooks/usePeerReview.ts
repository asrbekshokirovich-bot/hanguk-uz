import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface PeerReview {
  id: string;
  draft_id: string;
  author_id: string;
  reviewer_id: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'expired';
  anonymous_name: string;
  review_feedback: string | null;
  rating: number | null;
  strengths: string[];
  improvements: string[];
  created_at: string;
  completed_at: string | null;
  expires_at: string;
  draft_content?: string;
  document_type?: string;
}

export interface PeerReviewQueueItem {
  id: string;
  draft_id: string;
  document_type: string;
  language: string;
  institution_id: string | null;
  submitted_at: string;
  is_matched: boolean;
  draft_content?: string;
}

const anonymousNames = [
  'Student Alpha', 'Student Beta', 'Student Gamma', 'Student Delta',
  'Peer One', 'Peer Two', 'Peer Three', 'Peer Four',
  'Writer A', 'Writer B', 'Writer C', 'Writer D',
];

function getRandomAnonymousName(): string {
  return anonymousNames[Math.floor(Math.random() * anonymousNames.length)];
}

export function usePeerReview() {
  const { user } = useAuth();
  const [myReviewsReceived, setMyReviewsReceived] = useState<PeerReview[]>([]);
  const [myReviewsToGive, setMyReviewsToGive] = useState<PeerReview[]>([]);
  const [availableForReview, setAvailableForReview] = useState<PeerReviewQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all peer review data
  const fetchPeerReviewData = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Reviews I've received (as author)
      const { data: received, error: receivedError } = await supabase
        .from('peer_reviews' as any)
        .select('*')
        .eq('author_id', user.id)
        .order('created_at', { ascending: false });

      if (receivedError) {
        console.error('Error fetching received reviews:', receivedError);
      } else {
        setMyReviewsReceived((received as any) || []);
      }

      // Reviews I need to give (as reviewer)
      const { data: toGive, error: toGiveError } = await supabase
        .from('peer_reviews' as any)
        .select('*')
        .eq('reviewer_id', user.id)
        .in('status', ['pending', 'in_progress'])
        .order('created_at', { ascending: false });

      if (toGiveError) {
        console.error('Error fetching reviews to give:', toGiveError);
      } else {
        // Batch-fetch draft content for every review in a single query.
        // Previously this ran one drafts query per review (an N+1);
        // now it's one .in() lookup keyed into a Map.
        const draftIds = Array.from(
          new Set(
            ((toGive as any[]) || [])
              .map((review: any) => review.draft_id)
              .filter((id: any): id is string => Boolean(id)),
          ),
        ) as string[];

        const draftContentById = new Map<string, string>();
        if (draftIds.length > 0) {
          const { data: drafts } = await supabase
            .from('study_plan_drafts')
            .select('id, content')
            .in('id', draftIds);
          for (const draft of (drafts as any) ?? []) {
            draftContentById.set(draft.id, draft.content);
          }
        }

        const reviewsWithContent = ((toGive as any) || []).map((review: any) => ({
          ...review,
          draft_content: draftContentById.get(review.draft_id),
        }));
        setMyReviewsToGive(reviewsWithContent);
      }

      // Available items in queue (not my own, not yet matched)
      const { data: queue, error: queueError } = await supabase
        .from('peer_review_queue' as any)
        .select('*')
        .eq('is_matched', false)
        .order('submitted_at', { ascending: true })
        .limit(10);

      if (queueError) {
        console.error('Error fetching queue:', queueError);
      } else {
        // Filter out my own submissions
        const filtered = ((queue as any) || []).filter((item: any) => {
          // We need to check if the draft belongs to current user
          return true; // Will be filtered in the component
        });
        setAvailableForReview(filtered);
      }
    } catch (error) {
      console.error('Error in usePeerReview:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPeerReviewData();
  }, [fetchPeerReviewData]);

  // Request a peer review for a draft
  const requestReview = useCallback(async (
    draftId: string,
    documentType: string,
    language: string,
    universityId?: string
  ) => {
    if (!user) return null;

    try {
      // Add to queue
      const { error: queueError } = await supabase
        .from('peer_review_queue' as any)
        .insert({
          draft_id: draftId,
          document_type: documentType,
          language: language,
          institution_id: universityId || null,
        });

      if (queueError) {
        console.error('Error adding to queue:', queueError);
        toast.error('Failed to request peer review');
        return null;
      }

      // Create peer review entry
      const { data: review, error: reviewError } = await supabase
        .from('peer_reviews' as any)
        .insert({
          draft_id: draftId,
          author_id: user.id,
          anonymous_name: getRandomAnonymousName(),
          status: 'pending',
        })
        .select()
        .single();

      if (reviewError) {
        console.error('Error creating review:', reviewError);
        toast.error('Failed to request peer review');
        return null;
      }

      toast.success('Peer review requested! You\'ll be notified when a reviewer provides feedback.');
      await fetchPeerReviewData();
      return review as unknown as PeerReview;
    } catch (error) {
      console.error('Error requesting review:', error);
      toast.error('Failed to request peer review');
      return null;
    }
  }, [user, fetchPeerReviewData]);

  // Claim a review to give
  const claimReview = useCallback(async (queueItemId: string, draftId: string) => {
    if (!user) return null;

    try {
      // Find the peer review entry
      const { data: reviews, error: findError } = await supabase
        .from('peer_reviews' as any)
        .select('*')
        .eq('draft_id', draftId)
        .eq('status', 'pending')
        .is('reviewer_id', null)
        .limit(1);

      if (findError || !reviews || reviews.length === 0) {
        toast.error('This review is no longer available');
        return null;
      }

      const review = reviews[0] as any;

      // Don't let users review their own work
      if (review.author_id === user.id) {
        toast.error('You cannot review your own work');
        return null;
      }

      // Claim the review
      const { error: claimError } = await supabase
        .from('peer_reviews' as any)
        .update({
          reviewer_id: user.id,
          status: 'in_progress',
        })
        .eq('id', review.id);

      if (claimError) {
        console.error('Error claiming review:', claimError);
        toast.error('Failed to claim review');
        return null;
      }

      // Mark queue item as matched
      await supabase
        .from('peer_review_queue' as any)
        .update({ is_matched: true })
        .eq('id', queueItemId);

      toast.success('Review claimed! Please provide your feedback.');
      await fetchPeerReviewData();
      return review as unknown as PeerReview;
    } catch (error) {
      console.error('Error claiming review:', error);
      toast.error('Failed to claim review');
      return null;
    }
  }, [user, fetchPeerReviewData]);

  // Submit a review
  const submitReview = useCallback(async (
    reviewId: string,
    feedback: string,
    rating: number,
    strengths: string[],
    improvements: string[]
  ) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('peer_reviews' as any)
        .update({
          review_feedback: feedback,
          rating: rating,
          strengths: strengths,
          improvements: improvements,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', reviewId)
        .eq('reviewer_id', user.id);

      if (error) {
        console.error('Error submitting review:', error);
        toast.error('Failed to submit review');
        return false;
      }

      toast.success('Review submitted! Thank you for helping a fellow student.');
      await fetchPeerReviewData();
      return true;
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error('Failed to submit review');
      return false;
    }
  }, [user, fetchPeerReviewData]);

  return {
    myReviewsReceived,
    myReviewsToGive,
    availableForReview,
    isLoading,
    requestReview,
    claimReview,
    submitReview,
    refetch: fetchPeerReviewData,
    pendingReviewsCount: myReviewsToGive.length,
    completedReviewsCount: myReviewsReceived.filter(r => r.status === 'completed').length,
  };
}
