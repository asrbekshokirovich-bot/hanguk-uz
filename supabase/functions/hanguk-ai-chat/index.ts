import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Common Uzbek phrases and their English equivalents for better understanding
const uzbekPhrasePatterns = {
  // Greetings and politeness
  greetings: [
    /assalomu\s*alaykum/i, /salom/i, /xayrli\s*kun/i, /xayrli\s*tong/i, /xayrli\s*kech/i
  ],
  thanks: [
    /rahmat/i, /tashakkur/i, /katta\s*rahmat/i, /minnatdorman/i, /minnatdorchilik/i
  ],
  // Question words
  questions: [
    /qanday/i, /qancha/i, /necha/i, /qachon/i, /qayerda/i, /kim/i, /nima/i, /nega/i, /nimaga/i
  ],
  // Document-related
  documents: [
    /hujjat/i, /pasport/i, /diplom/i, /attestat/i, /sertifikat/i, /spravka/i, /foto/i, /rasm/i,
    /tarjima/i, /apostil/i, /notarial/i, /guvohnoma/i
  ],
  // Payment-related  
  payments: [
    /to'lov/i, /pul/i, /summa/i, /dollar/i, /qarz/i, /qarzdorlik/i, /to'lash/i, /to'ladim/i
  ],
  // Application-related
  application: [
    /ariza/i, /murojaat/i, /universitetga/i, /qabul/i, /o'qish/i, /ta'lim/i
  ],
  // Status inquiries
  status: [
    /holat/i, /qanday\s*holat/i, /qayerda\s*turibdi/i, /natija/i, /javob/i
  ],
  // Time-related
  time: [
    /qachon/i, /bugun/i, /ertaga/i, /keyingi\s*hafta/i, /oy/i, /vaqt/i, /muddat/i
  ],
  // University-related
  university: [
    /universitet/i, /kollej/i, /institut/i, /akademiya/i, /koreya/i, /seul/i, /pusan/i
  ],
  // Help requests
  help: [
    /yordam/i, /ko'mak/i, /kerak/i, /aytib\s*bering/i, /tushuntiring/i, /qanday\s*qilaman/i
  ]
};

// Extract student names from message for lookup - with enhanced Uzbek support
function extractStudentQuery(message: string): string | null {
  const patterns = [
    // English patterns
    /(?:about|info|information|details|show|find|search|look up|lookup|get)\s+(?:student\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    
    // Uzbek patterns - expanded
    /(?:talaba|student|o'quvchi)\s+([A-Z][a-z']+(?:\s+[A-Z][a-z']+)?)/i,
    /([A-Z][a-z']+(?:\s+[A-Z][a-z']+)?)\s+(?:haqida|to'g'risida|ma'lumot)/i,
    /([A-Z][a-z']+(?:\s+[A-Z][a-z']+)?)\s+(?:kim|kimdir)/i,
    /(?:kim\s+bu|bu\s+kim)\s+([A-Z][a-z']+(?:\s+[A-Z][a-z']+)?)/i,
    /(?:ko'rsat|top|izla|qidir)\s+([A-Z][a-z']+(?:\s+[A-Z][a-z']+)?)/i,
    /([A-Z][a-z']+(?:\s+[A-Z][a-z']+)?)\s*(?:ni|ning)\s+(?:ma'lumot|hujjat|to'lov)/i,
    /([A-Z][a-z']+)(?:ga|ning|ni)\s/i,
    
    // Russian patterns
    /(?:студент|о\s+студенте|покажи|найди)\s+([А-Яа-яA-Za-z]+(?:\s+[А-Яа-яA-Za-z]+)?)/i,
    /(?:кто такой|кто)\s+([А-Яа-яA-Za-z]+(?:\s+[А-Яа-яA-Za-z]+)?)/i,
    
    // Korean patterns
    /(?:학생|누구)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i,
    
    // Name at start or end of sentence (common in Uzbek)
    /^([A-Z][a-z']+(?:\s+[A-Z][a-z']+)?)\s+(?:haqida|bormi|qayerda)/i,
    /(?:qara|ko'r)\s+([A-Z][a-z']+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      // Filter out common Uzbek words that might be mistaken for names
      const uzbekWords = ['qanday', 'qachon', 'qayerda', 'nima', 'nega', 'kerak', 'bormi', 'haqida'];
      if (!uzbekWords.includes(name.toLowerCase())) {
        return name;
      }
    }
  }
  return null;
}

// Detect if message is primarily in Uzbek
function isUzbekMessage(message: string): boolean {
  const uzbekIndicators = [
    /o'/i, /g'/i, /sh/i, /ch/i, // Uzbek-specific letters
    /ning/i, /ga/i, /dan/i, /da\b/i, // Common suffixes
    /man\b/i, /san\b/i, /miz\b/i, // Verb endings
    /kerak/i, /uchun/i, /bilan/i, /haqida/i, // Common words
  ];
  
  let matches = 0;
  for (const pattern of uzbekIndicators) {
    if (pattern.test(message)) matches++;
  }
  
  return matches >= 2;
}

// Search for a specific student by name
async function searchStudentByName(supabase: any, searchName: string) {
  console.log("Searching for student:", searchName);
  
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .ilike("full_name", `%${searchName}%`)
    .limit(5);

  if (!profiles || profiles.length === 0) {
    return null;
  }

  const detailedStudents = await Promise.all(
    profiles.map(async (profile: any) => {
      // Reduced from 11 to 5 core queries per student to minimize DB load
      const [applications, documents, payments, tasks, scheduledPayments] = await Promise.all([
        supabase.from("applications").select("*, university:universities(*)").eq("student_id", profile.user_id).order("created_at", { ascending: false }),
        supabase.from("documents").select("*").eq("student_id", profile.user_id).order("created_at", { ascending: false }),
        supabase.from("payments").select("*, transactions:payment_transactions(*)").eq("student_id", profile.user_id).order("created_at", { ascending: false }),
        supabase.from("tasks").select("*").eq("student_id", profile.user_id).order("created_at", { ascending: false }).limit(10),
        supabase.from("scheduled_payments").select("*").eq("student_id", profile.user_id).order("scheduled_date", { ascending: true }),
      ]);

      return {
        profile,
        applications: applications.data || [],
        documents: documents.data || [],
        payments: payments.data || [],
        notes: [],
        comments: [],
        calls: [],
        messageThreads: [],
        tasks: tasks.data || [],
        scheduledPayments: scheduledPayments.data || [],
        budgets: [],
        bonuses: [],
      };
    })
  );

  return detailedStudents;
}

// Format student details for AI context
function formatStudentDetails(student: any): string {
  const { profile, applications, documents, payments, notes, comments, calls, tasks, scheduledPayments, budgets, bonuses } = student;
  
  // Calculate payment summary
  const totalAmount = payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
  const paidAmount = payments.reduce((sum: number, p: any) => sum + Number(p.paid_amount || 0), 0);
  const pendingAmount = totalAmount - paidAmount;
  
  // Calculate document summary
  const docsUploaded = documents.filter((d: any) => d.status === "uploaded").length;
  const docsApproved = documents.filter((d: any) => d.status === "approved").length;
  const docsRejected = documents.filter((d: any) => d.status === "rejected").length;
  
  // Calculate application summary
  const appsAccepted = applications.filter((a: any) => a.decision === "accepted").length;
  const appsPending = applications.filter((a: any) => !a.decision || a.decision === "pending").length;
  
  // Scheduled payments info
  const upcomingPayments = scheduledPayments?.filter((sp: any) => sp.status === 'pending') || [];
  
  let details = `
══════════════════════════════════════
📋 STUDENT: ${profile.full_name || "Unknown"}
══════════════════════════════════════
📞 Phone: ${profile.phone || "N/A"}
🎂 Birth Date: ${profile.birth_date || "N/A"}
📝 Contract Date: ${profile.contract_date || "N/A"}
💰 Payment Plan: ${profile.payment_plan || "N/A"}
🏢 Office: ${profile.office_location || "N/A"}
🔑 Magic Code: [HIDDEN]
🗣️ Language: ${profile.preferred_language || "N/A"}
🇰🇷 Korean Level (TOPIK): ${profile.topik_level || "N/A"}
📚 IELTS Score: ${profile.ielts_score || "N/A"}
📍 City: ${profile.city || "N/A"}
📅 Registered: ${profile.created_at ? new Date(profile.created_at).toLocaleDateString() : "N/A"}

💵 PAYMENT SUMMARY:
   Total: $${totalAmount} | Paid: $${paidAmount} | Remaining: $${pendingAmount}

📅 SCHEDULED PAYMENTS (${upcomingPayments.length} pending):
${upcomingPayments.map((sp: any) => 
  `   • ${sp.payment_type}: $${sp.amount} - ${sp.scheduled_date ? new Date(sp.scheduled_date).toLocaleDateString() : 'TBD'} (${sp.trigger_type})`
).join("\n") || "   No scheduled payments"}

💼 STUDENT BUDGETS (${budgets?.length || 0}):
${(budgets || []).map((b: any) => 
  `   • ${b.category}: $${b.allocated_amount} (Spent: $${b.spent_amount || 0}) - ${b.status}`
).join("\n") || "   No budgets"}

🎁 STAFF BONUSES (${bonuses?.length || 0}):
${(bonuses || []).map((b: any) => 
  `   • ${b.plan_type}: $${b.bonus_amount} - ${b.status}${b.staff_user_id ? ' (assigned)' : ' (unassigned)'}`
).join("\n") || "   No bonuses"}

📄 DOCUMENT SUMMARY:
   Total: ${documents.length} | Uploaded: ${docsUploaded} | Approved: ${docsApproved} | Rejected: ${docsRejected}

🎓 APPLICATION SUMMARY:
   Total: ${applications.length} | Accepted: ${appsAccepted} | Pending: ${appsPending}

───────────────────────────────────────
📚 APPLICATIONS (${applications.length}):
${applications.map((app: any) => 
  `   • ${app.university?.name_en || "Unknown University"}
     Status: ${app.status} | Decision: ${app.decision || "Pending"}
     ${app.notes ? `Notes: ${app.notes}` : ""}`
).join("\n") || "   No applications"}

───────────────────────────────────────
📁 DOCUMENTS (${documents.length}):
${documents.map((doc: any) => 
  `   • ${doc.name}: ${doc.status}${doc.notes ? ` (${doc.notes})` : ""}`
).join("\n") || "   No documents"}

───────────────────────────────────────
💳 PAYMENTS (${payments.length}):
${payments.map((p: any) => {
  const transactions = p.transactions || [];
  return `   • ${p.payment_type}: $${p.amount} (Paid: $${p.paid_amount}) - ${p.status}
     ${p.due_date ? `Due: ${new Date(p.due_date).toLocaleDateString()}` : ""}${p.notes ? ` | Notes: ${p.notes}` : ""}
     ${transactions.length > 0 ? `Transactions: ${transactions.length}` : ""}`;
}).join("\n") || "   No payments"}

───────────────────────────────────────
✅ TASKS (${tasks.length}):
${tasks.map((t: any) => 
  `   • [${t.priority}] ${t.title}: ${t.status}${t.due_date ? ` (Due: ${new Date(t.due_date).toLocaleDateString()})` : ""}`
).join("\n") || "   No tasks"}

───────────────────────────────────────
📝 STAFF NOTES (${notes.length}):
${notes.map((n: any) => 
  `   • [${new Date(n.created_at).toLocaleDateString()}] ${n.creator?.full_name || "Staff"}: ${n.content}`
).join("\n") || "   No notes"}

───────────────────────────────────────
💬 STAFF COMMENTS (${comments.length}):
${comments.map((c: any) => 
  `   • [${new Date(c.created_at).toLocaleDateString()}] ${c.creator?.full_name || "Staff"}: ${c.content}`
).join("\n") || "   No comments"}

───────────────────────────────────────
📞 CALL HISTORY (${calls.length}):
${calls.map((call: any) => 
  `   • [${new Date(call.started_at).toLocaleDateString()}] ${call.direction} (${call.duration}s) - ${call.status}
     ${call.notes ? `Notes: ${call.notes}` : "No notes"}`
).join("\n") || "   No calls"}
══════════════════════════════════════
`;

  return details;
}

// Get COMPLETE system context for full awareness
async function getFullSystemContext(supabase: any) {
  console.log("Fetching full system context for comprehensive AI awareness...");
  
  const [
    // Core counts
    totalStudentsCount,
    totalLeadsCount,
    totalUniversitiesCount,
    totalApplicationsCount,
    totalDocumentsCount,
    totalPaymentsCount,
    totalTasksCount,
    totalMessagesCount,
    totalCallsCount,
    
    // Status breakdowns
    pendingDocuments,
    approvedDocuments,
    rejectedDocuments,
    pendingPayments,
    overduePayments,
    completedPayments,
    pendingTasks,
    completedTasks,
    unreadMessages,
    
    // Recent data with details
    recentApplications,
    recentDocuments,
    recentPayments,
    recentTasks,
    recentCalls,
    recentMessages,
    recentLeads,
    
    // All universities
    allUniversities,
    
    // All leads with details
    allLeads,
    
    // Staff data
    allStaff,
    staffPresence,
    staffBonuses,
    
    // Financial data
    allPaymentTransactions,
    allScheduledPayments,
    allStudentBudgets,
    
    // Application form data
    applicationFormCache,
    applicationFormChanges,
    
    // Interview data
    interviewSessions,
    interviewQuestions,
    
    // Translation data
    translationJobs,
    translationDocTypes,
    
    // Communication data
    messageThreads,
    
    // Room/channel data
    universityRooms,
    roomChannels,
    
  ] = await Promise.all([
    // Core counts
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase.from("universities").select("*", { count: "exact", head: true }),
    supabase.from("applications").select("*", { count: "exact", head: true }),
    supabase.from("documents").select("*", { count: "exact", head: true }),
    supabase.from("payments").select("*", { count: "exact", head: true }),
    supabase.from("tasks").select("*", { count: "exact", head: true }),
    supabase.from("messages").select("*", { count: "exact", head: true }),
    supabase.from("calls").select("*", { count: "exact", head: true }),
    
    // Status breakdowns
    supabase.from("documents").select("*", { count: "exact", head: true }).eq("status", "uploaded"),
    supabase.from("documents").select("*", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("documents").select("*", { count: "exact", head: true }).eq("status", "rejected"),
    supabase.from("payments").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("payments").select("*", { count: "exact", head: true }).eq("status", "overdue"),
    supabase.from("payments").select("*", { count: "exact", head: true }).eq("status", "completed"),
    supabase.from("tasks").select("*", { count: "exact", head: true }).neq("status", "completed"),
    supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "completed"),
    supabase.from("message_threads").select("*", { count: "exact", head: true }).gt("unread_count", 0),
    
    // Recent data with full details
    supabase.from("applications").select("*, student:profiles!applications_student_id_fkey(full_name, phone, city), university:universities(name_en, name_ko, city)").order("updated_at", { ascending: false }).limit(20),
    supabase.from("documents").select("*, student:profiles!documents_student_id_fkey(full_name)").order("created_at", { ascending: false }).limit(20),
    supabase.from("payments").select("*, student:profiles!payments_student_id_fkey(full_name, phone)").order("created_at", { ascending: false }).limit(20),
    supabase.from("tasks").select("*, student:profiles!tasks_student_id_fkey(full_name), assignee:profiles!tasks_assigned_to_fkey(full_name)").order("created_at", { ascending: false }).limit(30),
    supabase.from("calls").select("*, student:profiles!calls_student_id_fkey(full_name, phone)").order("started_at", { ascending: false }).limit(20),
    supabase.from("messages").select("*").order("created_at", { ascending: false }).limit(30),
    supabase.from("leads").select("*, notes:lead_notes(*)").order("created_at", { ascending: false }).limit(50),
    
    // All universities
    supabase.from("universities").select("*").order("ranking", { ascending: true }),
    
    // All leads
    supabase.from("leads").select("*").order("priority_score", { ascending: false }).limit(100),
    
    // Staff data
    supabase.from("user_roles").select("*, profile:profiles!user_roles_user_id_fkey(full_name, phone)"),
    supabase.from("staff_presence").select("*, profile:profiles!staff_presence_user_id_fkey(full_name)"),
    supabase.from("staff_bonuses").select("*, student:profiles!staff_bonuses_student_id_fkey(full_name)").order("created_at", { ascending: false }).limit(50),
    
    // Financial data
    supabase.from("payment_transactions").select("*, payment:payments(student_id, payment_type)").order("created_at", { ascending: false }).limit(50),
    supabase.from("scheduled_payments").select("*, student:profiles!scheduled_payments_student_id_fkey(full_name)").order("scheduled_date", { ascending: true }).limit(50),
    supabase.from("student_budgets").select("*, student:profiles!student_budgets_student_id_fkey(full_name)").order("created_at", { ascending: false }).limit(50),
    
    // Application form data
    supabase.from("application_form_cache").select("*, university:universities(name_en)").order("updated_at", { ascending: false }).limit(20),
    supabase.from("application_form_changes").select("*, university:universities(name_en)").eq("acknowledged_at", null).order("detected_at", { ascending: false }).limit(20),
    
    // Interview data
    supabase.from("interview_sessions").select("*, university:universities(name_en), feedback:interview_feedback(*)").order("created_at", { ascending: false }).limit(20),
    supabase.from("interview_questions").select("*, university:universities(name_en)").eq("is_active", true).limit(50),
    
    // Translation data
    supabase.from("translation_jobs").select("*").order("created_at", { ascending: false }).limit(20),
    supabase.from("translation_document_types").select("*").eq("is_active", true),
    
    // Communication
    supabase.from("message_threads").select("*").order("last_message_at", { ascending: false }).limit(30),
    
    // Rooms
    supabase.from("university_rooms").select("*, university:universities(name_en), members:room_members(count)").limit(20),
    supabase.from("room_channels").select("*, room:university_rooms(university_id)").limit(50),
  ]);

  // Calculate financial totals from recentPayments data (avoid extra query)
  const allPaymentsForCalc = recentPayments.data || [];
  const financialSummary = {
    totalRevenue: allPaymentsForCalc.reduce((sum: number, p: any) => sum + Number(p.paid_amount || 0), 0),
    totalPending: allPaymentsForCalc.reduce((sum: number, p: any) => sum + (Number(p.amount || 0) - Number(p.paid_amount || 0)), 0),
    totalOverdue: allPaymentsForCalc.filter((p: any) => p.status === 'overdue').reduce((sum: number, p: any) => sum + (Number(p.amount || 0) - Number(p.paid_amount || 0)), 0),
  };

  // Lead statistics
  const leadStats = {
    total: totalLeadsCount.count || 0,
    new: (allLeads.data || []).filter((l: any) => l.status === 'new').length,
    contacted: (allLeads.data || []).filter((l: any) => l.status === 'contacted').length,
    qualified: (allLeads.data || []).filter((l: any) => l.status === 'qualified').length,
    converted: (allLeads.data || []).filter((l: any) => l.status === 'converted').length,
    lost: (allLeads.data || []).filter((l: any) => l.status === 'lost').length,
    highPriority: (allLeads.data || []).filter((l: any) => (l.priority_score || 0) >= 70).length,
  };

  // Application statistics by status
  const appsByStatus: Record<string, number> = {};
  (recentApplications.data || []).forEach((app: any) => {
    appsByStatus[app.status] = (appsByStatus[app.status] || 0) + 1;
  });

  return {
    counts: {
      totalStudents: totalStudentsCount.count || 0,
      totalLeads: totalLeadsCount.count || 0,
      totalUniversities: totalUniversitiesCount.count || 0,
      totalApplications: totalApplicationsCount.count || 0,
      totalDocuments: totalDocumentsCount.count || 0,
      totalPayments: totalPaymentsCount.count || 0,
      totalTasks: totalTasksCount.count || 0,
      totalMessages: totalMessagesCount.count || 0,
      totalCalls: totalCallsCount.count || 0,
    },
    statusBreakdowns: {
      documents: {
        pending: pendingDocuments.count || 0,
        approved: approvedDocuments.count || 0,
        rejected: rejectedDocuments.count || 0,
      },
      payments: {
        pending: pendingPayments.count || 0,
        overdue: overduePayments.count || 0,
        completed: completedPayments.count || 0,
      },
      tasks: {
        pending: pendingTasks.count || 0,
        completed: completedTasks.count || 0,
      },
      messages: {
        unread: unreadMessages.count || 0,
      },
    },
    leadStats,
    financialSummary,
    applicationsByStatus: appsByStatus,
    recentActivity: {
      applications: recentApplications.data || [],
      documents: recentDocuments.data || [],
      payments: recentPayments.data || [],
      tasks: recentTasks.data || [],
      calls: recentCalls.data || [],
      messages: recentMessages.data || [],
      leads: recentLeads.data || [],
    },
    universities: allUniversities.data || [],
    allLeads: allLeads.data || [],
    staff: {
      roles: allStaff.data || [],
      presence: staffPresence.data || [],
      bonuses: staffBonuses.data || [],
    },
    financial: {
      transactions: allPaymentTransactions.data || [],
      scheduled: allScheduledPayments.data || [],
      budgets: allStudentBudgets.data || [],
    },
    applicationForms: {
      cache: applicationFormCache.data || [],
      changes: applicationFormChanges.data || [],
    },
    interviews: {
      sessions: interviewSessions.data || [],
      questions: interviewQuestions.data || [],
    },
    translations: {
      jobs: translationJobs.data || [],
      docTypes: translationDocTypes.data || [],
    },
    communication: {
      threads: messageThreads.data || [],
    },
    rooms: {
      universityRooms: universityRooms.data || [],
      channels: roomChannels.data || [],
    },
  };
}

// Context aggregation for students
async function getStudentContext(supabase: any, userId: string) {
  console.log("Fetching student context for:", userId);
  
  const [
    profileResult,
    applicationsResult,
    documentsResult,
    paymentsResult,
    messageThreadsResult,
    callsResult,
    previousChatsResult,
    universitiesResult,
    tasksResult,
    scheduledPaymentsResult,
    budgetsResult,
    interviewSessionsResult,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).single(),
    supabase.from("applications").select("*, university:universities(*)").eq("student_id", userId).order("created_at", { ascending: false }),
    supabase.from("documents").select("*").eq("student_id", userId).order("created_at", { ascending: false }),
    supabase.from("payments").select("*, transactions:payment_transactions(*)").eq("student_id", userId).order("created_at", { ascending: false }),
    supabase.from("message_threads").select("*").eq("student_id", userId).order("last_message_at", { ascending: false }).limit(5),
    supabase.from("calls").select("*").eq("student_id", userId).order("started_at", { ascending: false }).limit(10),
    supabase.from("ai_conversations").select("role, content, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    supabase.from("universities").select("*").eq("is_visible_on_map", true).order("ranking", { ascending: true }),
    supabase.from("tasks").select("*").eq("student_id", userId).order("created_at", { ascending: false }).limit(10),
    supabase.from("scheduled_payments").select("*").eq("student_id", userId).order("scheduled_date", { ascending: true }),
    supabase.from("student_budgets").select("*").eq("student_id", userId),
    supabase.from("interview_sessions").select("*, feedback:interview_feedback(*), university:universities(name_en)").eq("student_id", userId).order("created_at", { ascending: false }).limit(5),
  ]);

  return {
    profile: profileResult.data,
    applications: applicationsResult.data || [],
    documents: documentsResult.data || [],
    payments: paymentsResult.data || [],
    messageThreads: messageThreadsResult.data || [],
    calls: callsResult.data || [],
    tasks: tasksResult.data || [],
    scheduledPayments: scheduledPaymentsResult.data || [],
    budgets: budgetsResult.data || [],
    interviewSessions: interviewSessionsResult.data || [],
    previousChats: (previousChatsResult.data || []).reverse(),
    universities: universitiesResult.data || [],
  };
}

// Context aggregation for staff - ENHANCED with caching
async function getStaffContext(supabase: any, userId: string, studentQuery: string | null) {
  console.log("Fetching enhanced staff context for:", userId, "Student query:", studentQuery);
  
  // Get staff's own data
  const [
    profileResult,
    rolesResult,
    assignedTasksResult,
    createdTasksResult,
    previousChatsResult,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).single(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("tasks").select("*, student:profiles!tasks_student_id_fkey(full_name, phone)").eq("assigned_to", userId).neq("status", "completed").order("created_at", { ascending: false }).limit(30),
    supabase.from("tasks").select("*").eq("created_by", userId).order("created_at", { ascending: false }).limit(15),
    supabase.from("ai_conversations").select("role, content, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
  ]);

  // Try to get cached system context (5 minute TTL)
  let systemContext: any = null;
  const { data: cachedContext } = await supabase
    .from("ai_context_cache")
    .select("context_data, updated_at")
    .eq("user_id", userId)
    .eq("user_type", "staff_system")
    .single();

  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  if (cachedContext && cachedContext.updated_at) {
    const cacheAge = Date.now() - new Date(cachedContext.updated_at).getTime();
    if (cacheAge < CACHE_TTL_MS) {
      console.log("Using cached system context (age: " + Math.round(cacheAge / 1000) + "s)");
      systemContext = cachedContext.context_data;
    }
  }

  if (!systemContext) {
    console.log("Cache miss — fetching full system context...");
    systemContext = await getFullSystemContext(supabase);

    // Save to cache (upsert)
    await supabase
      .from("ai_context_cache")
      .upsert({
        user_id: userId,
        user_type: "staff_system",
        context_data: systemContext,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id, user_type" })
      .select();
  }

  // Get all students with details
  const recentStudentsResult = await supabase
    .from("profiles")
    .select("user_id, full_name, phone, created_at, payment_plan, office_location, city, topik_level, contract_date")
    .order("created_at", { ascending: false })
    .limit(200);

  let queriedStudents: any[] | null = null;
  if (studentQuery) {
    queriedStudents = await searchStudentByName(supabase, studentQuery);
  }

  return {
    profile: profileResult.data,
    roles: (rolesResult.data || []).map((r: any) => r.role),
    assignedTasks: assignedTasksResult.data || [],
    createdTasks: createdTasksResult.data || [],
    previousChats: (previousChatsResult.data || []).reverse(),
    systemContext,
    recentStudents: recentStudentsResult.data || [],
    queriedStudents,
  };
}

// Build system prompt for students
function buildStudentSystemPrompt(context: any, language: string): string {
  const langInstructions: Record<string, string> = {
    uz: `MUHIM: Faqat O'zbek tilida javob bering. Barcha javoblar O'zbek tilida bo'lishi kerak.

O'ZBEK TILIDA JAVOB BERISH QOIDALARI:
- Hurmatli murojaat qiling (Siz, Sizning)
- Oddiy, tushunarli so'zlar ishlating
- Texnik atamalarni o'zbekcha tushuntiring
- Agar foydalanuvchi o'zbekcha yozsa, albatta o'zbekcha javob bering
- Dollar summasini yozganda "$" belgisini ishlating
- Sanalarni kun.oy.yil formatida yozing

UMUMIY IBORALAR:
- Hujjatlar = Documents
- To'lov = Payment
- Ariza = Application
- Universitet = University
- Qabul = Admission
- Viza = Visa

FOYDALANUVCHI SAVOLLARIGA MISOL JAVOBLAR:
- "Qanday hujjatlar kerak?" → Kerakli hujjatlar ro'yxatini bering
- "Qancha to'lashim kerak?" → To'lov ma'lumotlarini ko'rsating
- "Arizam qayerda?" → Ariza holatini tushuntiring`,

    ru: `ВАЖНО: Отвечайте ТОЛЬКО на русском языке. Все ответы должны быть на русском.

Если пользователь пишет на узбекском, но язык интерфейса русский, всё равно отвечайте на русском.`,

    ko: `중요: 한국어로만 답변해 주세요. 모든 답변은 한국어로 작성되어야 합니다.`,

    en: "Respond in English only. Be clear and professional.",
  };

  // Calculate summaries
  const totalPayment = context.payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
  const paidAmount = context.payments.reduce((sum: number, p: any) => sum + Number(p.paid_amount || 0), 0);
  const pendingDocs = context.documents.filter((d: any) => d.status === "uploaded").length;
  const approvedDocs = context.documents.filter((d: any) => d.status === "approved").length;
  const rejectedDocs = context.documents.filter((d: any) => d.status === "rejected");
  
  // Format applications
  const appList = context.applications.map((app: any) => {
    const uni = app.university;
    return `• **${uni?.name_en || "University"}** (${uni?.city || "Korea"})
  - Status: ${formatStatus(app.status, language)}
  - Decision: ${formatDecision(app.decision || "pending", language)}
  ${app.notes ? `- Notes: ${app.notes}` : ""}`;
  }).join("\n\n") || "No applications yet";

  // Format documents
  const docList = context.documents.map((doc: any) => 
    `• **${doc.name}**: ${formatDocStatus(doc.status, language)}${doc.notes ? ` (${doc.notes})` : ""}`
  ).join("\n") || "No documents uploaded";

  // Format payments
  const paymentList = context.payments.map((p: any) => 
    `• **${p.payment_type}**: $${p.amount} (Paid: $${p.paid_amount}) - ${formatPaymentStatus(p.status, language)}
  ${p.due_date ? `Due: ${new Date(p.due_date).toLocaleDateString()}` : ""}${p.notes ? ` | ${p.notes}` : ""}`
  ).join("\n") || "No payments recorded";

  // Format tasks
  const taskList = context.tasks.map((t: any) => {
    const urgency = t.priority === "urgent" ? "🔴" : t.priority === "high" ? "🟠" : "🟢";
    return `${urgency} **${t.title}**: ${t.status}${t.due_date ? ` (Due: ${new Date(t.due_date).toLocaleDateString()})` : ""}`;
  }).join("\n") || "No pending tasks";

  // Scheduled payments
  const scheduledList = (context.scheduledPayments || []).filter((sp: any) => sp.status === 'pending').map((sp: any) => 
    `• ${sp.payment_type}: $${sp.amount} - ${sp.scheduled_date ? new Date(sp.scheduled_date).toLocaleDateString() : 'TBD'}`
  ).join("\n") || "No upcoming payments";

  // Interview history
  const interviewList = (context.interviewSessions || []).map((s: any) => {
    const feedback = s.feedback?.[0];
    return `• ${s.university?.name_en || 'Practice'} - ${s.status} ${feedback ? `(Score: ${feedback.overall_score}/100)` : ''}`;
  }).join("\n") || "No interview sessions";

  // Universities list
  const uniList = context.universities.slice(0, 10).map((u: any) => 
    `• **${u.name_en}** - ${u.city || "Korea"} (Rank: ${u.ranking || "N/A"})`
  ).join("\n");

  // Standard documents list
  const standardDocuments = [
    "Passport (valid for 6+ months)",
    "High School Diploma / Bachelor's Degree",
    "Academic Transcript",
    "TOPIK Certificate (if available)",
    "IELTS/TOEFL Score (if available)",
    "Bank Statement (proof of funds)",
    "Study Plan / Letter of Intent",
    "Recommendation Letters",
    "Health Certificate",
    "Photos (passport size)"
  ];

  const uploadedDocNames = context.documents.map((d: any) => d.name.toLowerCase());
  const potentialMissingDocs = standardDocuments.filter(doc => 
    !uploadedDocNames.some((uploaded: string) => uploaded.includes(doc.toLowerCase().split(" ")[0]))
  );

  return `# 🎓 HANGUK AI - Your Personal Study Abroad Assistant

${langInstructions[language] || langInstructions.en}

## Your Identity
You are Hanguk AI, a friendly and knowledgeable assistant for students applying to Korean universities through Hanguk Education. You have complete access to this student's data and can answer any question about their application journey.

## 📋 Student Profile
**Name:** ${context.profile?.full_name || "Student"}
**Phone:** ${context.profile?.phone || "Not provided"}
**City:** ${context.profile?.city || "Not provided"}
**Contract Date:** ${context.profile?.contract_date || "Not set"}
**Payment Plan:** ${context.profile?.payment_plan || "Not assigned"}
**Magic Code:** ${context.profile?.magic_code || "Not assigned"}
**TOPIK Level:** ${context.profile?.topik_level || "Not tested"}
**IELTS Score:** ${context.profile?.ielts_score || "Not provided"}

---

## 📊 DASHBOARD SUMMARY

### 💰 Payment Summary
- **Total:** $${totalPayment.toLocaleString()}
- **Paid:** $${paidAmount.toLocaleString()}
- **Remaining:** $${(totalPayment - paidAmount).toLocaleString()}

### 📅 Upcoming Payments
${scheduledList}

### 📄 Documents
- **Total:** ${context.documents.length}
- **Pending Review:** ${pendingDocs}
- **Approved:** ${approvedDocs}
- **Rejected:** ${rejectedDocs.length}

### 🎓 Applications: ${context.applications.length}

### 🎤 Interview Practice Sessions: ${(context.interviewSessions || []).length}
${interviewList}

---

## 📚 MY APPLICATIONS
${appList}

---

## 📁 MY DOCUMENTS
${docList}

### Standard Documents Typically Required:
${standardDocuments.map(d => `• ${d}`).join("\n")}

### Potentially Missing Documents:
${potentialMissingDocs.length > 0 ? potentialMissingDocs.map(d => `• ${d}`).join("\n") : "You seem to have uploaded the main documents!"}

---

## 💳 MY PAYMENTS
${paymentList}

---

## ✅ MY TASKS
${taskList}

---

## 🏫 PARTNER UNIVERSITIES (Recommended)
${uniList}

---

## 📋 RESPONSE GUIDELINES

### Always:
1. **Be specific** - Reference the student's actual data above
2. **Be encouraging** - Studying abroad is exciting but stressful
3. **Be helpful** - Provide actionable next steps
4. **Use formatting** - Use bullet points and headers for clarity

---

## 🚫 STRICT RESTRICTIONS - CONFIDENTIAL INFORMATION

**CRITICAL: You are a STUDENT-FACING assistant. You must NEVER reveal or discuss:**

### Financial & Business Secrets:
- ❌ Internal payment distribution or shareholder splits
- ❌ Staff salaries, bonuses, or commission structures
- ❌ Operational fund details or internal budgets
- ❌ Company profit margins or revenue breakdowns
- ❌ Payment processing fees or internal transaction details
- ❌ Price negotiation history or discount policies

### Internal Operations:
- ❌ Staff tasks, assignments, or workload
- ❌ Internal notes, comments, or staff communications about the student
- ❌ Lead management data or conversion rates
- ❌ CRM workflows or internal processes
- ❌ Staff performance metrics or evaluations
- ❌ Internal deadlines or staff schedules

### Other Students & Leads:
- ❌ Information about other students or applicants
- ❌ Lead information or prospective student data
- ❌ Comparative data about other applications
- ❌ Success/failure rates of other students

### System & Technical:
- ❌ Database structure or system architecture
- ❌ Admin tools or CRM features
- ❌ Staff-only functions or capabilities
- ❌ Internal reporting or analytics

### If asked about restricted topics, respond with:
"I'm here to help with YOUR application journey! For questions about [topic], please contact your consultant directly."

---

### SMART RESPONSES for common questions:

**"What documents do I need?"**
1. First, check their current uploaded documents
2. Compare with the standard requirements list AND the specific university requirements
3. List the potentially missing documents
4. Prioritize based on their application status

**"Which universities am I applying to?"**
→ List their exact applications with current status and next steps

**"How much do I owe?"**
→ Show their payment summary with remaining balance and due dates

**"What's my application status?"**
→ Give detailed status for each university and what happens next

**"When will I hear back?"**
→ If under university review, explain typical timelines (2-4 weeks usually)

### Edge Cases:
- **No data available:** Say "I don't have that information yet. Please contact your consultant."
- **Technical questions:** Provide what you know, suggest contacting staff for specifics
- **Visa questions:** Give general guidance, recommend official sources

### Actionable Suggestions:
ALWAYS end your response with 1-2 specific next steps based on their data:
- If missing documents: "Next step: Upload your [specific document]"
- If payment due: "Remember: Your payment of $X is due on [date]"
- If waiting for response: "Your application to [university] is under review - typically takes 2-4 weeks"

### Formatting:
- Use **bold** for important information
- Use bullet points for lists
- Use emojis sparingly but appropriately (📚 🎓 ✅ ⏳ ❌)
- Keep responses concise but complete`;
}

// Build system prompt for staff - ENHANCED with full system awareness
function buildStaffSystemPrompt(context: any, language: string): string {
  const langInstructions: Record<string, string> = {
    uz: `MUHIM: Faqat O'zbek tilida javob bering.

O'ZBEK TILIDA ISHLASH QOIDALARI:
- Xodimlar bilan hurmatli muomala qiling
- CRM atamalarini o'zbekcha ishlating:
  - Talaba = Student
  - Hujjat = Document  
  - To'lov = Payment
  - Vazifa = Task
  - Ariza = Application
  - Qabul = Admission
  - Lead = Potentsial mijoz
  - Muddati o'tgan = Overdue
  - Kutilmoqda = Pending
  - Tasdiqlangan = Approved
  - Rad etilgan = Rejected
- Hisobotlarni o'zbekcha taqdim eting
- Raqamlarni aniq ko'rsating`,

    ru: `ВАЖНО: Отвечайте ТОЛЬКО на русском языке. Используйте профессиональную терминологию CRM.`,

    ko: `중요: 한국어로만 답변해 주세요. CRM 전문 용어를 한국어로 사용하세요.`,

    en: "Respond in English. Use professional CRM terminology.",
  };

  const sys = context.systemContext;
  
  // Format tasks
  const taskList = context.assignedTasks.slice(0, 15).map((t: any) => {
    const urgency = t.priority === "urgent" ? "🔴" : t.priority === "high" ? "🟠" : "🟢";
    return `${urgency} [${t.priority.toUpperCase()}] ${t.title}
   Student: ${t.student?.full_name || "N/A"} (${t.student?.phone || "no phone"}) | Status: ${t.status}${t.due_date ? ` | Due: ${new Date(t.due_date).toLocaleDateString()}` : ""}`;
  }).join("\n") || "No pending tasks";

  // Recent applications
  const recentApps = (sys?.recentActivity?.applications || []).slice(0, 10).map((a: any) => 
    `• ${a.student?.full_name || "Unknown"} → ${a.university?.name_en || "Unknown"}: ${formatStatus(a.status)} ${a.decision ? `(${a.decision})` : ""}`
  ).join("\n") || "None";

  // Recent documents
  const recentDocs = (sys?.recentActivity?.documents || []).slice(0, 10).map((d: any) => 
    `• ${d.student?.full_name || "Unknown"}: ${d.name} (${formatDocStatus(d.status)})`
  ).join("\n") || "None";

  // Recent payments
  const recentPayments = (sys?.recentActivity?.payments || []).slice(0, 10).map((p: any) => 
    `• ${p.student?.full_name || "Unknown"}: $${p.amount} (${p.status}) - ${p.payment_type}`
  ).join("\n") || "None";

  // Recent leads
  const recentLeads = (sys?.recentActivity?.leads || []).slice(0, 10).map((l: any) => 
    `• ${l.full_name} (${l.phone || "no phone"}) - ${l.status} | Source: ${l.source}${l.priority_score ? ` | Priority: ${l.priority_score}` : ""}`
  ).join("\n") || "None";

  // All students list
  const studentList = context.recentStudents.slice(0, 100).map((s: any) => 
    `• ${s.full_name || "Unnamed"} | ${s.phone || "No phone"} | ${s.office_location || "No office"} | ${s.city || "Unknown city"} | Code: ${s.magic_code || "N/A"}`
  ).join("\n");

  // Staff presence
  const onlineStaff = (sys?.staff?.presence || []).filter((p: any) => p.status === 'online').map((p: any) => 
    `• ${p.profile?.full_name || "Unknown"} (online)`
  ).join("\n") || "No staff online";

  // Universities
  const uniList = (sys?.universities || []).slice(0, 20).map((u: any) => 
    `• ${u.name_en} | ${u.city || "Korea"} | Rank: ${u.ranking || "N/A"} | Visible: ${u.is_visible_on_map ? "Yes" : "No"}`
  ).join("\n") || "No universities";

  // Scheduled payments
  const scheduledPayments = (sys?.financial?.scheduled || []).filter((sp: any) => sp.status === 'pending').slice(0, 10).map((sp: any) => 
    `• ${sp.student?.full_name || "Unknown"}: $${sp.amount} (${sp.payment_type}) - ${sp.scheduled_date ? new Date(sp.scheduled_date).toLocaleDateString() : 'TBD'}`
  ).join("\n") || "None pending";

  // Application form changes (alerts)
  const formChanges = (sys?.applicationForms?.changes || []).slice(0, 5).map((c: any) => 
    `⚠️ ${c.university?.name_en}: ${c.field_name} changed (${c.severity})`
  ).join("\n") || "No pending changes";

  // Searched student details
  let queriedStudentInfo = "";
  if (context.queriedStudents && context.queriedStudents.length > 0) {
    queriedStudentInfo = "\n\n# 🔍 SEARCHED STUDENT DETAILS\n";
    queriedStudentInfo += context.queriedStudents.map((s: any) => formatStudentDetails(s)).join("\n\n");
  }

  // Generate insights and alerts
  const insights: string[] = [];
  if ((sys?.statusBreakdowns?.documents?.pending || 0) > 5) {
    insights.push(`⚠️ ${sys.statusBreakdowns.documents.pending} documents awaiting review`);
  }
  if ((sys?.statusBreakdowns?.payments?.overdue || 0) > 0) {
    insights.push(`🔴 ${sys.statusBreakdowns.payments.overdue} overdue payments need attention`);
  }
  if ((sys?.statusBreakdowns?.messages?.unread || 0) > 0) {
    insights.push(`📬 ${sys.statusBreakdowns.messages.unread} unread messages`);
  }
  if (context.assignedTasks.some((t: any) => t.priority === "urgent")) {
    insights.push(`🚨 You have urgent tasks requiring immediate attention`);
  }
  if ((sys?.leadStats?.highPriority || 0) > 0) {
    insights.push(`⭐ ${sys.leadStats.highPriority} high-priority leads need follow-up`);
  }
  if ((sys?.applicationForms?.changes || []).length > 0) {
    insights.push(`📝 ${sys.applicationForms.changes.length} university application form changes detected`);
  }

  return `# 🤖 HANGUK AI - FULL SYSTEM CRM ASSISTANT

${langInstructions[language] || langInstructions.en}

## Your Identity
You are Hanguk AI, an intelligent CRM assistant with COMPLETE ACCESS to ALL system data. You can answer ANY question about students, leads, payments, documents, universities, tasks, and all operations in the system.

## Current Staff Member
**Name:** ${context.profile?.full_name || "Staff"}
**Roles:** ${context.roles.join(", ") || "No roles assigned"}

---

# 📊 COMPLETE SYSTEM DASHBOARD

## 📈 CORE METRICS
| Metric | Count |
|--------|-------|
| 👥 Total Students | ${sys?.counts?.totalStudents || 0} |
| 🎯 Total Leads | ${sys?.counts?.totalLeads || 0} |
| 🏫 Universities | ${sys?.counts?.totalUniversities || 0} |
| 📋 Applications | ${sys?.counts?.totalApplications || 0} |
| 📄 Documents | ${sys?.counts?.totalDocuments || 0} |
| 💳 Payments | ${sys?.counts?.totalPayments || 0} |
| ✅ Tasks | ${sys?.counts?.totalTasks || 0} |
| 💬 Messages | ${sys?.counts?.totalMessages || 0} |
| 📞 Calls | ${sys?.counts?.totalCalls || 0} |

## 💰 FINANCIAL SUMMARY
| Metric | Amount |
|--------|--------|
| 💵 Total Collected | $${(sys?.financialSummary?.totalRevenue || 0).toLocaleString()} |
| ⏳ Pending Amount | $${(sys?.financialSummary?.totalPending || 0).toLocaleString()} |
| 🔴 Overdue Amount | $${(sys?.financialSummary?.totalOverdue || 0).toLocaleString()} |

## 🎯 LEAD PIPELINE
| Stage | Count |
|-------|-------|
| 🆕 New | ${sys?.leadStats?.new || 0} |
| 📞 Contacted | ${sys?.leadStats?.contacted || 0} |
| ✅ Qualified | ${sys?.leadStats?.qualified || 0} |
| 🎓 Converted | ${sys?.leadStats?.converted || 0} |
| ❌ Lost | ${sys?.leadStats?.lost || 0} |
| ⭐ High Priority | ${sys?.leadStats?.highPriority || 0} |

## 📄 DOCUMENT STATUS
| Status | Count |
|--------|-------|
| 📤 Pending Review | ${sys?.statusBreakdowns?.documents?.pending || 0} |
| ✅ Approved | ${sys?.statusBreakdowns?.documents?.approved || 0} |
| ❌ Rejected | ${sys?.statusBreakdowns?.documents?.rejected || 0} |

## 💳 PAYMENT STATUS
| Status | Count |
|--------|-------|
| ⏳ Pending | ${sys?.statusBreakdowns?.payments?.pending || 0} |
| 🔴 Overdue | ${sys?.statusBreakdowns?.payments?.overdue || 0} |
| ✅ Completed | ${sys?.statusBreakdowns?.payments?.completed || 0} |

## ✅ TASK STATUS
| Status | Count |
|--------|-------|
| 📋 Pending | ${sys?.statusBreakdowns?.tasks?.pending || 0} |
| ✅ Completed | ${sys?.statusBreakdowns?.tasks?.completed || 0} |

${insights.length > 0 ? `\n## 🔔 ALERTS & INSIGHTS\n${insights.join("\n")}` : ""}

---

# 👤 YOUR TASKS (${context.assignedTasks.length} pending)
${taskList}

---

# 📈 RECENT ACTIVITY

## Latest Applications (20)
${recentApps}

## Latest Documents (20)
${recentDocs}

## Latest Payments (10)
${recentPayments}

## Latest Leads (10)
${recentLeads}

---

# 📅 SCHEDULED PAYMENTS (Upcoming)
${scheduledPayments}

---

# 📝 APPLICATION FORM ALERTS
${formChanges}

---

# 👥 STAFF ONLINE
${onlineStaff}

---

# 🏫 UNIVERSITIES (${(sys?.universities || []).length})
${uniList}

---

# 👥 ALL STUDENTS (${context.recentStudents.length})
${studentList}
${queriedStudentInfo}

---

# 🎯 ALL LEADS SUMMARY
Total: ${sys?.leadStats?.total || 0}
High Priority (score ≥70): ${sys?.leadStats?.highPriority || 0}

Recent leads:
${(sys?.allLeads || []).slice(0, 20).map((l: any) => 
  `• ${l.full_name} | ${l.phone || "no phone"} | ${l.email || "no email"} | Status: ${l.status} | Source: ${l.source} | Priority: ${l.priority_score || 0}
   ${l.preferred_university ? `Interested: ${l.preferred_university}` : ""} ${l.next_follow_up ? `| Follow-up: ${new Date(l.next_follow_up).toLocaleDateString()}` : ""}`
).join("\n")}

---

# 📋 RESPONSE GUIDELINES

## I CAN ANSWER QUESTIONS ABOUT:
- **Students**: Any student's profile, applications, documents, payments, tasks, notes
- **Leads**: Lead status, priority, contact history, conversion
- **Payments**: Who paid, who owes, overdue amounts, scheduled payments
- **Documents**: Document status, missing documents, review needed
- **Applications**: Status, university details, decision tracking
- **Universities**: Rankings, locations, application requirements
- **Tasks**: Assigned tasks, priorities, deadlines
- **Staff**: Online status, assigned students, performance
- **Financial**: Revenue, pending amounts, budget allocation
- **Communication**: Message threads, call history

## Student Lookup
When asked about a specific student:
1. Search the data above
2. If found in SEARCHED STUDENT DETAILS, provide complete info
3. Include: profile, applications, documents, payments, notes, tasks
4. If not found, suggest checking spelling or phone number

## Analytics Questions
- "How many students?" → Provide count and breakdown by status/office
- "Revenue this month?" → Show financial summary
- "Which leads need follow-up?" → List high-priority leads
- "Overdue payments?" → List students with overdue amounts

## Actionable Suggestions
Always end with 1-3 specific recommendations:
- "Follow up with [Lead] - high priority score"
- "Review [Student]'s documents - pending for X days"
- "[Task] is overdue - needs immediate attention"

## Formatting
- Use **tables** for comparisons
- Use **bullet points** for lists
- Use **bold** for key information
- Use emojis for visual scanning:
  - 🔴 Urgent/Overdue
  - 🟠 High priority
  - 🟢 Normal/Good
  - ⏳ Pending
  - ✅ Completed`;
}

// Helper functions for formatting - with Uzbek support
function formatStatus(status: string, lang: string = "en"): string {
  if (lang === "uz") {
    const uzbekStatusMap: Record<string, string> = {
      documents_collection: "📋 Hujjatlar yig'ilmoqda",
      documents_translation: "🔄 Hujjatlar tarjima qilinmoqda",
      apostille: "📜 Apostil jarayonida",
      application_submitted: "📤 Ariza topshirildi",
      university_review: "🏫 Universitet ko'rib chiqmoqda",
      accepted: "✅ Qabul qilindi",
      rejected: "❌ Rad etildi",
      visa_processing: "🛂 Viza jarayonida",
      completed: "🎉 Tugallandi",
    };
    return uzbekStatusMap[status] || status;
  }
  
  const statusMap: Record<string, string> = {
    documents_collection: "📋 Collecting Documents",
    documents_translation: "🔄 Translating Documents",
    apostille: "📜 Apostille Processing",
    application_submitted: "📤 Application Submitted",
    university_review: "🏫 Under University Review",
    accepted: "✅ Accepted",
    rejected: "❌ Rejected",
    visa_processing: "🛂 Visa Processing",
    completed: "🎉 Completed",
  };
  return statusMap[status] || status;
}

function formatDecision(decision: string, lang: string = "en"): string {
  if (lang === "uz") {
    const uzbekDecisionMap: Record<string, string> = {
      accepted: "✅ Qabul qilindi",
      rejected: "❌ Rad etildi", 
      pending: "⏳ Kutilmoqda",
      waitlisted: "📋 Kutish ro'yxatida",
    };
    return uzbekDecisionMap[decision] || decision;
  }
  
  const decisionMap: Record<string, string> = {
    accepted: "✅ Accepted",
    rejected: "❌ Rejected",
    pending: "⏳ Pending",
    waitlisted: "📋 Waitlisted",
  };
  return decisionMap[decision] || decision;
}

function formatDocStatus(status: string, lang: string = "en"): string {
  if (lang === "uz") {
    const uzbekDocStatusMap: Record<string, string> = {
      uploaded: "📤 Yuklangan (tekshirilmoqda)",
      approved: "✅ Tasdiqlangan",
      rejected: "❌ Rad etilgan",
      reviewing: "👀 Ko'rib chiqilmoqda",
    };
    return uzbekDocStatusMap[status] || status;
  }
  
  const statusMap: Record<string, string> = {
    uploaded: "📤 Uploaded (Pending Review)",
    approved: "✅ Approved",
    rejected: "❌ Rejected",
    reviewing: "👀 Under Review",
  };
  return statusMap[status] || status;
}

function formatPaymentStatus(status: string, lang: string = "en"): string {
  if (lang === "uz") {
    const uzbekPaymentStatusMap: Record<string, string> = {
      pending: "⏳ Kutilmoqda",
      partial: "🔄 Qisman to'langan",
      completed: "✅ To'langan",
      overdue: "🔴 Muddati o'tgan",
    };
    return uzbekPaymentStatusMap[status] || status;
  }
  
  const statusMap: Record<string, string> = {
    pending: "⏳ Pending",
    partial: "🔄 Partially Paid",
    completed: "✅ Paid",
    overdue: "🔴 Overdue",
  };
  return statusMap[status] || status;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, user_id, user_type, language: requestedLang = "en" } = await req.json();

    if (!message || !user_id || !user_type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: message, user_id, user_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auto-detect Uzbek if message appears to be in Uzbek, regardless of UI language
    const detectedUzbek = isUzbekMessage(message);
    const language = detectedUzbek ? "uz" : requestedLang;
    
    console.log(`[${user_type}] ${user_id} (lang: ${language}, detected_uz: ${detectedUzbek}): ${message.substring(0, 100)}...`);

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let context: any;
    let systemPrompt: string;

    if (user_type === "student") {
      context = await getStudentContext(supabase, user_id);
      systemPrompt = buildStudentSystemPrompt(context, language);
    } else {
      const studentQuery = extractStudentQuery(message);
      context = await getStaffContext(supabase, user_id, studentQuery);
      systemPrompt = buildStaffSystemPrompt(context, language);
    }

    await supabase.from("ai_conversations").insert({
      user_id,
      user_type,
      role: "user",
      content: message,
    });

    const messages = [
      { role: "system", content: systemPrompt },
      ...context.previousChats.slice(-10).map((c: any) => ({
        role: c.role,
        content: c.content,
      })),
      { role: "user", content: message },
    ];

    console.log("System prompt length:", systemPrompt.length);

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service unavailable. Please contact support." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";
    
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          await writer.write(value);
          
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try {
                const json = JSON.parse(line.slice(6));
                const content = json.choices?.[0]?.delta?.content;
                if (content) {
                  fullResponse += content;
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
        
        if (fullResponse) {
          await supabase.from("ai_conversations").insert({
            user_id,
            user_type,
            role: "assistant",
            content: fullResponse,
          });
        }
        
        await writer.close();
      } catch (error) {
        console.error("Stream processing error:", error);
        await writer.abort(error);
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Hanguk AI error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
