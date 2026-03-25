import { 
  BookOpen, 
  LayoutList, 
  Lightbulb, 
  AlertTriangle, 
  FileText, 
  MapPin, 
  Briefcase,
  GraduationCap,
  Target,
  Users,
  Clock,
  Star,
  type LucideIcon
} from 'lucide-react';

export type SectionType = 'intro' | 'sections' | 'tips' | 'mistakes' | 'example' | 'why_korea' | 'career' | 'general';

export interface InstructionSection {
  id: string;
  title: string;
  icon: LucideIcon;
  content: string[];
  type: SectionType;
  colorTheme: string;
}

const SECTION_CONFIG: Record<SectionType, { icon: LucideIcon; colorTheme: string }> = {
  intro: { icon: BookOpen, colorTheme: 'from-blue-500/10 to-blue-600/5 border-blue-200 dark:border-blue-800' },
  sections: { icon: LayoutList, colorTheme: 'from-purple-500/10 to-purple-600/5 border-purple-200 dark:border-purple-800' },
  tips: { icon: Lightbulb, colorTheme: 'from-amber-500/10 to-amber-600/5 border-amber-200 dark:border-amber-800' },
  mistakes: { icon: AlertTriangle, colorTheme: 'from-red-500/10 to-red-600/5 border-red-200 dark:border-red-800' },
  example: { icon: FileText, colorTheme: 'from-green-500/10 to-green-600/5 border-green-200 dark:border-green-800' },
  why_korea: { icon: MapPin, colorTheme: 'from-teal-500/10 to-teal-600/5 border-teal-200 dark:border-teal-800' },
  career: { icon: Briefcase, colorTheme: 'from-indigo-500/10 to-indigo-600/5 border-indigo-200 dark:border-indigo-800' },
  general: { icon: GraduationCap, colorTheme: 'from-slate-500/10 to-slate-600/5 border-slate-200 dark:border-slate-800' },
};

function detectSectionType(title: string): SectionType {
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes('what is') || lowerTitle.includes('introduction') || lowerTitle.includes('overview')) {
    return 'intro';
  }
  if (lowerTitle.includes('section') || lowerTitle.includes('include') || lowerTitle.includes('structure') || lowerTitle.includes('key')) {
    return 'sections';
  }
  if (lowerTitle.includes('tip') || lowerTitle.includes('advice') || lowerTitle.includes('recommend')) {
    return 'tips';
  }
  if (lowerTitle.includes('mistake') || lowerTitle.includes('avoid') || lowerTitle.includes('don\'t') || lowerTitle.includes('common error')) {
    return 'mistakes';
  }
  if (lowerTitle.includes('example') || lowerTitle.includes('sample') || lowerTitle.includes('template')) {
    return 'example';
  }
  if (lowerTitle.includes('korea') || lowerTitle.includes('why') || lowerTitle.includes('motivation')) {
    return 'why_korea';
  }
  if (lowerTitle.includes('career') || lowerTitle.includes('goal') || lowerTitle.includes('future') || lowerTitle.includes('plan after')) {
    return 'career';
  }
  
  return 'general';
}

function cleanTitle(title: string): string {
  // Remove markdown formatting and numbering
  return title
    .replace(/^\*\*\d+\.\s*/, '') // Remove **1. 
    .replace(/\*\*$/g, '') // Remove trailing **
    .replace(/^\*\*/g, '') // Remove leading **
    .replace(/^#+\s*/, '') // Remove ### headers
    .replace(/^\d+\.\s*/, '') // Remove plain numbering like "1. "
    .replace(/:\s*$/, '') // Remove trailing colons
    .trim();
}

function parseContentLines(content: string): string[] {
  const lines = content.split('\n').filter(line => line.trim());
  return lines.map(line => {
    // Clean up bullet points but preserve them for display
    return line.trim();
  });
}

export function parseInstructions(text: string): InstructionSection[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const sections: InstructionSection[] = [];
  
  // Pattern to match section headers like:
  // **1. Section Title:**
  // ### Section Title
  // **Section Title**
  // 1. Section Title
  const sectionPattern = /(?:^|\n)(?:\*\*\d+\.\s*([^*\n]+?)\*\*:?|\*\*([^*\n]+?)\*\*:?|###\s*(.+?)\n|\d+\.\s*\*\*([^*\n]+?)\*\*:?)/g;
  
  const matches: { index: number; title: string }[] = [];
  let match;
  
  while ((match = sectionPattern.exec(text)) !== null) {
    const title = match[1] || match[2] || match[3] || match[4];
    if (title && title.trim().length > 0) {
      matches.push({ index: match.index, title: title.trim() });
    }
  }

  if (matches.length === 0) {
    // No sections found, return entire content as single section
    const lines = parseContentLines(text);
    if (lines.length > 0) {
      return [{
        id: 'content',
        title: 'Writing Guide',
        icon: SECTION_CONFIG.general.icon,
        content: lines,
        type: 'general',
        colorTheme: SECTION_CONFIG.general.colorTheme,
      }];
    }
    return [];
  }

  // Extract content for each section
  for (let i = 0; i < matches.length; i++) {
    const currentMatch = matches[i];
    const nextMatch = matches[i + 1];
    
    const startIndex = currentMatch.index;
    const endIndex = nextMatch ? nextMatch.index : text.length;
    
    const sectionText = text.slice(startIndex, endIndex);
    const cleanedTitle = cleanTitle(currentMatch.title);
    const type = detectSectionType(cleanedTitle);
    const config = SECTION_CONFIG[type];
    
    // Extract content after the header
    const headerPattern = /(?:\*\*\d+\.\s*[^*]+?\*\*:?|\*\*[^*]+?\*\*:?|###\s*.+?\n|\d+\.\s*\*\*[^*]+?\*\*:?)/;
    const headerMatch = sectionText.match(headerPattern);
    const contentStartIndex = headerMatch ? headerMatch[0].length : 0;
    const contentText = sectionText.slice(contentStartIndex).trim();
    
    const contentLines = parseContentLines(contentText);
    
    if (contentLines.length > 0 || cleanedTitle.length > 0) {
      sections.push({
        id: `section-${i}`,
        title: cleanedTitle,
        icon: config.icon,
        content: contentLines,
        type,
        colorTheme: config.colorTheme,
      });
    }
  }

  return sections;
}

export function formatBulletPoint(line: string): { type: 'bullet' | 'number' | 'text'; content: string; number?: number } {
  // Check for bullet points
  if (/^[-•*]\s+/.test(line)) {
    return { type: 'bullet', content: line.replace(/^[-•*]\s+/, '').trim() };
  }
  
  // Check for numbered lists
  const numberMatch = line.match(/^(\d+)[.)]\s+(.+)/);
  if (numberMatch) {
    return { type: 'number', content: numberMatch[2].trim(), number: parseInt(numberMatch[1], 10) };
  }
  
  // Check for sub-bullets (indented)
  if (/^\s+[-•*]\s+/.test(line)) {
    return { type: 'bullet', content: line.replace(/^\s+[-•*]\s+/, '  ').trim() };
  }
  
  return { type: 'text', content: line };
}
