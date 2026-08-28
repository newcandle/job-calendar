/**
 * 사람인 (Saramin) 채용 공고 파서
 */
function parseSaramin(html, url) {
  let company = '';
  let title = '';
  let deadline = '';

  // 1. Title / Company 추출 (og:title 또는 <title>)
  const ogTitleMatch = html.match(/property=["']og:title["']\s+content=["']([\s\S]*?)["']/i)
                    || html.match(/content=["']([\s\S]*?)["']\s+property=["']og:title["']/i)
                    || html.match(/<title>([\s\S]*?)<\/title>/i);

  if (ogTitleMatch) {
    // 줄바꿈 및 다중 공백 정리
    const rawTitle = ogTitleMatch[1].replace(/&amp;/g, '&').replace(/\r?\n\s*/g, ' ').trim();
    // 패턴: "[(주)회사명] [직무/공고명] ... (D-10) - 사람인"
    const match = rawTitle.match(/^\[(.*?)\]\s*(.*?)\s*(?:\(D-\d+\))?\s*-\s*사람인/);
    if (match) {
      company = match[1].trim();
      title = match[2].trim();
    } else {
      title = rawTitle.replace(/\s*-\s*사람인/g, '').trim();
    }
  }

  // Fallback: description에서 회사명 추출 ("회사명, 공고명, ...")
  if (!company) {
    const descMatch = html.match(/property=["']og:description["']\s+content=["']([\s\S]*?)["']/i)
                   || html.match(/name=["']description["']\s+content=["']([\s\S]*?)["']/i);
    if (descMatch) {
      const parts = descMatch[1].split(',').map(p => p.trim());
      if (parts.length >= 2) {
        company = parts[0];
        if (!title) title = parts[1];
      }
    }
  }

  // 2. Deadline (마감일) 추출
  // 사람인은 description에 "마감일:2026-09-07" 형태로 명시됨
  const descDeadlineMatch = html.match(/마감일\s*[:：]\s*(\d{4})[\.\-\/](\d{1,2})[\.\-\/](\d{1,2})/);
  if (descDeadlineMatch) {
    const year = descDeadlineMatch[1];
    const month = descDeadlineMatch[2].padStart(2, '0');
    const day = descDeadlineMatch[3].padStart(2, '0');
    deadline = `${year}-${month}-${day}T23:59`;
  } else {
    // 본문 내 마감일 날짜 패턴 매칭
    const bodyMatch = html.match(/(?:접수마감|마감일|마감).*?(\d{4})[\.\-\/년]\s*(\d{1,2})[\.\-\/월]\s*(\d{1,2})[일]?/);
    if (bodyMatch) {
      const year = bodyMatch[1];
      const month = bodyMatch[2].padStart(2, '0');
      const day = bodyMatch[3].padStart(2, '0');
      deadline = `${year}-${month}-${day}T23:59`;
    }
  }

  return {
    platform: '사람인',
    company: company || '',
    title: title || '',
    deadline: deadline || '',
    url: url || ''
  };
}

module.exports = parseSaramin;
