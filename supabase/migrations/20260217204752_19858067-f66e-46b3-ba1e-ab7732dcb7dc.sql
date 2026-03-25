
-- ═══════════════════════════════════════════════════════════════
-- SYSTEM MAP REGISTRY: Tables + Seed Data
-- ═══════════════════════════════════════════════════════════════

-- 1. Create system_map_nodes table
CREATE TABLE public.system_map_nodes (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  ring INTEGER NOT NULL CHECK (ring >= 0 AND ring <= 8),
  sector INTEGER NOT NULL DEFAULT 0 CHECK (sector >= 0 AND sector <= 5),
  color TEXT NOT NULL DEFAULT '#666',
  text_color TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Create system_map_connections table
CREATE TABLE public.system_map_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node TEXT NOT NULL REFERENCES public.system_map_nodes(id) ON DELETE CASCADE,
  to_node TEXT NOT NULL REFERENCES public.system_map_nodes(id) ON DELETE CASCADE,
  color TEXT,
  opacity NUMERIC NOT NULL DEFAULT 0.3,
  dashed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.system_map_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_map_connections ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies: read for authenticated, write for admin/owner
CREATE POLICY "Authenticated users can read nodes"
  ON public.system_map_nodes FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage nodes"
  ON public.system_map_nodes FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Authenticated users can read connections"
  ON public.system_map_connections FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage connections"
  ON public.system_map_connections FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

-- 5. Indexes
CREATE INDEX idx_system_map_nodes_ring ON public.system_map_nodes(ring);
CREATE INDEX idx_system_map_nodes_sector ON public.system_map_nodes(sector);
CREATE INDEX idx_system_map_connections_from ON public.system_map_connections(from_node);
CREATE INDEX idx_system_map_connections_to ON public.system_map_connections(to_node);

-- 6. Updated_at trigger for nodes
CREATE TRIGGER update_system_map_nodes_updated_at
  BEFORE UPDATE ON public.system_map_nodes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════
-- SEED: ALL NODES (~343)
-- ═══════════════════════════════════════════════════════════════

-- Center
INSERT INTO public.system_map_nodes (id, label, ring, sector, color) VALUES
('hub', 'Hanguk Platform', 0, 0, '#f97316');

-- Ring 1: Portals
INSERT INTO public.system_map_nodes (id, label, ring, sector, color) VALUES
('portal-student', 'Student Portal', 1, 0, '#3b82f6'),
('portal-crm', 'Staff CRM', 1, 1, '#f59e0b'),
('portal-uni', 'University Staff', 1, 2, '#14b8a6'),
('portal-interview', 'Interview Practice', 1, 3, '#a855f7'),
('portal-study', 'Study Plan Trainer', 1, 4, '#8b5cf6'),
('portal-public', 'Public Pages', 1, 5, '#22c55e');

-- Ring 2: Feature Groups
INSERT INTO public.system_map_nodes (id, label, ring, sector, color) VALUES
('student-features', 'Features', 2, 0, '#3b82f6'),
('student-uni', 'University', 2, 0, '#3b82f6'),
('crm-home', 'Home', 2, 1, '#f59e0b'),
('crm-comm', 'Communication', 2, 1, '#f59e0b'),
('crm-mgmt', 'Management', 2, 1, '#f59e0b'),
('crm-finance', 'Finance', 2, 1, '#f59e0b'),
('crm-admin', 'Admin', 2, 1, '#f59e0b'),
('uni-features', 'Features', 2, 2, '#14b8a6'),
('int-flow', 'Interview Flow', 2, 3, '#a855f7'),
('study-tools', 'Tools', 2, 4, '#8b5cf6'),
('pub-group', 'Public', 2, 5, '#22c55e');

-- Ring 3: Pages
INSERT INTO public.system_map_nodes (id, label, ring, sector, color) VALUES
-- Student
('sp-apps', 'Applications', 3, 0, '#3b82f6'), ('sp-map', 'University Map', 3, 0, '#3b82f6'),
('sp-programs', 'Programs', 3, 0, '#3b82f6'), ('sp-docs', 'Documents', 3, 0, '#3b82f6'),
('sp-ai', 'AI Chat', 3, 0, '#3b82f6'), ('sp-insights', 'Insights', 3, 0, '#3b82f6'),
('sp-room', 'Room', 3, 0, '#3b82f6'), ('sp-cal', 'Calendar', 3, 0, '#3b82f6'),
-- CRM
('crm-dash', 'Dashboard', 3, 1, '#f59e0b'), ('crm-ai', 'AI Assistant', 3, 1, '#f59e0b'),
('crm-students', 'Students', 3, 1, '#f59e0b'), ('crm-apps', 'Applications', 3, 1, '#f59e0b'),
('crm-msgs', 'Messages', 3, 1, '#f59e0b'), ('crm-calls', 'Calls', 3, 1, '#f59e0b'),
('crm-intercom', 'Live Intercom', 3, 1, '#f59e0b'), ('crm-leads', 'Leads', 3, 1, '#f59e0b'),
('crm-tasks', 'Tasks', 3, 1, '#f59e0b'), ('crm-cal', 'Calendar', 3, 1, '#f59e0b'),
('crm-unis', 'Universities', 3, 1, '#f59e0b'), ('crm-translate', 'Translation', 3, 1, '#f59e0b'),
('crm-kakao', 'Kakao Map', 3, 1, '#f59e0b'),
('crm-fin-overview', 'Money Overview', 3, 1, '#f59e0b'), ('crm-fin-students', 'Student Finances', 3, 1, '#f59e0b'),
('crm-fin-budgets', 'Budgets', 3, 1, '#f59e0b'), ('crm-fin-monthly', 'Monthly Bills', 3, 1, '#f59e0b'),
('crm-fin-sched', 'Scheduled Payments', 3, 1, '#f59e0b'), ('crm-fin-trans', 'Transactions', 3, 1, '#f59e0b'),
('crm-fin-dist', 'Money Distribution', 3, 1, '#f59e0b'), ('crm-fin-bonus', 'Staff Bonuses', 3, 1, '#f59e0b'),
('crm-fin-payments', 'All Payments', 3, 1, '#f59e0b'), ('crm-fin-reports', 'Finance Reports', 3, 1, '#f59e0b'),
('crm-staff', 'Staff', 3, 1, '#f59e0b'), ('crm-settings', 'Settings', 3, 1, '#f59e0b'),
-- Uni
('uni-applicants', 'Applicants', 3, 2, '#14b8a6'), ('uni-announce', 'Announcements', 3, 2, '#14b8a6'),
('uni-cal', 'Calendar', 3, 2, '#14b8a6'), ('uni-chat', 'Room Chat', 3, 2, '#14b8a6'),
-- Interview
('int-gate', 'Access Check', 3, 3, '#a855f7'), ('int-avatar', 'AI Interviewer', 3, 3, '#a855f7'),
('int-transcript', 'Transcript', 3, 3, '#a855f7'), ('int-timer', 'Timer', 3, 3, '#a855f7'),
('int-playback', 'Playback', 3, 3, '#a855f7'), ('int-feedback', 'Feedback', 3, 3, '#a855f7'),
('int-analytics', 'Analytics', 3, 3, '#a855f7'),
-- Study
('study-gate', 'Access Check', 3, 4, '#8b5cf6'), ('study-editor', 'Editor', 3, 4, '#8b5cf6'),
('study-writing', 'Writing', 3, 4, '#8b5cf6'), ('study-templates', 'Templates', 3, 4, '#8b5cf6'),
('study-analysis', 'AI Analysis', 3, 4, '#8b5cf6'), ('study-req', 'Requirements', 3, 4, '#8b5cf6'),
('study-peer', 'Peer Review', 3, 4, '#8b5cf6'), ('study-achievements', 'Achievements', 3, 4, '#8b5cf6'),
('study-sessions', 'Sessions', 3, 4, '#8b5cf6'), ('study-tutorial', 'Tutorial', 3, 4, '#8b5cf6'),
-- Public
('pub-index', 'Landing', 3, 5, '#22c55e'), ('pub-auth', 'Auth', 3, 5, '#22c55e'),
('pub-install', 'Install', 3, 5, '#22c55e'), ('pub-privacy', 'Privacy', 3, 5, '#22c55e'),
('pub-terms', 'Terms', 3, 5, '#22c55e'), ('pub-notfound', '404', 3, 5, '#22c55e'),
('pub-sysmap', 'System Map', 3, 5, '#22c55e');

-- Ring 4: Components (~120)
INSERT INTO public.system_map_nodes (id, label, ring, sector, color) VALUES
-- Student components
('sc-tracker', 'Application Tracker', 4, 0, '#3b82f6'), ('sc-badge', 'Eligibility Badge', 4, 0, '#3b82f6'),
('sc-process', 'Process Tracker', 4, 0, '#3b82f6'), ('sc-kakao', 'University Map', 4, 0, '#3b82f6'),
('sc-panorama', 'Panorama Viewer', 4, 0, '#3b82f6'), ('sc-selbar', 'Selection Bar', 4, 0, '#3b82f6'),
('sc-finder', 'Program Finder', 4, 0, '#3b82f6'), ('sc-pcard', 'Program Card', 4, 0, '#3b82f6'),
('sc-filter', 'Filter Bar', 4, 0, '#3b82f6'), ('sc-scholarship', 'Scholarship Card', 4, 0, '#3b82f6'),
('sc-compare-q', 'Compare Quiz', 4, 0, '#3b82f6'), ('sc-docup', 'Document Upload', 4, 0, '#3b82f6'),
('sc-hanguk', 'AI Chat', 4, 0, '#3b82f6'), ('sc-compare', 'Compare Chat', 4, 0, '#3b82f6'),
('sc-insightpanel', 'Insights Panel', 4, 0, '#3b82f6'), ('sc-announce', 'Announcements', 4, 0, '#3b82f6'),
('sc-room', 'University Room', 4, 0, '#3b82f6'), ('sc-roomchat', 'Room Chat', 4, 0, '#3b82f6'),
('sc-ucal', 'University Calendar', 4, 0, '#3b82f6'),
-- CRM components
('cc-dash', 'CRM Dashboard', 4, 1, '#f59e0b'), ('cc-sidebar', 'CRM Sidebar', 4, 1, '#f59e0b'),
('cc-subnav', 'Sub Menu', 4, 1, '#f59e0b'), ('cc-quick', 'Quick Tools', 4, 1, '#f59e0b'),
('cc-notifbell', 'Alerts', 4, 1, '#f59e0b'), ('cc-aiasst', 'AI Assistant', 4, 1, '#f59e0b'),
('cc-aiinsight', 'AI Analysis', 4, 1, '#f59e0b'), ('cc-slist', 'Student List', 4, 1, '#f59e0b'),
('cc-scard', 'Student Card', 4, 1, '#f59e0b'), ('cc-sdetail', 'Student Detail', 4, 1, '#f59e0b'),
('cc-addstu', 'Add Student', 4, 1, '#f59e0b'), ('cc-editstu', 'Edit Student', 4, 1, '#f59e0b'),
('cc-delstu', 'Delete Student', 4, 1, '#f59e0b'), ('cc-contract', 'Upload Contract', 4, 1, '#f59e0b'),
('cc-appforms', 'Application Forms', 4, 1, '#f59e0b'), ('cc-msgcontent', 'Messages View', 4, 1, '#f59e0b'),
('cc-threadlist', 'Chat Threads', 4, 1, '#f59e0b'), ('cc-chatview', 'Chat Window', 4, 1, '#f59e0b'),
('cc-commcenter', 'Message Hub', 4, 1, '#f59e0b'), ('cc-callcontent', 'Calls View', 4, 1, '#f59e0b'),
('cc-calllist', 'Call List', 4, 1, '#f59e0b'), ('cc-callform', 'Call Form', 4, 1, '#f59e0b'),
('cc-calldetail', 'Call Detail', 4, 1, '#f59e0b'), ('cc-clickcall', 'Click to Call', 4, 1, '#f59e0b'),
('cc-calloutcome', 'Call Result', 4, 1, '#f59e0b'), ('cc-intercom', 'Intercom Button', 4, 1, '#f59e0b'),
('cc-voicech', 'Voice Chat', 4, 1, '#f59e0b'), ('cc-activecall', 'Live Call', 4, 1, '#f59e0b'),
('cc-callhistory', 'Call History', 4, 1, '#f59e0b'), ('cc-pttstaffcard', 'Staff Card', 4, 1, '#f59e0b'),
('cc-sidebarpanel', 'Side Panel', 4, 1, '#f59e0b'), ('cc-voicechheader', 'Voice Header', 4, 1, '#f59e0b'),
('cc-leadcontent', 'Leads View', 4, 1, '#f59e0b'), ('cc-addlead', 'New Lead', 4, 1, '#f59e0b'),
('cc-leaddetail', 'Lead Detail', 4, 1, '#f59e0b'), ('cc-smartcontact', 'Smart Reach', 4, 1, '#f59e0b'),
('cc-leadnotes', 'Lead Notes', 4, 1, '#f59e0b'), ('cc-taskcontent', 'Tasks View', 4, 1, '#f59e0b'),
('cc-taskkanban', 'Task Board', 4, 1, '#f59e0b'), ('cc-taskcard', 'Task Card', 4, 1, '#f59e0b'),
('cc-taskdetail', 'Task Detail', 4, 1, '#f59e0b'), ('cc-taskform', 'Task Form', 4, 1, '#f59e0b'),
('cc-taskquick', 'Quick Task', 4, 1, '#f59e0b'), ('cc-tasksheet', 'Task Details', 4, 1, '#f59e0b'),
('cc-calcontent', 'Calendar View', 4, 1, '#f59e0b'), ('cc-unicontent', 'Universities View', 4, 1, '#f59e0b'),
('cc-unilist', 'University List', 4, 1, '#f59e0b'), ('cc-uniforming', 'University Form', 4, 1, '#f59e0b'),
('cc-aiuniform', 'AI University Form', 4, 1, '#f59e0b'), ('cc-transwork', 'Translation Flow', 4, 1, '#f59e0b'),
('cc-transpanel', 'Translation Panel', 4, 1, '#f59e0b'), ('cc-aitrans', 'AI Translator', 4, 1, '#f59e0b'),
('cc-transtrain', 'Translation Practice', 4, 1, '#f59e0b'), ('cc-kakaocontent', 'Map View', 4, 1, '#f59e0b'),
('cc-kakaomap', 'Kakao Map', 4, 1, '#f59e0b'), ('cc-regionalmap', 'Region Map', 4, 1, '#f59e0b'),
('cc-finov', 'Finance Dashboard', 4, 1, '#f59e0b'), ('cc-finreport', 'Finance Reports', 4, 1, '#f59e0b'),
('cc-planned', 'Expected Income', 4, 1, '#f59e0b'), ('cc-sflist', 'Student Finance List', 4, 1, '#f59e0b'),
('cc-sfcard', 'Student Finance Card', 4, 1, '#f59e0b'), ('cc-budget', 'Budget Manager', 4, 1, '#f59e0b'),
('cc-sbudget', 'Student Budget', 4, 1, '#f59e0b'), ('cc-monthly', 'Monthly Bills', 4, 1, '#f59e0b'),
('cc-addmonthly', 'Add Monthly Bill', 4, 1, '#f59e0b'), ('cc-addexpense', 'Add Expense', 4, 1, '#f59e0b'),
('cc-sched', 'Scheduled Pay', 4, 1, '#f59e0b'), ('cc-translist', 'Transaction List', 4, 1, '#f59e0b'),
('cc-edittrans', 'Edit Transaction', 4, 1, '#f59e0b'), ('cc-manualtrans', 'Manual Entry', 4, 1, '#f59e0b'),
('cc-withdraw', 'Withdraw', 4, 1, '#f59e0b'), ('cc-transfermonthly', 'Transfer to Monthly', 4, 1, '#f59e0b'),
('cc-incdist', 'Income Split', 4, 1, '#f59e0b'), ('cc-funddist', 'Fund Split', 4, 1, '#f59e0b'),
('cc-opfund', 'Fund Settings', 4, 1, '#f59e0b'), ('cc-bonuses', 'Bonuses', 4, 1, '#f59e0b'),
('cc-paycontent', 'Payments View', 4, 1, '#f59e0b'), ('cc-paylist', 'Payment List', 4, 1, '#f59e0b'),
('cc-createpay', 'New Payment', 4, 1, '#f59e0b'), ('cc-addpay', 'Add Payment', 4, 1, '#f59e0b'),
('cc-invoice', 'Invoice', 4, 1, '#f59e0b'), ('cc-receipt', 'Receipt Upload', 4, 1, '#f59e0b'),
('cc-multireceipt', 'Multiple Receipts', 4, 1, '#f59e0b'), ('cc-repcontent', 'Reports View', 4, 1, '#f59e0b'),
('cc-studreport', 'Student Report', 4, 1, '#f59e0b'), ('cc-payreport', 'Payment Report', 4, 1, '#f59e0b'),
('cc-appreport', 'Application Report', 4, 1, '#f59e0b'), ('cc-staffcontent', 'Staff View', 4, 1, '#f59e0b'),
('cc-stafflist', 'Staff List', 4, 1, '#f59e0b'), ('cc-staffdetail', 'Staff Profile', 4, 1, '#f59e0b'),
('cc-addstaff', 'Add Staff', 4, 1, '#f59e0b'), ('cc-createaccount', 'New Account', 4, 1, '#f59e0b'),
('cc-settcontent', 'Settings', 4, 1, '#f59e0b'),
-- Uni components
('uc-process', 'Process Tracker', 4, 2, '#14b8a6'), ('uc-announce', 'Announcements', 4, 2, '#14b8a6'),
('uc-cal', 'University Calendar', 4, 2, '#14b8a6'), ('uc-room', 'University Room', 4, 2, '#14b8a6'),
('uc-roomchat', 'Room Chat', 4, 2, '#14b8a6'),
-- Interview components
('ic-vipgate', 'Access Gate', 4, 3, '#a855f7'), ('ic-avatar', 'Audio Avatar', 4, 3, '#a855f7'),
('ic-transcript', 'Transcript', 4, 3, '#a855f7'), ('ic-review', 'Transcript Review', 4, 3, '#a855f7'),
('ic-timer', 'Response Timer', 4, 3, '#a855f7'), ('ic-playback', 'Audio Playback', 4, 3, '#a855f7'),
('ic-feedback', 'Feedback', 4, 3, '#a855f7'), ('ic-analytics', 'Analytics', 4, 3, '#a855f7'),
-- Study components
('stc-vipgate', 'Access Gate', 4, 4, '#8b5cf6'), ('stc-editor', 'Plan Writer', 4, 4, '#8b5cf6'),
('stc-steps', 'Progress Steps', 4, 4, '#8b5cf6'), ('stc-example', 'Example Plan', 4, 4, '#8b5cf6'),
('stc-instructions', 'Instructions', 4, 4, '#8b5cf6'), ('stc-writing', 'Writing Helper', 4, 4, '#8b5cf6'),
('stc-diff', 'Change Viewer', 4, 4, '#8b5cf6'), ('stc-wizard', 'Template Picker', 4, 4, '#8b5cf6'),
('stc-analysis', 'Plan Review', 4, 4, '#8b5cf6'), ('stc-chat', 'AI Chat', 4, 4, '#8b5cf6'),
('stc-req', 'Requirements Check', 4, 4, '#8b5cf6'), ('stc-peer', 'Peer Review', 4, 4, '#8b5cf6'),
('stc-achievements', 'Achievements', 4, 4, '#8b5cf6'), ('stc-sessions', 'Past Sessions', 4, 4, '#8b5cf6'),
('stc-newsession', 'New Session', 4, 4, '#8b5cf6'), ('stc-tutorial', 'Tutorial', 4, 4, '#8b5cf6'),
-- Shared components
('shared-errbound', 'Error Boundary', 4, 5, '#22c55e'), ('shared-langsw', 'Language Switcher', 4, 5, '#22c55e'),
('shared-navlink', 'Nav Link', 4, 5, '#22c55e'), ('shared-platformgate', 'Platform Gate', 4, 5, '#22c55e'),
('shared-themetoggle', 'Theme Toggle', 4, 5, '#22c55e'), ('shared-protectedroute', 'Protected Route', 4, 5, '#22c55e'),
('shared-appinit', 'App Initializer', 4, 5, '#22c55e'), ('shared-nativecontainer', 'Native Container', 4, 5, '#22c55e'),
('shared-nativerouter', 'Native Router', 4, 5, '#22c55e'), ('shared-intercomprovider', 'Intercom Provider', 4, 5, '#22c55e'),
('shared-intercomlistener', 'Intercom Listener', 4, 5, '#22c55e'), ('shared-voicechprovider', 'Voice Provider', 4, 5, '#22c55e');

-- Ring 5: Hooks (67)
INSERT INTO public.system_map_nodes (id, label, ring, sector, color) VALUES
('h-auth', 'Login System', 5, 0, '#22d3ee'), ('h-userrole', 'User Roles', 5, 1, '#22d3ee'), ('h-platform', 'Device Detection', 5, 5, '#22d3ee'),
('h-crmdata', 'CRM Data', 5, 1, '#22d3ee'), ('h-studentdata', 'Student Data', 5, 0, '#22d3ee'),
('h-dashstats', 'Dashboard Stats', 5, 1, '#22d3ee'), ('h-unis', 'Universities', 5, 2, '#22d3ee'),
('h-uniprog', 'Programs', 5, 0, '#22d3ee'), ('h-unireq', 'Requirements', 5, 4, '#22d3ee'),
('h-uniannounce', 'Announcements', 5, 2, '#22d3ee'), ('h-unievents', 'Events', 5, 2, '#22d3ee'),
('h-uniroom', 'Chat Rooms', 5, 2, '#22d3ee'), ('h-unistaffdata', 'Uni Staff Data', 5, 2, '#22d3ee'),
('h-progsearch', 'Program Search', 5, 0, '#22d3ee'), ('h-scholarships', 'Scholarships', 5, 0, '#22d3ee'),
('h-regional', 'Region Stats', 5, 1, '#22d3ee'),
('h-msgs', 'Messages', 5, 1, '#22d3ee'), ('h-calls', 'Calls', 5, 1, '#22d3ee'),
('h-callsounds', 'Call Sounds', 5, 1, '#22d3ee'), ('h-channelmsgs', 'Channel Chat', 5, 1, '#22d3ee'),
('h-leads', 'Leads', 5, 1, '#22d3ee'), ('h-leadnotes', 'Lead Notes', 5, 1, '#22d3ee'),
('h-staffmentions', 'Staff Mentions', 5, 1, '#22d3ee'), ('h-mentionnotif', 'Mention Alerts', 5, 1, '#22d3ee'),
('h-intercomcaller', 'Intercom Caller', 5, 1, '#22d3ee'), ('h-intercomlistener', 'Intercom Listener', 5, 1, '#22d3ee'),
('h-voicechannel', 'Voice Chat', 5, 1, '#22d3ee'), ('h-staffpresence', 'Staff Online', 5, 1, '#22d3ee'),
('h-payments', 'Payments', 5, 1, '#22d3ee'), ('h-expected', 'Expected Pay', 5, 1, '#22d3ee'),
('h-monthly', 'Monthly Pay', 5, 1, '#22d3ee'), ('h-scheduled', 'Scheduled Pay', 5, 1, '#22d3ee'),
('h-opfund', 'Operating Fund', 5, 1, '#22d3ee'), ('h-incdist', 'Income Split', 5, 1, '#22d3ee'),
('h-disttransfers', 'Fund Transfers', 5, 1, '#22d3ee'), ('h-staffbonuses', 'Staff Bonuses', 5, 1, '#22d3ee'),
('h-studentbudgets', 'Student Budgets', 5, 1, '#22d3ee'), ('h-reports', 'Reports', 5, 1, '#22d3ee'),
('h-hanguk', 'AI Assistant', 5, 0, '#22d3ee'), ('h-aiinsights', 'AI Insights', 5, 1, '#22d3ee'),
('h-autotranslate', 'Auto Translate', 5, 1, '#22d3ee'), ('h-doctranslate', 'Doc Translate', 5, 1, '#22d3ee'),
('h-voiceinput', 'Voice Input', 5, 0, '#22d3ee'), ('h-writingasst', 'Writing Help', 5, 4, '#22d3ee'),
('h-translationtraining', 'Translation Training', 5, 1, '#22d3ee'),
('h-intsession', 'Interview Session', 5, 3, '#22d3ee'), ('h-intanalytics', 'Interview Stats', 5, 3, '#22d3ee'),
('h-audiorecorder', 'Audio Recorder', 5, 3, '#22d3ee'),
('h-studentplan', 'Study Plan', 5, 4, '#22d3ee'), ('h-studyplansessions', 'Plan Sessions', 5, 4, '#22d3ee'),
('h-studyplantrainer', 'Plan Trainer', 5, 4, '#22d3ee'), ('h-peerreview', 'Peer Review', 5, 4, '#22d3ee'),
('h-gamification', 'Achievements', 5, 4, '#22d3ee'), ('h-studentinsights', 'Student Insights', 5, 0, '#22d3ee'),
('h-haptics', 'Vibration', 5, 5, '#22d3ee'), ('h-keyboard', 'Keyboard', 5, 5, '#22d3ee'),
('h-statusbar', 'Status Bar', 5, 5, '#22d3ee'), ('h-backbutton', 'Back Button', 5, 5, '#22d3ee'),
('h-applifecycle', 'App Lifecycle', 5, 5, '#22d3ee'), ('h-nativepush', 'Push Alerts', 5, 5, '#22d3ee'),
('h-panorama', '360 View', 5, 0, '#22d3ee'),
('h-mobile', 'Mobile Check', 5, 5, '#22d3ee'), ('h-toast', 'Notifications', 5, 5, '#22d3ee'),
('h-tasks', 'Tasks', 5, 1, '#22d3ee'), ('h-staffmgmt', 'Staff Manager', 5, 1, '#22d3ee'),
('h-cmdsync', 'Command Sync', 5, 1, '#22d3ee'), ('h-voicenotif', 'Voice Alerts', 5, 1, '#22d3ee');

-- Ring 6: DB Tables
INSERT INTO public.system_map_nodes (id, label, ring, sector, color) VALUES
('db-profiles', 'User Profiles', 6, 0, '#06b6d4'), ('db-applications', 'Applications', 6, 0, '#06b6d4'),
('db-documents', 'Documents', 6, 0, '#06b6d4'), ('db-universities', 'Universities', 6, 2, '#06b6d4'),
('db-application_form_cache', 'Form Cache', 6, 2, '#06b6d4'),
('db-application_form_changes', 'Form Changes', 6, 2, '#06b6d4'),
('db-application_form_validations', 'Form Checks', 6, 2, '#06b6d4'),
('db-interview_questions', 'Questions', 6, 3, '#06b6d4'),
('db-payments', 'Payments', 6, 1, '#06b6d4'), ('db-payment_transactions', 'Transactions', 6, 1, '#06b6d4'),
('db-expenses', 'Expenses', 6, 1, '#06b6d4'),
('db-income_distributions', 'Income Split', 6, 1, '#06b6d4'),
('db-income_distribution_settings', 'Split Settings', 6, 1, '#06b6d4'),
('db-operational_fund_allocations', 'Fund Usage', 6, 1, '#06b6d4'),
('db-operational_fund_settings', 'Fund Config', 6, 1, '#06b6d4'),
('db-distribution_transfers', 'Fund Transfers', 6, 1, '#06b6d4'),
('db-distribution_transfer_items', 'Transfer Items', 6, 1, '#06b6d4'),
('db-monthly_payment_categories', 'Monthly Categories', 6, 1, '#06b6d4'),
('db-messages', 'Messages', 6, 1, '#06b6d4'), ('db-message_threads', 'Chat Threads', 6, 1, '#06b6d4'),
('db-calls', 'Phone Calls', 6, 1, '#06b6d4'), ('db-leads', 'Sales Leads', 6, 1, '#06b6d4'),
('db-lead_notes', 'Lead Notes', 6, 1, '#06b6d4'), ('db-mentions', 'Mentions', 6, 1, '#06b6d4'),
('db-notifications', 'Notifications', 6, 1, '#06b6d4'),
('db-intercom_calls', 'Intercom Calls', 6, 1, '#06b6d4'),
('db-call_sessions', 'Call Sessions', 6, 1, '#06b6d4'), ('db-call_signals', 'Call Signals', 6, 1, '#06b6d4'),
('db-channel_messages', 'Channel Messages', 6, 1, '#06b6d4'), ('db-room_channels', 'Chat Rooms', 6, 2, '#06b6d4'),
('db-interview_sessions', 'Interview Sessions', 6, 3, '#06b6d4'),
('db-interview_messages', 'Interview Chats', 6, 3, '#06b6d4'),
('db-interview_feedback', 'Interview Feedback', 6, 3, '#06b6d4'),
('db-study_plan_drafts', 'Plan Drafts', 6, 4, '#06b6d4'),
('db-peer_review_queue', 'Review Queue', 6, 4, '#06b6d4'), ('db-peer_reviews', 'Peer Reviews', 6, 4, '#06b6d4'),
('db-ai_conversations', 'AI Chats', 6, 0, '#06b6d4'),
('db-ai_context_cache', 'AI Memory', 6, 0, '#06b6d4');

-- Ring 7: Edge Functions (29)
INSERT INTO public.system_map_nodes (id, label, ring, sector, color) VALUES
('ef-hanguk-ai-chat', 'AI Chat Service', 7, 0, '#ec4899'),
('ef-interview-ai', 'Interview AI', 7, 3, '#ec4899'),
('ef-interview-feedback', 'Feedback Generator', 7, 3, '#ec4899'),
('ef-study-plan-trainer', 'Plan Trainer', 7, 4, '#ec4899'),
('ef-compare-universities', 'Compare Universities', 7, 0, '#ec4899'),
('ef-analyze-lead', 'Lead Analyzer', 7, 1, '#ec4899'),
('ef-create-staff', 'Create Staff', 7, 1, '#ec4899'),
('ef-create-student', 'Create Student', 7, 1, '#ec4899'),
('ef-delete-staff', 'Remove Staff', 7, 1, '#ec4899'),
('ef-student-login', 'Student Login', 7, 1, '#ec4899'),
('ef-search-university', 'University Search', 7, 2, '#ec4899'),
('ef-import-korean-universities', 'Import Universities', 7, 2, '#ec4899'),
('ef-discover-university-websites', 'Find Uni Websites', 7, 2, '#ec4899'),
('ef-find-application-form', 'Find App Form', 7, 2, '#ec4899'),
('ef-find-faculty-forms', 'Find Faculty Forms', 7, 2, '#ec4899'),
('ef-analyze-application-form', 'Analyze App Form', 7, 2, '#ec4899'),
('ef-validate-application-data', 'Validate Application', 7, 2, '#ec4899'),
('ef-check-search-job', 'Check Search Job', 7, 2, '#ec4899'),
('ef-translate-document', 'Translate Document', 7, 1, '#ec4899'),
('ef-validate-document', 'Check Document', 7, 1, '#ec4899'),
('ef-elevenlabs-tts', 'Text to Speech', 7, 3, '#ec4899'),
('ef-elevenlabs-scribe-token', 'Speech to Text', 7, 3, '#ec4899'),
('ef-heygen-avatar-token', 'Video Avatar', 7, 3, '#ec4899'),
('ef-kakao-roadview-proxy', 'Map Proxy', 7, 1, '#ec4899'),
('ef-telegram-webhook', 'Telegram Bot', 7, 5, '#ec4899'),
('ef-voip-webhook', 'Phone System', 7, 1, '#ec4899'),
('ef-command-center-webhook', 'Command Center', 7, 1, '#ec4899'),
('ef-sync-to-command-center', 'Sync to Command', 7, 1, '#ec4899'),
('ef-send-mention-notification', 'Send Mention Alert', 7, 1, '#ec4899');

-- Ring 8: Infrastructure
INSERT INTO public.system_map_nodes (id, label, ring, sector, color) VALUES
('infra-react', 'React 18', 8, 0, '#f472b6'), ('infra-vite', 'Vite', 8, 0, '#f472b6'),
('infra-ts', 'TypeScript', 8, 1, '#f472b6'), ('infra-tailwind', 'Tailwind CSS', 8, 1, '#f472b6'),
('infra-shadcn', 'shadcn/ui', 8, 2, '#f472b6'), ('infra-rq', 'React Query', 8, 2, '#f472b6'),
('infra-i18n', 'i18n', 8, 3, '#f472b6'), ('infra-capacitor', 'Capacitor', 8, 4, '#f472b6'),
('infra-pwa', 'PWA', 8, 5, '#f472b6'), ('infra-supabase', 'Supabase', 8, 5, '#f472b6');

-- ═══════════════════════════════════════════════════════════════
-- SEED: ALL CONNECTIONS (~331)
-- ═══════════════════════════════════════════════════════════════

-- Hub → Portals
INSERT INTO public.system_map_connections (from_node, to_node, color, opacity) VALUES
('hub', 'portal-student', '#f97316', 0.6),
('hub', 'portal-crm', '#f97316', 0.6),
('hub', 'portal-uni', '#f97316', 0.6),
('hub', 'portal-interview', '#f97316', 0.6),
('hub', 'portal-study', '#f97316', 0.6),
('hub', 'portal-public', '#f97316', 0.6);

-- Portals → Groups
INSERT INTO public.system_map_connections (from_node, to_node, opacity) VALUES
('portal-student', 'student-features', 0.3), ('portal-student', 'student-uni', 0.3),
('portal-crm', 'crm-home', 0.3), ('portal-crm', 'crm-comm', 0.3),
('portal-crm', 'crm-mgmt', 0.3), ('portal-crm', 'crm-finance', 0.3),
('portal-crm', 'crm-admin', 0.3),
('portal-uni', 'uni-features', 0.3),
('portal-interview', 'int-flow', 0.3),
('portal-study', 'study-tools', 0.3),
('portal-public', 'pub-group', 0.3);

-- Groups → Pages
INSERT INTO public.system_map_connections (from_node, to_node, opacity) VALUES
('student-features', 'sp-apps', 0.35), ('student-features', 'sp-map', 0.35),
('student-features', 'sp-programs', 0.35), ('student-features', 'sp-docs', 0.35),
('student-features', 'sp-ai', 0.35), ('student-features', 'sp-insights', 0.35),
('student-uni', 'sp-room', 0.35), ('student-uni', 'sp-cal', 0.35),
('crm-home', 'crm-dash', 0.35), ('crm-home', 'crm-ai', 0.35),
('crm-home', 'crm-students', 0.35), ('crm-home', 'crm-apps', 0.35),
('crm-comm', 'crm-msgs', 0.35), ('crm-comm', 'crm-calls', 0.35),
('crm-comm', 'crm-intercom', 0.35), ('crm-comm', 'crm-leads', 0.35),
('crm-mgmt', 'crm-tasks', 0.35), ('crm-mgmt', 'crm-cal', 0.35),
('crm-mgmt', 'crm-unis', 0.35), ('crm-mgmt', 'crm-translate', 0.35),
('crm-mgmt', 'crm-kakao', 0.35),
('crm-finance', 'crm-fin-overview', 0.35), ('crm-finance', 'crm-fin-students', 0.35),
('crm-finance', 'crm-fin-budgets', 0.35), ('crm-finance', 'crm-fin-monthly', 0.35),
('crm-finance', 'crm-fin-sched', 0.35), ('crm-finance', 'crm-fin-trans', 0.35),
('crm-finance', 'crm-fin-dist', 0.35), ('crm-finance', 'crm-fin-bonus', 0.35),
('crm-finance', 'crm-fin-payments', 0.35), ('crm-finance', 'crm-fin-reports', 0.35),
('crm-admin', 'crm-staff', 0.35), ('crm-admin', 'crm-settings', 0.35),
('uni-features', 'uni-applicants', 0.35), ('uni-features', 'uni-announce', 0.35),
('uni-features', 'uni-cal', 0.35), ('uni-features', 'uni-chat', 0.35),
('int-flow', 'int-gate', 0.35), ('int-flow', 'int-avatar', 0.35),
('int-flow', 'int-transcript', 0.35), ('int-flow', 'int-timer', 0.35),
('int-flow', 'int-playback', 0.35), ('int-flow', 'int-feedback', 0.35),
('int-flow', 'int-analytics', 0.35),
('study-tools', 'study-gate', 0.35), ('study-tools', 'study-editor', 0.35),
('study-tools', 'study-writing', 0.35), ('study-tools', 'study-templates', 0.35),
('study-tools', 'study-analysis', 0.35), ('study-tools', 'study-req', 0.35),
('study-tools', 'study-peer', 0.35), ('study-tools', 'study-achievements', 0.35),
('study-tools', 'study-sessions', 0.35), ('study-tools', 'study-tutorial', 0.35),
('pub-group', 'pub-index', 0.35), ('pub-group', 'pub-auth', 0.35),
('pub-group', 'pub-install', 0.35), ('pub-group', 'pub-privacy', 0.35),
('pub-group', 'pub-terms', 0.35), ('pub-group', 'pub-notfound', 0.35),
('pub-group', 'pub-sysmap', 0.35);

-- Pages → Components
INSERT INTO public.system_map_connections (from_node, to_node, opacity) VALUES
('sp-apps', 'sc-tracker', 0.2), ('sp-apps', 'sc-badge', 0.2), ('sp-apps', 'sc-process', 0.2),
('sp-map', 'sc-kakao', 0.2), ('sp-map', 'sc-panorama', 0.2), ('sp-map', 'sc-selbar', 0.2),
('sp-programs', 'sc-finder', 0.2), ('sp-programs', 'sc-pcard', 0.2), ('sp-programs', 'sc-filter', 0.2),
('sp-programs', 'sc-scholarship', 0.2), ('sp-programs', 'sc-compare-q', 0.2),
('sp-docs', 'sc-docup', 0.2),
('sp-ai', 'sc-hanguk', 0.2), ('sp-ai', 'sc-compare', 0.2),
('sp-insights', 'sc-insightpanel', 0.2), ('sp-insights', 'sc-announce', 0.2),
('sp-room', 'sc-room', 0.2), ('sp-room', 'sc-roomchat', 0.2),
('sp-cal', 'sc-ucal', 0.2),
('crm-dash', 'cc-dash', 0.2), ('crm-dash', 'cc-sidebar', 0.2), ('crm-dash', 'cc-subnav', 0.2),
('crm-dash', 'cc-quick', 0.2), ('crm-dash', 'cc-notifbell', 0.2),
('crm-ai', 'cc-aiasst', 0.2), ('crm-ai', 'cc-aiinsight', 0.2),
('crm-students', 'cc-slist', 0.2), ('crm-students', 'cc-scard', 0.2), ('crm-students', 'cc-sdetail', 0.2),
('crm-students', 'cc-addstu', 0.2), ('crm-students', 'cc-editstu', 0.2), ('crm-students', 'cc-delstu', 0.2),
('crm-students', 'cc-contract', 0.2),
('crm-apps', 'cc-appforms', 0.2),
('crm-msgs', 'cc-msgcontent', 0.2), ('crm-msgs', 'cc-threadlist', 0.2), ('crm-msgs', 'cc-chatview', 0.2),
('crm-msgs', 'cc-commcenter', 0.2),
('crm-calls', 'cc-callcontent', 0.2), ('crm-calls', 'cc-calllist', 0.2), ('crm-calls', 'cc-callform', 0.2),
('crm-calls', 'cc-calldetail', 0.2), ('crm-calls', 'cc-clickcall', 0.2), ('crm-calls', 'cc-calloutcome', 0.2),
('crm-intercom', 'cc-intercom', 0.2), ('crm-intercom', 'cc-voicech', 0.2), ('crm-intercom', 'cc-activecall', 0.2),
('crm-intercom', 'cc-callhistory', 0.2), ('crm-intercom', 'cc-pttstaffcard', 0.2),
('crm-intercom', 'cc-sidebarpanel', 0.2), ('crm-intercom', 'cc-voicechheader', 0.2),
('crm-leads', 'cc-leadcontent', 0.2), ('crm-leads', 'cc-addlead', 0.2), ('crm-leads', 'cc-leaddetail', 0.2),
('crm-leads', 'cc-smartcontact', 0.2), ('crm-leads', 'cc-leadnotes', 0.2),
('crm-tasks', 'cc-taskcontent', 0.2), ('crm-tasks', 'cc-taskkanban', 0.2), ('crm-tasks', 'cc-taskcard', 0.2),
('crm-tasks', 'cc-taskdetail', 0.2), ('crm-tasks', 'cc-taskform', 0.2), ('crm-tasks', 'cc-taskquick', 0.2),
('crm-tasks', 'cc-tasksheet', 0.2),
('crm-cal', 'cc-calcontent', 0.2),
('crm-unis', 'cc-unicontent', 0.2), ('crm-unis', 'cc-unilist', 0.2), ('crm-unis', 'cc-uniforming', 0.2),
('crm-unis', 'cc-aiuniform', 0.2),
('crm-translate', 'cc-transwork', 0.2), ('crm-translate', 'cc-transpanel', 0.2),
('crm-translate', 'cc-aitrans', 0.2), ('crm-translate', 'cc-transtrain', 0.2),
('crm-kakao', 'cc-kakaocontent', 0.2), ('crm-kakao', 'cc-kakaomap', 0.2), ('crm-kakao', 'cc-regionalmap', 0.2),
('crm-fin-overview', 'cc-finov', 0.2), ('crm-fin-overview', 'cc-finreport', 0.2), ('crm-fin-overview', 'cc-planned', 0.2),
('crm-fin-students', 'cc-sflist', 0.2), ('crm-fin-students', 'cc-sfcard', 0.2),
('crm-fin-budgets', 'cc-budget', 0.2), ('crm-fin-budgets', 'cc-sbudget', 0.2),
('crm-fin-monthly', 'cc-monthly', 0.2), ('crm-fin-monthly', 'cc-addmonthly', 0.2),
('crm-fin-monthly', 'cc-addexpense', 0.2),
('crm-fin-sched', 'cc-sched', 0.2),
('crm-fin-trans', 'cc-translist', 0.2), ('crm-fin-trans', 'cc-edittrans', 0.2),
('crm-fin-trans', 'cc-manualtrans', 0.2), ('crm-fin-trans', 'cc-withdraw', 0.2),
('crm-fin-trans', 'cc-transfermonthly', 0.2),
('crm-fin-dist', 'cc-incdist', 0.2), ('crm-fin-dist', 'cc-funddist', 0.2), ('crm-fin-dist', 'cc-opfund', 0.2),
('crm-fin-bonus', 'cc-bonuses', 0.2),
('crm-fin-payments', 'cc-paycontent', 0.2), ('crm-fin-payments', 'cc-paylist', 0.2),
('crm-fin-payments', 'cc-createpay', 0.2), ('crm-fin-payments', 'cc-addpay', 0.2),
('crm-fin-payments', 'cc-invoice', 0.2), ('crm-fin-payments', 'cc-receipt', 0.2),
('crm-fin-payments', 'cc-multireceipt', 0.2),
('crm-fin-reports', 'cc-repcontent', 0.2), ('crm-fin-reports', 'cc-studreport', 0.2),
('crm-fin-reports', 'cc-payreport', 0.2), ('crm-fin-reports', 'cc-appreport', 0.2),
('crm-staff', 'cc-staffcontent', 0.2), ('crm-staff', 'cc-stafflist', 0.2), ('crm-staff', 'cc-staffdetail', 0.2),
('crm-staff', 'cc-addstaff', 0.2), ('crm-staff', 'cc-createaccount', 0.2),
('crm-settings', 'cc-settcontent', 0.2),
('uni-applicants', 'uc-process', 0.2),
('uni-announce', 'uc-announce', 0.2),
('uni-cal', 'uc-cal', 0.2),
('uni-chat', 'uc-room', 0.2), ('uni-chat', 'uc-roomchat', 0.2),
('int-gate', 'ic-vipgate', 0.2),
('int-avatar', 'ic-avatar', 0.2),
('int-transcript', 'ic-transcript', 0.2), ('int-transcript', 'ic-review', 0.2),
('int-timer', 'ic-timer', 0.2),
('int-playback', 'ic-playback', 0.2),
('int-feedback', 'ic-feedback', 0.2),
('int-analytics', 'ic-analytics', 0.2),
('study-gate', 'stc-vipgate', 0.2),
('study-editor', 'stc-editor', 0.2), ('study-editor', 'stc-steps', 0.2),
('study-editor', 'stc-example', 0.2), ('study-editor', 'stc-instructions', 0.2),
('study-writing', 'stc-writing', 0.2), ('study-writing', 'stc-diff', 0.2),
('study-templates', 'stc-wizard', 0.2),
('study-analysis', 'stc-analysis', 0.2), ('study-analysis', 'stc-chat', 0.2),
('study-req', 'stc-req', 0.2),
('study-peer', 'stc-peer', 0.2),
('study-achievements', 'stc-achievements', 0.2),
('study-sessions', 'stc-sessions', 0.2), ('study-sessions', 'stc-newsession', 0.2),
('study-tutorial', 'stc-tutorial', 0.2);

-- Pages → Hooks
INSERT INTO public.system_map_connections (from_node, to_node, opacity, color) VALUES
('sp-apps', 'h-studentdata', 0.3, '#22d3ee'),
('sp-apps', 'h-crmdata', 0.3, '#22d3ee'),
('sp-map', 'h-panorama', 0.3, '#22d3ee'),
('sp-map', 'h-unis', 0.3, '#22d3ee'),
('sp-programs', 'h-progsearch', 0.3, '#22d3ee'),
('sp-programs', 'h-scholarships', 0.3, '#22d3ee'),
('sp-programs', 'h-uniprog', 0.3, '#22d3ee'),
('sp-ai', 'h-hanguk', 0.3, '#22d3ee'),
('sp-ai', 'h-voiceinput', 0.3, '#22d3ee'),
('sp-docs', 'h-doctranslate', 0.3, '#22d3ee'),
('sp-insights', 'h-studentinsights', 0.3, '#22d3ee'),
('sp-insights', 'h-uniannounce', 0.3, '#22d3ee'),
('crm-msgs', 'h-msgs', 0.3, '#22d3ee'),
('crm-msgs', 'h-channelmsgs', 0.3, '#22d3ee'),
('crm-msgs', 'h-staffmentions', 0.3, '#22d3ee'),
('crm-calls', 'h-calls', 0.3, '#22d3ee'),
('crm-calls', 'h-callsounds', 0.3, '#22d3ee'),
('crm-intercom', 'h-intercomcaller', 0.3, '#22d3ee'),
('crm-intercom', 'h-intercomlistener', 0.3, '#22d3ee'),
('crm-intercom', 'h-voicechannel', 0.3, '#22d3ee'),
('crm-intercom', 'h-staffpresence', 0.3, '#22d3ee'),
('crm-leads', 'h-leads', 0.3, '#22d3ee'),
('crm-leads', 'h-leadnotes', 0.3, '#22d3ee'),
('crm-tasks', 'h-tasks', 0.3, '#22d3ee'),
('crm-fin-overview', 'h-payments', 0.3, '#22d3ee'),
('crm-fin-overview', 'h-incdist', 0.3, '#22d3ee'),
('crm-fin-overview', 'h-reports', 0.3, '#22d3ee'),
('crm-fin-monthly', 'h-monthly', 0.3, '#22d3ee'),
('crm-fin-sched', 'h-scheduled', 0.3, '#22d3ee'),
('crm-fin-trans', 'h-payments', 0.3, '#22d3ee'),
('crm-fin-trans', 'h-disttransfers', 0.3, '#22d3ee'),
('crm-fin-dist', 'h-incdist', 0.3, '#22d3ee'),
('crm-fin-dist', 'h-opfund', 0.3, '#22d3ee'),
('crm-fin-dist', 'h-disttransfers', 0.3, '#22d3ee'),
('crm-fin-bonus', 'h-staffbonuses', 0.3, '#22d3ee'),
('crm-fin-budgets', 'h-studentbudgets', 0.3, '#22d3ee'),
('crm-fin-payments', 'h-payments', 0.3, '#22d3ee'),
('crm-fin-payments', 'h-expected', 0.3, '#22d3ee'),
('crm-staff', 'h-staffmgmt', 0.3, '#22d3ee'),
('crm-translate', 'h-autotranslate', 0.3, '#22d3ee'),
('crm-translate', 'h-doctranslate', 0.3, '#22d3ee'),
('crm-translate', 'h-translationtraining', 0.3, '#22d3ee'),
('crm-unis', 'h-unis', 0.3, '#22d3ee'),
('crm-kakao', 'h-regional', 0.3, '#22d3ee'),
('crm-ai', 'h-hanguk', 0.3, '#22d3ee'),
('crm-ai', 'h-aiinsights', 0.3, '#22d3ee'),
('int-avatar', 'h-intsession', 0.3, '#22d3ee'),
('int-avatar', 'h-audiorecorder', 0.3, '#22d3ee'),
('int-transcript', 'h-intsession', 0.3, '#22d3ee'),
('int-feedback', 'h-intanalytics', 0.3, '#22d3ee'),
('int-analytics', 'h-intanalytics', 0.3, '#22d3ee'),
('study-editor', 'h-studentplan', 0.3, '#22d3ee'),
('study-editor', 'h-studyplantrainer', 0.3, '#22d3ee'),
('study-writing', 'h-writingasst', 0.3, '#22d3ee'),
('study-analysis', 'h-studyplantrainer', 0.3, '#22d3ee'),
('study-peer', 'h-peerreview', 0.3, '#22d3ee'),
('study-sessions', 'h-studyplansessions', 0.3, '#22d3ee'),
('study-achievements', 'h-gamification', 0.3, '#22d3ee'),
('study-req', 'h-unireq', 0.3, '#22d3ee'),
('uni-applicants', 'h-unistaffdata', 0.3, '#22d3ee'),
('uni-announce', 'h-uniannounce', 0.3, '#22d3ee'),
('uni-cal', 'h-unievents', 0.3, '#22d3ee'),
('uni-chat', 'h-uniroom', 0.3, '#22d3ee');

-- Hooks → DB Tables
INSERT INTO public.system_map_connections (from_node, to_node, opacity, color) VALUES
('h-studentdata', 'db-applications', 0.25, '#06b6d4'),
('h-studentdata', 'db-documents', 0.25, '#06b6d4'),
('h-msgs', 'db-messages', 0.25, '#06b6d4'),
('h-msgs', 'db-message_threads', 0.25, '#06b6d4'),
('h-calls', 'db-calls', 0.25, '#06b6d4'),
('h-channelmsgs', 'db-channel_messages', 0.25, '#06b6d4'),
('h-leads', 'db-leads', 0.25, '#06b6d4'),
('h-leadnotes', 'db-lead_notes', 0.25, '#06b6d4'),
('h-staffmentions', 'db-mentions', 0.25, '#06b6d4'),
('h-mentionnotif', 'db-notifications', 0.25, '#06b6d4'),
('h-intercomcaller', 'db-intercom_calls', 0.25, '#06b6d4'),
('h-voicechannel', 'db-call_sessions', 0.25, '#06b6d4'),
('h-voicechannel', 'db-call_signals', 0.25, '#06b6d4'),
('h-staffpresence', 'db-profiles', 0.25, '#06b6d4'),
('h-payments', 'db-payments', 0.25, '#06b6d4'),
('h-payments', 'db-payment_transactions', 0.25, '#06b6d4'),
('h-monthly', 'db-monthly_payment_categories', 0.25, '#06b6d4'),
('h-scheduled', 'db-payments', 0.25, '#06b6d4'),
('h-opfund', 'db-operational_fund_settings', 0.25, '#06b6d4'),
('h-opfund', 'db-operational_fund_allocations', 0.25, '#06b6d4'),
('h-incdist', 'db-income_distributions', 0.25, '#06b6d4'),
('h-incdist', 'db-income_distribution_settings', 0.25, '#06b6d4'),
('h-disttransfers', 'db-distribution_transfers', 0.25, '#06b6d4'),
('h-disttransfers', 'db-distribution_transfer_items', 0.25, '#06b6d4'),
('h-staffbonuses', 'db-expenses', 0.25, '#06b6d4'),
('h-studentbudgets', 'db-payments', 0.25, '#06b6d4'),
('h-intsession', 'db-interview_sessions', 0.25, '#06b6d4'),
('h-intsession', 'db-interview_messages', 0.25, '#06b6d4'),
('h-intanalytics', 'db-interview_feedback', 0.25, '#06b6d4'),
('h-studentplan', 'db-study_plan_drafts', 0.25, '#06b6d4'),
('h-peerreview', 'db-peer_review_queue', 0.25, '#06b6d4'),
('h-peerreview', 'db-peer_reviews', 0.25, '#06b6d4'),
('h-hanguk', 'db-ai_conversations', 0.25, '#06b6d4'),
('h-unis', 'db-universities', 0.25, '#06b6d4'),
('h-uniprog', 'db-universities', 0.25, '#06b6d4'),
('h-uniannounce', 'db-universities', 0.25, '#06b6d4'),
('h-uniroom', 'db-room_channels', 0.25, '#06b6d4'),
('h-userrole', 'db-profiles', 0.25, '#06b6d4'),
('h-staffmgmt', 'db-profiles', 0.25, '#06b6d4'),
('h-crmdata', 'db-applications', 0.25, '#06b6d4'),
('h-crmdata', 'db-profiles', 0.25, '#06b6d4'),
('h-reports', 'db-payments', 0.25, '#06b6d4'),
('h-reports', 'db-applications', 0.25, '#06b6d4');

-- DB → Edge Functions
INSERT INTO public.system_map_connections (from_node, to_node, opacity, color) VALUES
('db-interview_sessions', 'ef-interview-ai', 0.25, '#ec4899'),
('db-interview_feedback', 'ef-interview-feedback', 0.25, '#ec4899'),
('db-ai_conversations', 'ef-hanguk-ai-chat', 0.25, '#ec4899'),
('db-study_plan_drafts', 'ef-study-plan-trainer', 0.25, '#ec4899'),
('db-universities', 'ef-search-university', 0.25, '#ec4899'),
('db-universities', 'ef-import-korean-universities', 0.25, '#ec4899'),
('db-universities', 'ef-discover-university-websites', 0.25, '#ec4899'),
('db-application_form_cache', 'ef-find-application-form', 0.25, '#ec4899'),
('db-application_form_cache', 'ef-find-faculty-forms', 0.25, '#ec4899'),
('db-application_form_cache', 'ef-analyze-application-form', 0.25, '#ec4899'),
('db-application_form_validations', 'ef-validate-application-data', 0.25, '#ec4899'),
('db-application_form_validations', 'ef-check-search-job', 0.25, '#ec4899'),
('db-profiles', 'ef-create-staff', 0.25, '#ec4899'),
('db-profiles', 'ef-create-student', 0.25, '#ec4899'),
('db-profiles', 'ef-delete-staff', 0.25, '#ec4899'),
('db-profiles', 'ef-student-login', 0.25, '#ec4899'),
('db-documents', 'ef-translate-document', 0.25, '#ec4899'),
('db-documents', 'ef-validate-document', 0.25, '#ec4899'),
('db-leads', 'ef-analyze-lead', 0.25, '#ec4899'),
('db-messages', 'ef-send-mention-notification', 0.25, '#ec4899'),
('db-intercom_calls', 'ef-voip-webhook', 0.25, '#ec4899'),
('db-notifications', 'ef-telegram-webhook', 0.25, '#ec4899'),
('db-applications', 'ef-sync-to-command-center', 0.25, '#ec4899'),
('db-applications', 'ef-command-center-webhook', 0.25, '#ec4899'),
('db-ai_conversations', 'ef-compare-universities', 0.25, '#ec4899');

-- Edge Fn → Infrastructure (all edge functions → supabase)
INSERT INTO public.system_map_connections (from_node, to_node, opacity, color) VALUES
('ef-hanguk-ai-chat', 'infra-supabase', 0.15, '#f472b6'),
('ef-interview-ai', 'infra-supabase', 0.15, '#f472b6'),
('ef-interview-feedback', 'infra-supabase', 0.15, '#f472b6'),
('ef-study-plan-trainer', 'infra-supabase', 0.15, '#f472b6'),
('ef-compare-universities', 'infra-supabase', 0.15, '#f472b6'),
('ef-analyze-lead', 'infra-supabase', 0.15, '#f472b6'),
('ef-create-staff', 'infra-supabase', 0.15, '#f472b6'),
('ef-create-student', 'infra-supabase', 0.15, '#f472b6'),
('ef-delete-staff', 'infra-supabase', 0.15, '#f472b6'),
('ef-student-login', 'infra-supabase', 0.15, '#f472b6'),
('ef-search-university', 'infra-supabase', 0.15, '#f472b6'),
('ef-import-korean-universities', 'infra-supabase', 0.15, '#f472b6'),
('ef-discover-university-websites', 'infra-supabase', 0.15, '#f472b6'),
('ef-find-application-form', 'infra-supabase', 0.15, '#f472b6'),
('ef-find-faculty-forms', 'infra-supabase', 0.15, '#f472b6'),
('ef-analyze-application-form', 'infra-supabase', 0.15, '#f472b6'),
('ef-validate-application-data', 'infra-supabase', 0.15, '#f472b6'),
('ef-check-search-job', 'infra-supabase', 0.15, '#f472b6'),
('ef-translate-document', 'infra-supabase', 0.15, '#f472b6'),
('ef-validate-document', 'infra-supabase', 0.15, '#f472b6'),
('ef-elevenlabs-tts', 'infra-supabase', 0.15, '#f472b6'),
('ef-elevenlabs-scribe-token', 'infra-supabase', 0.15, '#f472b6'),
('ef-heygen-avatar-token', 'infra-supabase', 0.15, '#f472b6'),
('ef-kakao-roadview-proxy', 'infra-supabase', 0.15, '#f472b6'),
('ef-telegram-webhook', 'infra-supabase', 0.15, '#f472b6'),
('ef-voip-webhook', 'infra-supabase', 0.15, '#f472b6'),
('ef-command-center-webhook', 'infra-supabase', 0.15, '#f472b6'),
('ef-sync-to-command-center', 'infra-supabase', 0.15, '#f472b6'),
('ef-send-mention-notification', 'infra-supabase', 0.15, '#f472b6'),
('ef-elevenlabs-tts', 'infra-capacitor', 0.2, '#f472b6'),
('ef-kakao-roadview-proxy', 'infra-pwa', 0.2, '#f472b6');

-- Cross-portal shared component links (dashed)
INSERT INTO public.system_map_connections (from_node, to_node, dashed, opacity, color) VALUES
('shared-errbound', 'portal-student', true, 0.15, '#22c55e'),
('shared-errbound', 'portal-crm', true, 0.15, '#22c55e'),
('shared-errbound', 'portal-uni', true, 0.15, '#22c55e'),
('shared-errbound', 'portal-interview', true, 0.15, '#22c55e'),
('shared-errbound', 'portal-study', true, 0.15, '#22c55e'),
('shared-errbound', 'portal-public', true, 0.15, '#22c55e'),
('shared-protectedroute', 'portal-student', true, 0.15, '#22c55e'),
('shared-protectedroute', 'portal-crm', true, 0.15, '#22c55e'),
('shared-protectedroute', 'portal-uni', true, 0.15, '#22c55e'),
('shared-protectedroute', 'portal-interview', true, 0.15, '#22c55e'),
('shared-protectedroute', 'portal-study', true, 0.15, '#22c55e'),
('shared-protectedroute', 'portal-public', true, 0.15, '#22c55e'),
('shared-langsw', 'portal-student', true, 0.15, '#22c55e'),
('shared-langsw', 'portal-crm', true, 0.15, '#22c55e'),
('shared-langsw', 'portal-uni', true, 0.15, '#22c55e'),
('shared-langsw', 'portal-interview', true, 0.15, '#22c55e'),
('shared-langsw', 'portal-study', true, 0.15, '#22c55e'),
('shared-langsw', 'portal-public', true, 0.15, '#22c55e');
