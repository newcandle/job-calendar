/**
 * 잡코리아 (JobKorea) 채용 공고 파서
 */
function parseJobkorea(html, url) {
  let company = '';
  let title = '';
  let deadline = '';

  // 1. Title / Company 추출 (og:title 또는 <title>)
  const ogTitleMatch = html.match(/property=["']og:title["']\s+content=["'](.*?)["']/i) 
                    || html.match(/content=["'](.*?)["']\s+property=["']og:title["']/i)
                    || html.match(/<title>([\s\S]*?)<\/title>/i);

  if (ogTitleMatch) {
    const rawTitle = ogTitleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    // 패턴: "회사명 채용 - [직무/공고명] ... | 잡코리아"
    const match = rawTitle.match(/^(.*?)\s*채용\s*-\s*(.*?)\s*\|\s*잡코리아/);
    if (match) {
      company = match[1].trim();
      title = match[2].trim();
    } else {
      title = rawTitle.replace(/\s*\|\s*잡코리아/g, '').trim();
    }
  }

  // Fallback: meta writer
  if (!company) {
    const writerMatch = html.match(/<meta\s+name=["']writer["']\s+content=["'](.*?)["']/i);
    if (writerMatch) company = writerMatch[1].trim();
  }

  // 2. Deadline (마감일) 추출
  // 우선순위 1: JobPosting JSON-LD validThrough
  const validThroughMatch = html.match(/"validThrough":\s*"([^"]+)"/);
  if (validThroughMatch) {
    deadline = validThroughMatch[1].slice(0, 16); // "YYYY-MM-DDTHH:mm"
  } else {
    // 우선순위 2: meta description 내 "마감일 : YYYY.MM.DD"
    const descMatch = html.match(/마감일\s*:\s*(\d{4})[\.\-\/](\d{1,2})[\.\-\/](\d{1,2})/);
    if (descMatch) {
      const year = descMatch[1];
      const month = descMatch[2].padStart(2, '0');
      const day = descMatch[3].padStart(2, '0');
      deadline = `${year}-${month}-${day}T23:59`;
    } else {
      // 우선순위 3: 본문 날짜 패턴 탐색
      const bodyDateMatch = html.match(/(?:접수마감|마감일|마감).*?(\d{4})[\.\-\/년]\s*(\d{1,2})[\.\-\/월]\s*(\d{1,2})[일]?/);
      if (bodyDateMatch) {
        const year = bodyDateMatch[1];
        const month = bodyDateMatch[2].padStart(2, '0');
        const day = bodyDateMatch[3].padStart(2, '0');
        deadline = `${year}-${month}-${day}T23:59`;
      }
    }
  }

  return {
    platform: '잡코리아',
    company: company || '',
    title: title || '',
    deadline: deadline || '',
    url: url || ''
  };
}

module.exports = parseJobkorea;
