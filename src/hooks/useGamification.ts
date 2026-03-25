import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Achievement {
  id: string;
  type: string;
  name: string;
  description: string;
  icon: string;
  condition: string;
  earnedAt?: string;
}

export interface WritingStreak {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
  totalWordsWritten: number;
  totalSessionsCompleted: number;
}

// Achievement definitions
export const achievementDefinitions: Achievement[] = [
  {
    id: 'first_draft',
    type: 'first_draft',
    name: 'First Steps',
    description: 'Complete your first writing session',
    icon: 'Pencil',
    condition: 'sessions >= 1',
  },
  {
    id: 'word_master',
    type: 'word_master',
    name: 'Word Master',
    description: 'Write 5,000+ total words',
    icon: 'BookOpen',
    condition: 'words >= 5000',
  },
  {
    id: 'perfect_score',
    type: 'perfect_score',
    name: 'Perfectionist',
    description: 'Achieve a 10/10 analysis score',
    icon: 'Trophy',
    condition: 'score == 10',
  },
  {
    id: 'streak_keeper',
    type: 'streak_keeper',
    name: 'Streak Keeper',
    description: 'Maintain a 7-day writing streak',
    icon: 'Flame',
    condition: 'streak >= 7',
  },
  {
    id: 'revision_pro',
    type: 'revision_pro',
    name: 'Revision Pro',
    description: 'Revise a document 3+ times with improvement',
    icon: 'RefreshCw',
    condition: 'revisions >= 3',
  },
  {
    id: 'university_expert',
    type: 'university_expert',
    name: 'University Expert',
    description: 'Complete documents for 3+ universities',
    icon: 'GraduationCap',
    condition: 'universities >= 3',
  },
  {
    id: 'grammar_guru',
    type: 'grammar_guru',
    name: 'Grammar Guru',
    description: 'Have fewer than 5 grammar errors in an analysis',
    icon: 'Check',
    condition: 'errors < 5',
  },
  {
    id: 'early_bird',
    type: 'early_bird',
    name: 'Early Bird',
    description: 'Complete a session before 8 AM',
    icon: 'Sun',
    condition: 'early_session',
  },
  {
    id: 'night_owl',
    type: 'night_owl',
    name: 'Night Owl',
    description: 'Complete a session after 10 PM',
    icon: 'Moon',
    condition: 'late_session',
  },
  {
    id: 'speed_writer',
    type: 'speed_writer',
    name: 'Speed Writer',
    description: 'Write 500+ words in a single session',
    icon: 'Zap',
    condition: 'session_words >= 500',
  },
];

export function useGamification() {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [streak, setStreak] = useState<WritingStreak>({
    currentStreak: 0,
    longestStreak: 0,
    lastActivityDate: null,
    totalWordsWritten: 0,
    totalSessionsCompleted: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);

  // Calculate XP and level
  const calculateLevel = useCallback((totalXp: number) => {
    // XP required for each level: 100, 250, 500, 1000, 2000...
    let currentLevel = 1;
    let xpRequired = 100;
    let remainingXp = totalXp;

    while (remainingXp >= xpRequired) {
      remainingXp -= xpRequired;
      currentLevel++;
      xpRequired = Math.floor(xpRequired * 1.5);
    }

    return { level: currentLevel, xpForNextLevel: xpRequired, currentXpInLevel: remainingXp };
  }, []);

  // Fetch achievements and streak data
  const fetchGamificationData = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch achievements - using type assertion for new table
      const { data: earnedAchievements, error: achievementsError } = await supabase
        .from('student_achievements' as any)
        .select('*')
        .eq('student_id', user.id);

      if (achievementsError) {
        console.error('Error fetching achievements:', achievementsError);
      }

      // Merge with definitions
      const mergedAchievements = achievementDefinitions.map(def => ({
        ...def,
        earnedAt: (earnedAchievements as any)?.find((a: any) => a.achievement_type === def.type)?.earned_at,
      }));
      setAchievements(mergedAchievements);

      // Fetch streak data - using type assertion for new table
      const { data: streakData, error: streakError } = await supabase
        .from('writing_streaks' as any)
        .select('*')
        .eq('student_id', user.id)
        .single();

      if (streakError && streakError.code !== 'PGRST116') {
        console.error('Error fetching streak:', streakError);
      }

      if (streakData) {
        const typedStreakData = streakData as any;
        setStreak({
          currentStreak: typedStreakData.current_streak || 0,
          longestStreak: typedStreakData.longest_streak || 0,
          lastActivityDate: typedStreakData.last_activity_date,
          totalWordsWritten: typedStreakData.total_words_written || 0,
          totalSessionsCompleted: typedStreakData.total_sessions_completed || 0,
        });

        // Calculate XP: 10 per word, 100 per session, 500 per achievement
        const earnedCount = mergedAchievements.filter(a => a.earnedAt).length;
        const totalXp = 
          (typedStreakData.total_words_written || 0) * 1 + 
          (typedStreakData.total_sessions_completed || 0) * 100 +
          earnedCount * 500;
        setXp(totalXp);
        const { level: calculatedLevel } = calculateLevel(totalXp);
        setLevel(calculatedLevel);
      }
    } catch (error) {
      console.error('Error in gamification:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, calculateLevel]);

  useEffect(() => {
    fetchGamificationData();
  }, [fetchGamificationData]);

  // Update streak when user writes
  const updateStreak = useCallback(async (wordsWritten: number) => {
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];

    try {
      // Check existing streak
      const { data: existingStreak } = await supabase
        .from('writing_streaks' as any)
        .select('*')
        .eq('student_id', user.id)
        .single();

      if (existingStreak) {
        const typedStreak = existingStreak as any;
        const lastDate = typedStreak.last_activity_date;
        let newStreak = typedStreak.current_streak;

        if (lastDate) {
          const lastDateObj = new Date(lastDate);
          const todayObj = new Date(today);
          const diffDays = Math.floor((todayObj.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24));

          if (diffDays === 1) {
            // Consecutive day
            newStreak += 1;
          } else if (diffDays > 1) {
            // Streak broken
            newStreak = 1;
          }
          // diffDays === 0 means same day, keep streak
        } else {
          newStreak = 1;
        }

        const newLongest = Math.max(newStreak, typedStreak.longest_streak);

        await supabase
          .from('writing_streaks' as any)
          .update({
            current_streak: newStreak,
            longest_streak: newLongest,
            last_activity_date: today,
            total_words_written: (typedStreak.total_words_written || 0) + wordsWritten,
            updated_at: new Date().toISOString(),
          })
          .eq('student_id', user.id);

        // Check for streak achievement
        if (newStreak >= 7) {
          await earnAchievement('streak_keeper');
        }
      } else {
        // Create new streak record
        await supabase
          .from('writing_streaks' as any)
          .insert({
            student_id: user.id,
            current_streak: 1,
            longest_streak: 1,
            last_activity_date: today,
            total_words_written: wordsWritten,
            total_sessions_completed: 0,
          });
      }

      // Check word master achievement
      const totalWords = (streak.totalWordsWritten || 0) + wordsWritten;
      if (totalWords >= 5000) {
        await earnAchievement('word_master');
      }

      await fetchGamificationData();
    } catch (error) {
      console.error('Error updating streak:', error);
    }
  }, [user, streak.totalWordsWritten, fetchGamificationData]);

  // Record session completion
  const recordSessionCompletion = useCallback(async () => {
    if (!user) return;

    try {
      const { data: existingStreak } = await supabase
        .from('writing_streaks' as any)
        .select('*')
        .eq('student_id', user.id)
        .single();

      if (existingStreak) {
        const typedStreak = existingStreak as any;
        const newTotal = (typedStreak.total_sessions_completed || 0) + 1;

        await supabase
          .from('writing_streaks' as any)
          .update({
            total_sessions_completed: newTotal,
            updated_at: new Date().toISOString(),
          })
          .eq('student_id', user.id);

        // Check first draft achievement
        if (newTotal === 1) {
          await earnAchievement('first_draft');
        }
      }

      await fetchGamificationData();
    } catch (error) {
      console.error('Error recording session:', error);
    }
  }, [user, fetchGamificationData]);

  // Earn an achievement
  const earnAchievement = useCallback(async (achievementType: string) => {
    if (!user) return;

    // Check if already earned
    const alreadyEarned = achievements.find(a => a.type === achievementType && a.earnedAt);
    if (alreadyEarned) return;

    try {
      const { error } = await supabase
        .from('student_achievements' as any)
        .insert({
          student_id: user.id,
          achievement_type: achievementType,
          achievement_data: {},
        });

      if (error && error.code !== '23505') { // Ignore duplicate key error
        console.error('Error earning achievement:', error);
        return;
      }

      const achievementDef = achievementDefinitions.find(a => a.type === achievementType);
      if (achievementDef) {
        toast.success(`🏆 Achievement Unlocked: ${achievementDef.name}!`, {
          description: achievementDef.description,
          duration: 5000,
        });
      }

      await fetchGamificationData();
    } catch (error) {
      console.error('Error earning achievement:', error);
    }
  }, [user, achievements, fetchGamificationData]);

  // Check for score-based achievements
  const checkScoreAchievement = useCallback(async (score: number, grammarErrors: number) => {
    if (score === 10) {
      await earnAchievement('perfect_score');
    }
    if (grammarErrors < 5) {
      await earnAchievement('grammar_guru');
    }
  }, [earnAchievement]);

  const earnedAchievements = achievements.filter(a => a.earnedAt);
  const unlockedCount = earnedAchievements.length;
  const progressPercentage = Math.round((unlockedCount / achievementDefinitions.length) * 100);

  return {
    achievements,
    earnedAchievements,
    streak,
    xp,
    level,
    isLoading,
    unlockedCount,
    totalAchievements: achievementDefinitions.length,
    progressPercentage,
    updateStreak,
    recordSessionCompletion,
    earnAchievement,
    checkScoreAchievement,
    refreshData: fetchGamificationData,
  };
}
