const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first'); // CloudFront/일부 CDN IPv6 연결 지연 및 ECONNRESET 방지

const parseJobkorea = require('./jobkorea');
const parseSaramin = require('./saramin');
const parseLinkareer = require('./linkareer');

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
};

/**
 * URL 기반 플랫폼 감지
 */
function detectPlatformFromUrl(url) {
  if (!url) return '';
  const lower = url.toLowerCase();
  if (lower.includes('jobkorea.co.kr')) return '잡코리아';
  if (lower.includes('saramin.co.kr')) return '사람인';
  if (lower.includes('linkareer.com')) return '링커리어';
  return '';
}

/**
 * 텍스트 기반 플랫폼 감지
 */
function detectPlatformFromText(text) {
  if (!text) return '';
  if (text.includes('잡코리아') || text.includes('jobkorea')) return '잡코리아';
  if (text.includes('사람인') || text.includes('saramin')) return '사람인';
  if (text.includes('링커리어') || text.includes('linkareer')) return '링커리어';
  return '';
}

/**
 * URL에서 HTML 비동기 가져오기
 */
async function fetchHtml(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15초 타임아웃

  try {
    const response = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: controller.signal,
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`HTTP 요청 실패 (상태 코드: ${response.status})`);
    }

    const html = await response.text();
    return html;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * URL을 받아 스크래핑 및 파싱 수행
 */
async function parseFromUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('올바른 URL을 입력해주세요.');
  }

  const cleanUrl = url.trim();
  const platform = detectPlatformFromUrl(cleanUrl);

  if (!platform) {
    throw new Error('지원되지 않는 사이트입니다. (잡코리아, 사람인, 링커리어 링크만 지원됩니다)');
  }

  const html = await fetchHtml(cleanUrl);
  return parseHtmlContent(html, cleanUrl, platform);
}

/**
 * HTML 문자열과 플랫폼을 받아 적절한 파서 실행
 */
function parseHtmlContent(html, url = '', platform = '') {
  const targetPlatform = platform || detectPlatformFromUrl(url) || detectPlatformFromText(html);

  switch (targetPlatform) {
    case '잡코리아':
      return parseJobkorea(html, url);
    case '사람인':
      return parseSaramin(html, url);
    case '링커리어':
      return parseLinkareer(html, url);
    default:
      // 기본 폴백
      return {
        platform: '기타',
        company: '',
        title: '',
        deadline: '',
        url: url
      };
  }
}

module.exports = {
  detectPlatformFromUrl,
  detectPlatformFromText,
  fetchHtml,
  parseFromUrl,
  parseHtmlContent
};
