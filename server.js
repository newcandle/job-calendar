const express = require('express');
const cors = require('cors');
const path = require('path');
const { parseFromUrl, parseHtmlContent } = require('./server/parsers');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// 정적 파일 서빙 (프론트엔드 HTML, CSS, JS, DATA)
app.use(express.static(path.join(__dirname)));

// 헬스체크 API
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// URL 기반 공고 자동 파싱 API
app.post('/api/parse-url', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      message: '공고 URL(링크)을 입력해주세요.'
    });
  }

  try {
    const result = await parseFromUrl(url);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('URL 파싱 오류:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || '공고 데이터를 가져오거나 분석하는 중 오류가 발생했습니다.'
    });
  }
});

// 텍스트/HTML 직접 입력 파싱 API
app.post('/api/parse-text', (req, res) => {
  const { text, url } = req.body;

  if (!text) {
    return res.status(400).json({
      success: false,
      message: '분석할 텍스트 내용을 입력해주세요.'
    });
  }

  try {
    const result = parseHtmlContent(text, url || '');
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('텍스트 파싱 오류:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || '텍스트 분석 중 오류가 발생했습니다.'
    });
  }
});

// 서버 시작
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=============================================`);
    console.log(`🎯 취준 캘린더 서버가 실행되었습니다!`);
    console.log(`🌐 접속 주소: http://localhost:${PORT}`);
    console.log(`=============================================`);
  });
}

module.exports = app;
