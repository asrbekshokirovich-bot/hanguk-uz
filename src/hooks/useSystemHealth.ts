import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type HealthStatus = 'green' | 'amber' | 'red';

interface HealthData {
  nodeHealth: Map<string, HealthStatus>;
  healthMessages: Map<string, string>;
  loading: boolean;
  lastRefreshed: Date | null;
  refresh: () => void;
  summary: { green: number; amber: number; red: number; total: number };
}

function computeHealthPropagation(
  directHealth: Map<string, HealthStatus>,
  connections: Array<{ from: string; to: string }>
): Map<string, HealthStatus> {
  const result = new Map(directHealth);

  const children = new Map<string, string[]>();
  for (const conn of connections) {
    const arr = children.get(conn.from) || [];
    arr.push(conn.to);
    children.set(conn.from, arr);
  }

  function getEffectiveHealth(nodeId: string, visited: Set<string>): HealthStatus | null {
    if (visited.has(nodeId)) return result.get(nodeId) || null;
    visited.add(nodeId);

    if (result.has(nodeId)) return result.get(nodeId)!;

    const kids = children.get(nodeId) || [];
    const childStatuses: HealthStatus[] = [];
    for (const kid of kids) {
      const s = getEffectiveHealth(kid, visited);
      if (s) childStatuses.push(s);
    }

    if (childStatuses.length === 0) return null;

    const redCount = childStatuses.filter(s => s === 'red').length;
    const amberCount = childStatuses.filter(s => s === 'amber').length;

    let status: HealthStatus;
    if (redCount > childStatuses.length / 2) {
      status = 'red';
    } else if (redCount > 0 || amberCount > childStatuses.length / 2) {
      status = 'amber';
    } else if (amberCount > 0) {
      status = 'amber';
    } else {
      status = 'green';
    }

    result.set(nodeId, status);
    return status;
  }

  const topNodes = ['hub', 'portal-student', 'portal-crm', 'portal-uni', 'portal-interview', 'portal-study', 'portal-public'];
  const visited = new Set<string>();
  for (const node of topNodes) {
    getEffectiveHealth(node, visited);
  }

  return result;
}

export function useSystemHealth(
  connections: Array<{ from: string; to: string }>,
  tableHealthNodeIds?: string[]
): HealthData {
  const [directHealth, setDirectHealth] = useState<Map<string, HealthStatus>>(new Map());
  const [directMessages, setDirectMessages] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    const health = new Map<string, HealthStatus>();
    const messages = new Map<string, string>();

    const setHealth = (id: string, status: HealthStatus, message: string) => {
      health.set(id, status);
      messages.set(id, message);
    };

    try {
      const [
        paymentsRes, tasksRes, leadsRes, threadsRes, applicationsRes,
        profilesRes, interviewRes, studyPlansRes, universitiesRes, presenceRes,
        programsRes, announcementsRes, eventsRes, roomsRes, scholarshipsRes, documentsRes,
        staffBonusesRes, studentBudgetsRes, studySessionsRes, searchJobsRes,
        userRolesRes, pushTokensRes, studentAchievementsRes, translationJobsRes,
        taskCommentsRes, studentNotesRes, scheduledPaymentsRes, systemSettingsRes,
      ] = await Promise.all([
        supabase.from('payments').select('status', { count: 'exact', head: false }),
        supabase.from('tasks').select('status', { count: 'exact', head: false }),
        supabase.from('leads').select('status, updated_at', { count: 'exact', head: false }).eq('qualified', true),
        supabase.from('message_threads').select('unread_count'),
        supabase.from('applications').select('status, updated_at', { count: 'exact', head: false }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('interview_sessions').select('created_at, status, student_id', { count: 'exact' }).order('created_at', { ascending: false }).limit(1),
        supabase.from('study_plan_drafts').select('created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('institutions').select('id, primary_admissions_url_ko'),
        supabase.from('staff_presence').select('last_seen, status'),
        supabase.from('university_programs').select('id', { count: 'exact', head: true }),
        Promise.resolve({ data: null, error: null, count: 0 }),  // university_announcements retired 2026-05-10
        Promise.resolve({ data: null, error: null, count: 0 }),  // university_events retired 2026-05-10
        supabase.from('university_rooms').select('id', { count: 'exact', head: true }),
        supabase.from('scholarships').select('id', { count: 'exact', head: true }),
        supabase.from('documents').select('id', { count: 'exact', head: true }),
        // New health checks
        supabase.from('staff_bonuses').select('id', { count: 'exact', head: true }),
        supabase.from('student_budgets').select('id', { count: 'exact', head: true }),
        supabase.from('study_plan_sessions').select('id', { count: 'exact', head: true }),
        supabase.from('search_jobs').select('status', { count: 'exact', head: false }),
        supabase.from('user_roles').select('id', { count: 'exact', head: true }),
        supabase.from('push_tokens').select('id', { count: 'exact', head: true }),
        supabase.from('student_achievements').select('id', { count: 'exact', head: true }),
        supabase.from('translation_jobs').select('id', { count: 'exact', head: true }),
        supabase.from('task_comments').select('id', { count: 'exact', head: true }),
        supabase.from('student_notes').select('id', { count: 'exact', head: true }),
        supabase.from('scheduled_payments').select('id', { count: 'exact', head: true }),
        supabase.from('system_settings').select('id', { count: 'exact', head: true }),
      ]);

      // --- Payments Health ---
      if (paymentsRes.data && paymentsRes.data.length > 0) {
        const total = paymentsRes.data.length;
        const overdue = paymentsRes.data.filter((p: any) => p.status === 'overdue' || p.status === 'partial').length;
        const ratio = overdue / total;
        const pct = Math.round(ratio * 100);
        const status: HealthStatus = ratio > 0.3 ? 'red' : ratio > 0.1 ? 'amber' : 'green';
        const msg = status === 'green'
          ? 'All payments are up to date'
          : `${pct}% of payments are overdue or partially paid`;
        setHealth('db-payments', status, msg);
        setHealth('h-payments', status, msg);
        setHealth('db-payment_transactions', status, msg);
      } else {
        setHealth('db-payments', 'amber', 'No payment records found yet');
      }

      // --- Tasks Health ---
      if (tasksRes.data && tasksRes.data.length > 0) {
        const total = tasksRes.data.length;
        const done = tasksRes.data.filter((t: any) => t.status === 'completed').length;
        const ratio = done / total;
        const pct = Math.round(ratio * 100);
        const status: HealthStatus = ratio > 0.7 ? 'green' : ratio > 0.4 ? 'amber' : 'red';
        const msg = status === 'green'
          ? `${pct}% of tasks are completed`
          : status === 'amber'
            ? `Only ${pct}% of tasks are completed — more than half still pending`
            : `Only ${pct}% of tasks are completed — most tasks are still open`;
        setHealth('h-tasks', status, msg);
        setHealth('db-tasks', status, msg);
      } else {
        setHealth('h-tasks', 'amber', 'No tasks found yet');
        setHealth('db-tasks', 'amber', 'No tasks found yet');
      }

      // --- Leads Health ---
      if (leadsRes.data && leadsRes.data.length > 0) {
        const now = Date.now();
        const stale = leadsRes.data.filter((l: any) => {
          const updated = new Date(l.updated_at).getTime();
          return (now - updated) > 30 * 24 * 60 * 60 * 1000;
        }).length;
        const ratio = stale / leadsRes.data.length;
        const pct = Math.round(ratio * 100);
        const status: HealthStatus = ratio > 0.6 ? 'red' : ratio > 0.3 ? 'amber' : 'green';
        const msg = status === 'green'
          ? 'Leads are being updated regularly'
          : `${pct}% of leads haven't been updated in over 30 days`;
        setHealth('db-leads', status, msg);
        setHealth('h-leads', status, msg);
        setHealth('db-lead_notes', status, msg);
      } else {
        setHealth('db-leads', 'amber', 'No leads found yet');
      }

      // --- Messages Health ---
      if (threadsRes.data) {
        const totalUnread = threadsRes.data.reduce((sum: number, t: any) => sum + (t.unread_count || 0), 0);
        const status: HealthStatus = totalUnread > 20 ? 'red' : totalUnread > 5 ? 'amber' : 'green';
        const msg = status === 'green'
          ? 'No backlog of unread messages'
          : `${totalUnread} unread messages are piling up across all threads`;
        setHealth('db-message_threads', status, msg);
        setHealth('db-messages', status, msg);
        setHealth('h-msgs', status, msg);
      }

      // --- Applications Health ---
      if (applicationsRes.data && applicationsRes.data.length > 0) {
        const now = Date.now();
        const stuck = applicationsRes.data.filter((a: any) => {
          const updated = new Date(a.updated_at).getTime();
          return a.status === 'pending' && (now - updated) > 7 * 24 * 60 * 60 * 1000;
        }).length;
        const ratio = stuck / applicationsRes.data.length;
        const pct = Math.round(ratio * 100);
        const status: HealthStatus = ratio > 0.3 ? 'red' : ratio > 0.1 ? 'amber' : 'green';
        const msg = status === 'green'
          ? 'Applications are progressing normally'
          : `${pct}% of pending applications are stuck with no update in 7+ days`;
        setHealth('db-applications', status, msg);
        setHealth('h-crmdata', status, msg);
        setHealth('h-studentdata', status, msg);
      } else {
        setHealth('db-applications', 'amber', 'No application records found yet');
      }

      // --- Profiles Health ---
      const profileCount = profilesRes.count ?? 0;
      const profileStatus: HealthStatus = profileCount > 0 ? 'green' : 'red';
      const profileMsg = profileCount > 0
        ? `${profileCount} user profile${profileCount === 1 ? '' : 's'} registered`
        : 'No user profiles found in the system';
      setHealth('db-profiles', profileStatus, profileMsg);

      // --- Interview Sessions Health ---
      if (interviewRes.data && interviewRes.data.length > 0) {
        const totalSessions = interviewRes.count ?? 0;
        const lastUsed = new Date(interviewRes.data[0].created_at).getTime();
        const daysSince = Math.round((Date.now() - lastUsed) / (24 * 60 * 60 * 1000));
        const status: HealthStatus = daysSince < 7 ? 'green' : daysSince < 30 ? 'amber' : 'red';
        const lastUsedStr = daysSince === 0 ? 'today' : `${daysSince} day${daysSince === 1 ? '' : 's'} ago`;
        const msg = `${totalSessions} session${totalSessions === 1 ? '' : 's'} recorded — last used ${lastUsedStr}`;
        setHealth('db-interview_sessions', status, msg);
        setHealth('h-intsession', status, msg);
        setHealth('db-interview_messages', status, msg);
        setHealth('db-interview_feedback', status, msg);
      } else {
        setHealth('db-interview_sessions', 'amber', 'No interview sessions yet — feature is ready for students');
        setHealth('h-intsession', 'amber', 'No interview sessions yet — feature is ready for students');
      }

      // --- Study Plans Health ---
      if (studyPlansRes.data && studyPlansRes.data.length > 0) {
        const lastUpdated = new Date(studyPlansRes.data[0].created_at).getTime();
        const daysSince = Math.round((Date.now() - lastUpdated) / (24 * 60 * 60 * 1000));
        const status: HealthStatus = daysSince < 7 ? 'green' : daysSince < 30 ? 'amber' : 'red';
        const msg = status === 'green'
          ? `Study plans active — last updated ${daysSince === 0 ? 'today' : `${daysSince} day${daysSince === 1 ? '' : 's'} ago`}`
          : `Study plans last updated ${daysSince} days ago — no recent activity`;
        setHealth('db-study_plan_drafts', status, msg);
        setHealth('h-studentplan', status, msg);
      } else {
        setHealth('db-study_plan_drafts', 'red', 'No study plans have been created yet');
      }

      // --- Universities Health ---
      if (universitiesRes.data && universitiesRes.data.length > 0) {
        const missing = universitiesRes.data.filter((u: any) => u.website == null).length; // null = not searched; '' = searched but not found (correct)
        const ratio = missing / universitiesRes.data.length;
        const pct = Math.round(ratio * 100);
        const status: HealthStatus = ratio > 0.5 ? 'red' : ratio > 0.2 ? 'amber' : 'green';
        const msg = status === 'green'
          ? 'University records are complete'
          : `${pct}% of university records are missing website information`;
        setHealth('db-universities', status, msg);
        setHealth('h-unis', status, msg);
      } else {
        setHealth('db-universities', 'red', 'No university records found');
      }

      // --- Staff Presence Health ---
      if (presenceRes.data) {
        const now = Date.now();
        const online = presenceRes.data.filter((p: any) => {
          const lastSeen = new Date(p.last_seen).getTime();
          return (now - lastSeen) < 60000 && p.status === 'online';
        }).length;
        const status: HealthStatus = online > 2 ? 'green' : online > 0 ? 'amber' : 'red';
        const msg = online > 2
          ? `${online} staff members currently online`
          : online > 0
            ? `Only ${online} staff member${online === 1 ? '' : 's'} online right now`
            : 'No staff members are currently online';
        setHealth('h-staffpresence', status, msg);
        setHealth('db-staff_presence', status, msg);
      }

      // --- University Programs Health ---
      const programCount = programsRes.count ?? 0;
      if (programCount > 0) {
        setHealth('db-university_programs', 'green', `${programCount} university programs listed`);
      } else {
        setHealth('db-university_programs', 'red', 'No university programs have been added — Student Portal Program Finder is empty');
      }

      // --- University Announcements Health ---
      const announcementCount = announcementsRes.count ?? 0;
      if (announcementCount > 0) {
        setHealth('db-university_announcements', 'green', `${announcementCount} announcements posted`);
      } else {
        setHealth('db-university_announcements', 'amber', 'No university announcements yet — students will see an empty feed');
      }

      // --- University Events Health ---
      const eventCount = eventsRes.count ?? 0;
      if (eventCount > 0) {
        setHealth('db-university_events', 'green', `${eventCount} university events scheduled`);
      } else {
        setHealth('db-university_events', 'amber', 'No university events scheduled — student calendars are empty');
      }

      // --- University Rooms Health ---
      const roomCount = roomsRes.count ?? 0;
      if (roomCount > 0) {
        setHealth('db-university_rooms', 'green', `${roomCount} university rooms created`);
      } else {
        setHealth('db-university_rooms', 'red', 'No university rooms exist — students cannot access their application rooms');
      }

      // --- Scholarships Health ---
      const scholarshipCount = scholarshipsRes.count ?? 0;
      if (scholarshipCount > 0) {
        setHealth('db-scholarships', 'green', `${scholarshipCount} scholarships listed`);
      } else {
        setHealth('db-scholarships', 'amber', 'No scholarships listed — scholarship section is empty for students');
      }

      // --- Documents Health ---
      const documentCount = documentsRes.count ?? 0;
      if (documentCount > 0) {
        setHealth('db-documents', 'green', `${documentCount} documents uploaded`);
      } else {
        setHealth('db-documents', 'amber', 'No documents uploaded yet');
      }

      // === NEW HEALTH CHECKS (Step 4) ===

      // --- Staff Bonuses Health ---
      try {
        const bonusCount = staffBonusesRes.count ?? 0;
        setHealth('db-staff_bonuses', bonusCount > 0 ? 'green' : 'amber',
          bonusCount > 0 ? `${bonusCount} staff bonus records on file` : 'No staff bonuses recorded yet');
      } catch (e) { /* isolated */ }

      // --- Student Budgets Health ---
      try {
        const budgetCount = studentBudgetsRes.count ?? 0;
        setHealth('db-student_budgets', budgetCount > 0 ? 'green' : 'red',
          budgetCount > 0 ? `${budgetCount} student budget records active` : 'No student budgets found — finance tracking unavailable');
      } catch (e) { /* isolated */ }

      // --- Study Plan Sessions Health ---
      try {
        const sessionCount = studySessionsRes.count ?? 0;
        setHealth('db-study_plan_sessions', sessionCount > 0 ? 'green' : 'amber',
          sessionCount > 0 ? `${sessionCount} study sessions recorded` : 'No study sessions recorded yet');
      } catch (e) { /* isolated */ }

      // --- Search Jobs Health (zombie detection) ---
      try {
        if (searchJobsRes.data) {
          const stuckJobs = searchJobsRes.data.filter((j: any) => j.status === 'processing').length;
          const totalJobs = searchJobsRes.data.length;
          const searchStatus: HealthStatus = stuckJobs > 5 ? 'red' : stuckJobs > 0 ? 'amber' : totalJobs > 0 ? 'green' : 'amber';
          const searchMsg = stuckJobs > 5
            ? `${stuckJobs} search jobs are stuck in processing — zombie jobs detected`
            : stuckJobs > 0
              ? `${stuckJobs} search job${stuckJobs === 1 ? '' : 's'} stuck in processing`
              : totalJobs > 0
                ? `${totalJobs} search jobs completed normally`
                : 'No search jobs found yet';
          setHealth('db-search_jobs', searchStatus, searchMsg);
        }
      } catch (e) { /* isolated */ }

      // --- User Roles Health (critical — auth broken if 0) ---
      try {
        const roleCount = userRolesRes.count ?? 0;
        setHealth('db-user_roles', roleCount > 0 ? 'green' : 'red',
          roleCount > 0 ? `${roleCount} user role${roleCount === 1 ? '' : 's'} assigned` : 'No user roles found — authentication system may be broken');
      } catch (e) { /* isolated */ }

      // --- Push Tokens Health ---
      try {
        const tokenCount = pushTokensRes.count ?? 0;
        setHealth('db-push_tokens', tokenCount > 0 ? 'green' : 'amber',
          tokenCount > 0 ? `${tokenCount} push notification token${tokenCount === 1 ? '' : 's'} registered` : 'No push tokens registered — native push notifications not yet active');
      } catch (e) { /* isolated */ }

      // --- Student Achievements Health ---
      try {
        const achievementCount = studentAchievementsRes.count ?? 0;
        setHealth('db-student_achievements', achievementCount > 0 ? 'green' : 'amber',
          achievementCount > 0 ? `${achievementCount} student achievement${achievementCount === 1 ? '' : 's'} earned` : 'No achievements earned yet — gamification feature is ready');
      } catch (e) { /* isolated */ }

      // --- Translation Jobs Health ---
      try {
        const translationJobCount = translationJobsRes.count ?? 0;
        setHealth('db-translation_jobs', translationJobCount > 0 ? 'green' : 'amber',
          translationJobCount > 0 ? `${translationJobCount} translation job${translationJobCount === 1 ? '' : 's'} processed` : 'No translation jobs yet — feature is ready');
      } catch (e) { /* isolated */ }

      // --- Task Comments Health ---
      try {
        const taskCommentCount = taskCommentsRes.count ?? 0;
        setHealth('db-task_comments', taskCommentCount > 0 ? 'green' : 'amber',
          taskCommentCount > 0 ? `${taskCommentCount} task comment${taskCommentCount === 1 ? '' : 's'} recorded` : 'No task comments yet');
      } catch (e) { /* isolated */ }

      // --- Student Notes Health ---
      try {
        const studentNoteCount = studentNotesRes.count ?? 0;
        setHealth('db-student_notes', studentNoteCount > 0 ? 'green' : 'amber',
          studentNoteCount > 0 ? `${studentNoteCount} student note${studentNoteCount === 1 ? '' : 's'} on file` : 'No student notes yet');
      } catch (e) { /* isolated */ }

      // --- Scheduled Payments Health ---
      try {
        const scheduledCount = scheduledPaymentsRes.count ?? 0;
        setHealth('db-scheduled_payments', scheduledCount > 0 ? 'green' : 'amber',
          scheduledCount > 0 ? `${scheduledCount} scheduled payment${scheduledCount === 1 ? '' : 's'} configured` : 'No scheduled payments configured yet');
      } catch (e) { /* isolated */ }

      // --- System Settings Health ---
      try {
        const settingsCount = systemSettingsRes.count ?? 0;
        setHealth('db-system_settings', settingsCount > 0 ? 'green' : 'amber',
          settingsCount > 0 ? 'System settings are configured' : 'No system settings found — defaults in use');
      } catch (e) { /* isolated */ }

      // --- Applications Health (supplement existing check) ---
      if (!applicationsRes.data || applicationsRes.data.length === 0) {
        setHealth('db-applications', 'amber', 'No applications yet — application period has not started');
      }

      // Fill remaining DB table nodes from registry with green
      const nodeIds = tableHealthNodeIds || [];
      for (const nodeId of nodeIds) {
        if (!health.has(nodeId)) {
          health.set(nodeId, 'green');
          messages.set(nodeId, 'No issues detected');
        }
      }

    } catch (err) {
      console.error('Health check failed:', err);
    }

    setDirectHealth(health);
    setDirectMessages(messages);
    setLastRefreshed(new Date());
    setLoading(false);
  }, [tableHealthNodeIds]);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 60000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const nodeHealth = useMemo(
    () => computeHealthPropagation(directHealth, connections),
    [directHealth, connections]
  );

  // Build healthMessages: direct messages for leaf nodes,
  // propagated fallback for portal/group nodes that inherit status
  const healthMessages = useMemo(() => {
    const msgs = new Map<string, string>(directMessages);
    nodeHealth.forEach((status, nodeId) => {
      if (!msgs.has(nodeId) && (status === 'amber' || status === 'red')) {
        msgs.set(nodeId, 'One or more connected parts have issues — click those nodes for details');
      }
    });
    return msgs;
  }, [directMessages, nodeHealth]);

  const summary = useMemo(() => {
    let green = 0, amber = 0, red = 0;
    nodeHealth.forEach(v => {
      if (v === 'green') green++;
      else if (v === 'amber') amber++;
      else red++;
    });
    return { green, amber, red, total: green + amber + red };
  }, [nodeHealth]);

  return { nodeHealth, healthMessages, loading, lastRefreshed, refresh: fetchHealth, summary };
}
