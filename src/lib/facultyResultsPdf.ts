interface FacultyResult {
  universityName: string;
  universityNameKo?: string;
  tuitionPerSemester?: number;
  tuitionPerYear?: number;
  applicationDeadline?: string;
  documentDeadline?: string;
  languageTracks?: string[];
  topikRequirement?: number | string;
  ieltsRequirement?: number | string;
  toeflRequirement?: number | string;
  specialNotes?: string;
  confidence?: number;
  dataSource?: string;
  validationFlags?: string[];
  sourceUrl?: string;
  notes?: string;
  yearMismatch?: boolean;
}

interface SearchParams {
  faculty: string;
  programLevel: string;
  semester: string;
  year: number;
  languageTrack: string;
}

interface QualitySummary {
  totalFound: number;
  verifiedCount: number;
  reviewCount: number;
  unverifiedCount: number;
  averageConfidence: number;
  officialSourceCount: number;
  sourcesUsed: number;
}

export function generateFacultyResultsPdf(
  results: FacultyResult[],
  params: SearchParams,
  quality: QualitySummary
) {
  const now = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

  const tableRows = results.map(uni => {
    const tuition = uni.tuitionPerSemester
      ? `₩${Number(uni.tuitionPerSemester).toLocaleString()}/sem`
      : uni.tuitionPerYear
        ? `₩${Number(uni.tuitionPerYear).toLocaleString()}/yr`
        : uni.notes?.match(/tuition|등록금|수업료|fee.{0,10}schedule|학비/i)
          ? 'See notes'
          : '-';

    const tracks = uni.languageTracks?.join(', ') || '-';

    const reqs: string[] = [];
    if (uni.topikRequirement) reqs.push(`TOPIK: ${uni.topikRequirement}`);
    if (uni.ieltsRequirement) reqs.push(`IELTS: ${uni.ieltsRequirement}`);
    if (uni.toeflRequirement) reqs.push(`TOEFL: ${uni.toeflRequirement}`);

    const conf = uni.confidence != null ? `${Math.round(uni.confidence * 100)}%` : '-';
    const source = uni.dataSource || 'unknown';

    const flags = (uni.validationFlags || [])
      .map(f => `⚠ ${f.replace(/_/g, ' ')}`)
      .join(', ');

    const sourceLink = uni.sourceUrl
      ? `<a href="${esc(uni.sourceUrl)}" target="_blank">${(() => { try { return new URL(uni.sourceUrl).hostname; } catch { return 'Link'; } })()}</a>`
      : '-';

    const uniNameHtml = uni.sourceUrl
      ? `<a href="${esc(uni.sourceUrl)}" target="_blank">${esc(uni.universityName)}</a>`
      : `${esc(uni.universityName)}`;

    return `<tr${uni.yearMismatch ? ' class="year-mismatch"' : ''}>
      <td>
        <strong>${uniNameHtml}</strong>
        ${uni.universityNameKo ? `<br><small>${esc(uni.universityNameKo)}</small>` : ''}
      </td>
      <td>${esc(tuition)}</td>
      <td>${esc(uni.applicationDeadline || '-')}${uni.documentDeadline ? `<br><small>Docs: ${esc(uni.documentDeadline)}</small>` : ''}</td>
      <td>${esc(tracks)}</td>
      <td>${reqs.length ? reqs.map(r => esc(r)).join('<br>') : '-'}</td>
      <td>
        ${uni.specialNotes ? `<small>${esc(uni.specialNotes)}</small>` : '-'}
        ${flags ? `<br><small style="color:#c00">${esc(flags)}</small>` : ''}
      </td>
      <td>
        <strong>${conf}</strong>
        <br><small>${esc(source)}</small>
      </td>
      <td>${sourceLink}</td>
    </tr>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Faculty Comparison Report – ${esc(params.faculty)}</title>
<style>
  @page { size: landscape; margin: 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; color: #1a1a2e; line-height: 1.4; }
  .header { background: #1a3a6c; color: #fff; padding: 16px 20px; margin-bottom: 12px; }
  .header h1 { font-size: 18px; margin-bottom: 4px; }
  .header .meta { font-size: 11px; opacity: 0.85; }
  .summary { display: flex; gap: 12px; margin: 0 20px 12px; flex-wrap: wrap; }
  .summary .card { border: 1px solid #ddd; border-radius: 6px; padding: 8px 14px; text-align: center; min-width: 100px; }
  .summary .card .val { font-size: 16px; font-weight: 700; }
  .summary .card .lbl { font-size: 9px; color: #666; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; margin: 0 20px; max-width: calc(100% - 40px); font-size: 10px; }
  th { background: #f0f2f5; text-align: left; padding: 6px 8px; border-bottom: 2px solid #1a3a6c; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 6px 8px; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
  tr:nth-child(even) { background: #fafafa; }
  tr.year-mismatch { background: #fff0f0; }
  small { font-size: 9px; color: #666; }
  a { color: #1a3a6c; text-decoration: underline; }
  .footer { margin: 16px 20px 0; padding-top: 10px; border-top: 1px solid #ddd; font-size: 9px; color: #888; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none; }
    a[href]:after { content: " (" attr(href) ")"; font-size: 7px; color: #888; word-break: break-all; }
  }
</style>
</head>
<body>
  <div class="header">
    <h1>Faculty Comparison Report</h1>
    <div class="meta">
      Faculty: <strong>${esc(params.faculty)}</strong> &nbsp;|&nbsp;
      ${esc(params.programLevel)} &nbsp;|&nbsp;
      ${esc(params.semester)} ${params.year} &nbsp;|&nbsp;
      Track: ${esc(params.languageTrack)}
      <span style="float:right">Generated: ${now}</span>
    </div>
  </div>

  <div class="summary">
    <div class="card"><div class="val">${results.length}</div><div class="lbl">Universities</div></div>
    <div class="card"><div class="val">${quality.verifiedCount}</div><div class="lbl">Verified</div></div>
    <div class="card"><div class="val">${quality.reviewCount}</div><div class="lbl">Needs Review</div></div>
    <div class="card"><div class="val">${quality.unverifiedCount}</div><div class="lbl">Unverified</div></div>
    <div class="card"><div class="val">${Math.round(quality.averageConfidence * 100)}%</div><div class="lbl">Avg Confidence</div></div>
    <div class="card"><div class="val">${quality.officialSourceCount}/${quality.sourcesUsed}</div><div class="lbl">Official Sources</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>University</th>
        <th>Tuition</th>
        <th>Deadline</th>
        <th>Tracks</th>
        <th>Requirements</th>
        <th>Special Notes</th>
        <th>Confidence</th>
        <th>Source</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <div class="footer">
    <p>⚠ Data was auto-collected from university websites and public sources. Always verify with official university admissions pages before making decisions.</p>
    <p style="margin-top:4px">Hanguk Consulting – ${now}</p>
  </div>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow pop-ups to download the PDF report.');
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 400);
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
