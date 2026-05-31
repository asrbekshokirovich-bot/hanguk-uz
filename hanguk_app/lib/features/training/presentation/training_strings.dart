/// User-facing strings for the training feature.
///
/// Audit L1 / L3 closure 2026-05-10: full `flutter_localizations` is
/// now wired (see `lib/l10n/`). `TrainingStrings.fromContext(context)`
/// returns the locale-correct surface via `AppLocalizations`.
/// `TrainingStrings.forTrack(track)` is preserved for call sites that
/// only have a track string (e.g. a session's `selected_track`) and no
/// `BuildContext` — those still hit the hand-rolled tables below until
/// a wider locale-handle plumb-through is done.
library training_strings;

import 'package:flutter/widgets.dart';
import '../../../l10n/app_localizations.dart';

class TrainingStrings {
  const TrainingStrings._({
    required this.tabTitle,
    required this.tabSubtitle,
    required this.studyPlanCardTitle,
    required this.studyPlanCardDesc,
    required this.personalStatementCardTitle,
    required this.personalStatementCardDesc,
    required this.interviewCardTitle,
    required this.interviewCardDesc,
    required this.applyCta,
    required this.noApplicationsTitle,
    required this.noApplicationsBody,
    required this.startInterview,
    required this.cancel,
    required this.endInterview,
    required this.endSession,
    required this.practiceAgain,
    required this.connecting,
    required this.greetWait,
    required this.yourTurn,
    required this.aiSpeaking,
    required this.wrappingUp,
    required this.micRequired,
  });

  final String tabTitle;
  final String tabSubtitle;
  final String studyPlanCardTitle;
  final String studyPlanCardDesc;
  final String personalStatementCardTitle;
  final String personalStatementCardDesc;
  final String interviewCardTitle;
  final String interviewCardDesc;
  final String applyCta;
  final String noApplicationsTitle;
  final String noApplicationsBody;
  final String startInterview;
  final String cancel;
  final String endInterview;
  final String endSession;
  final String practiceAgain;
  final String connecting;
  final String greetWait;
  final String yourTurn;
  final String aiSpeaking;
  final String wrappingUp;
  final String micRequired;

  static TrainingStrings forTrack(String? track) {
    switch (track) {
      case 'en':
      case 'english':
        return _en;
      case 'ko':
      case 'korean':
        return _ko;
      default:
        return _uz;
    }
  }

  /// Locale-aware view that pulls strings from the generated
  /// `AppLocalizations`. Prefer this over [forTrack] in widgets — it
  /// follows the device / `MaterialApp.locale` setting.
  static TrainingStrings fromContext(BuildContext context) {
    final l = AppLocalizations.of(context);
    if (l == null) return _en;
    return TrainingStrings._(
      tabTitle: l.trainingTabTitle,
      tabSubtitle: l.trainingTabSubtitle,
      studyPlanCardTitle: l.studyPlanCardTitle,
      studyPlanCardDesc: l.studyPlanCardDesc,
      personalStatementCardTitle: l.personalStatementCardTitle,
      personalStatementCardDesc: l.personalStatementCardDesc,
      interviewCardTitle: l.interviewCardTitle,
      interviewCardDesc: l.interviewCardDesc,
      applyCta: l.applyCta,
      noApplicationsTitle: l.noApplicationsTitle,
      noApplicationsBody: l.noApplicationsBody,
      startInterview: l.startInterview,
      cancel: l.cancel,
      endInterview: l.endInterview,
      endSession: l.endSession,
      practiceAgain: l.practiceAgain,
      connecting: l.connecting,
      greetWait: l.greetWait,
      yourTurn: l.yourTurn,
      aiSpeaking: l.aiSpeaking,
      wrappingUp: l.wrappingUp,
      micRequired: l.micRequired,
    );
  }

  static const TrainingStrings _en = TrainingStrings._(
    tabTitle: 'Training Center',
    tabSubtitle:
        'Prepare for your university applications with AI-guided training modules.',
    studyPlanCardTitle: 'Study Plan Builder',
    studyPlanCardDesc: 'Craft a compelling roadmap for your academic journey.',
    personalStatementCardTitle: 'Personal Statement',
    personalStatementCardDesc: 'Write effective and engaging personal essays.',
    interviewCardTitle: 'Interview Preparation',
    interviewCardDesc: 'Practice mock questions and improve your confidence.',
    applyCta: 'Apply to a university',
    noApplicationsTitle: 'No applications yet',
    noApplicationsBody:
        'Add a target university first — drafting starts from a target school.',
    startInterview: 'Start Interview',
    cancel: 'Cancel',
    endInterview: 'End Interview',
    endSession: 'End Session',
    practiceAgain: 'Practice Again',
    connecting: 'Connecting...',
    greetWait: 'Connecting — your interviewer will greet you shortly...',
    yourTurn: 'Your turn to speak',
    aiSpeaking: 'Interviewer is speaking...',
    wrappingUp: 'Wrapping up the interview...',
    micRequired: 'Microphone access is required for the interview.',
  );

  static const TrainingStrings _ko = TrainingStrings._(
    tabTitle: '트레이닝 센터',
    tabSubtitle: 'AI 가이드 트레이닝 모듈로 한국 대학 지원을 준비하세요.',
    studyPlanCardTitle: '학업 계획서 작성',
    studyPlanCardDesc: '학업 여정을 위한 설득력 있는 로드맵을 작성하세요.',
    personalStatementCardTitle: '자기소개서',
    personalStatementCardDesc: '효과적이고 매력적인 자기소개 에세이를 작성하세요.',
    interviewCardTitle: '면접 준비',
    interviewCardDesc: '모의 질문으로 연습하고 자신감을 키우세요.',
    applyCta: '대학에 지원하기',
    noApplicationsTitle: '아직 지원서가 없습니다',
    noApplicationsBody: '먼저 목표 대학을 추가하세요 — 초안은 목표 학교에서 시작합니다.',
    startInterview: '면접 시작',
    cancel: '취소',
    endInterview: '면접 종료',
    endSession: '세션 종료',
    practiceAgain: '다시 연습하기',
    connecting: '연결 중...',
    greetWait: '연결 중 — 면접관이 곧 인사할 것입니다...',
    yourTurn: '답변할 차례입니다',
    aiSpeaking: '면접관이 말하는 중...',
    wrappingUp: '면접을 마무리하는 중...',
    micRequired: '면접을 위해 마이크 권한이 필요합니다.',
  );

  static const TrainingStrings _uz = TrainingStrings._(
    tabTitle: 'Trening markazi',
    tabSubtitle:
        'AI yordamida universitet hujjatlaringizga tayyorgarlik ko\'ring.',
    studyPlanCardTitle: 'Study Plan tuzish',
    studyPlanCardDesc: 'O\'qish maqsadlaringiz uchun ishonchli reja tuzing.',
    personalStatementCardTitle: 'Personal Statement',
    personalStatementCardDesc: 'Samarali va jozibali shaxsiy insho yozing.',
    interviewCardTitle: 'Suhbatga tayyorgarlik',
    interviewCardDesc:
        'Sinov savollari bilan mashq qiling va o\'zingizga ishonchni mustahkamlang.',
    applyCta: 'Universitetga ariza topshirish',
    noApplicationsTitle: 'Hozircha arizalar yo\'q',
    noApplicationsBody:
        'Avval maqsadli universitetni qo\'shing — insho yozish u yerdan boshlanadi.',
    startInterview: 'Suhbatni boshlash',
    cancel: 'Bekor qilish',
    endInterview: 'Suhbatni tugatish',
    endSession: 'Sessiyani tugatish',
    practiceAgain: 'Yana mashq qilish',
    connecting: 'Ulanmoqda...',
    greetWait: 'Ulanmoqda — intervyuer tez orada salomlashadi...',
    yourTurn: 'Javob berish navbatingiz',
    aiSpeaking: 'Intervyuer gapirmoqda...',
    wrappingUp: 'Suhbat yakunlanmoqda...',
    micRequired: 'Suhbat uchun mikrofon ruxsati kerak.',
  );
}
