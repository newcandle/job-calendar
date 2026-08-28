const fs = require('fs');
const path = require('path');
const { parseFromUrl, parseHtmlContent } = require('../server/parsers');

const SAMPLE_URLS = [
  {
    name: '잡코리아 라이브 공고',
    url: 'https://www.jobkorea.co.kr/Recruit/GI_Read/49771879?sc=729&traceId=b8466f9f52f34c88ffb7fb941532c929&sn=103',
    expectedPlatform: '잡코리아'
  },
  {
    name: '링커리어 라이브 공고',
    url: 'https://linkareer.com/activity/344804',
    expectedPlatform: '링커리어'
  },
  {
    name: '사람인 라이브 공고',
    url: 'https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=54828914&t_ref=public-home&t_ref_content=popular&view_type=public-recruit#seq=0',
    expectedPlatform: '사람인'
  }
];

async function runTests() {
  console.log('====================================================');
  console.log('🚀 [1단계] 사용자 제공 3개 라이브 URL 테스트 시작');
  console.log('====================================================');

  let livePassed = 0;
  for (const sample of SAMPLE_URLS) {
    try {
      console.log(`\n🔍 테스트 중: ${sample.name}`);
      console.log(`   URL: ${sample.url}`);
      
      const start = Date.now();
      const result = await parseFromUrl(sample.url);
      const elapsed = Date.now() - start;

      console.log(`   ⏱️ 소요 시간: ${elapsed}ms`);
      console.log(`   🏢 플랫폼: ${result.platform}`);
      console.log(`   🏷️ 회사명: ${result.company}`);
      console.log(`   📋 공고명: ${result.title}`);
      console.log(`   📅 마감일: ${result.deadline}`);

      if (!result.company || !result.title || !result.deadline) {
        throw new Error('필수 정보 누락 (회사명, 공고명 또는 마감일)');
      }
      if (result.platform !== sample.expectedPlatform) {
        throw new Error(`플랫폼 불일치: 예상=${sample.expectedPlatform}, 실제=${result.platform}`);
      }

      console.log(`   ✅ 성공!`);
      livePassed++;
    } catch (err) {
      console.error(`   ❌ 실패: ${err.message}`);
    }
  }

  console.log('\n====================================================');
  console.log('📁 [2단계] data/ 폴더 내 15개 파일 배치 검증 시작');
  console.log('====================================================');

  const dataDir = path.join(__dirname, '..', 'data');
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.txt')).sort();

  let filePassed = 0;
  for (const file of files) {
    const filePath = path.join(dataDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const result = parseHtmlContent(content, '', '');

    const isValid = result.company && result.title && result.deadline;
    const icon = isValid ? '✅' : '❌';
    console.log(`${icon} [${file}] ${result.platform} | ${result.company} | ${result.title.slice(0, 25)}... | ${result.deadline}`);

    if (isValid) {
      filePassed++;
    } else {
      console.warn(`   ⚠️ 누락 상세: 회사="${result.company}", 제목="${result.title}", 마감일="${result.deadline}"`);
    }
  }

  console.log('\n====================================================');
  console.log(`📊 테스트 요약`);
  console.log(` - 라이브 URL 테스트: ${livePassed} / ${SAMPLE_URLS.length} 통과`);
  console.log(` - data 샘플 파일 테스트: ${filePassed} / ${files.length} 통과`);
  console.log('====================================================');

  if (livePassed === SAMPLE_URLS.length && filePassed === files.length) {
    console.log('🎉 모든 테스트를 성공적으로 통과했습니다!');
    process.exit(0);
  } else {
    console.error('⚠️ 일부 테스트가 통과하지 못했습니다.');
    process.exit(1);
  }
}

runTests();
