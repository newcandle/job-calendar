/**
 * 링커리어 (Linkareer) 채용/대외활동 공고 파서
 */
function parseLinkareer(html, url) {
  let company = '';
  let title = '';
  let deadline = '';

  // 1. JSON-LD (JobPosting 스키마) 우선 탐색 (가장 정확)
  const jsonLdMatches = html.match(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatches) {
    for (const scriptTag of jsonLdMatches) {
      try {
        const jsonContent = scriptTag.replace(/<\/?script[^>]*>/gi, '');
        const data = JSON.parse(jsonContent);
        if (data['@type'] === 'JobPosting') {
          // 회사명
          if (data.hiringOrganization) {
            company = typeof data.hiringOrganization === 'string' 
              ? data.hiringOrganization 
              : (data.hiringOrganization.name || '');
          }
          // 공고명
          if (data.title) {
            title = data.title;
          }
          // 마감일시 (ISO 8601 -> 한국 표준시 KST UTC+9 변환)
          if (data.validThrough) {
            const date = new Date(data.validThrough);
            if (!isNaN(date.getTime())) {
              const pad = n => String(n).padStart(2, '0');
              const kst = new Date(date.getTime() + (9 * 60 * 60 * 1000));
              deadline = `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}T${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}`;
            }
          }
        }
      } catch (e) {
        // JSON 파싱 실패 무시
      }
    }
  }

  // 2. Fallback: og:title 및 <title> 파싱
  const ogTitleMatch = html.match(/property=["']og:title["']\s+content=["'](.*?)["']/i)
                    || html.match(/<title>([\s\S]*?)<\/title>/i);

  if (ogTitleMatch) {
    const rawTitle = ogTitleMatch[1].replace(/&amp;/g, '&').trim();
    // 패턴: "[회사명] 공고명 (~9/7) | 공모전 대외활동-링커리어"
    const match = rawTitle.match(/^(?:\[(.*?)\]\s*)?(.*?)\s*(?:\(~.*?\))?\s*\|\s*공모전/);
    if (match) {
      if (!company && match[1]) company = match[1].trim();
      if (!title && match[2]) title = match[2].trim();
    } else if (!title) {
      title = rawTitle.replace(/\s*\|\s*공모전.*/g, '').trim();
    }

    // 마감일이 아직 없다면 제목의 (~M/D) 패턴에서 추출 시도
    if (!deadline) {
      const titleDateMatch = rawTitle.match(/\(~(\d{1,2})\/(\d{1,2})\)/);
      if (titleDateMatch) {
        const currentYear = new Date().getFullYear();
        const month = titleDateMatch[1].padStart(2, '0');
        const day = titleDateMatch[2].padStart(2, '0');
        deadline = `${currentYear}-${month}-${day}T23:59`;
      }
    }
  }

  // 3. Fallback: 본문 날짜 패턴
  if (!deadline) {
    const dateMatch = html.match(/(?:접수마감|마감일|마감).*?(\d{4})[\.\-\/년]\s*(\d{1,2})[\.\-\/월]\s*(\d{1,2})[일]?/);
    if (dateMatch) {
      const year = dateMatch[1];
      const month = dateMatch[2].padStart(2, '0');
      const day = dateMatch[3].padStart(2, '0');
      deadline = `${year}-${month}-${day}T23:59`;
    }
  }

  return {
    platform: '링커리어',
    company: company || '',
    title: title || '',
    deadline: deadline || '',
    url: url || ''
  };
}

module.exports = parseLinkareer;
