const http = require('http');
const app = require('../server');

let server;
const PORT = 3005;

async function runE2ETest() {
  server = app.listen(PORT, async () => {
    console.log(`Server listening on http://localhost:${PORT}`);
    
    try {
      // 1. Health check
      console.log('\n[1/3] Testing GET /api/health...');
      const healthRes = await fetch(`http://localhost:${PORT}/api/health`);
      const healthData = await healthRes.json();
      console.log('Health check response:', healthData);
      if (healthData.status !== 'ok') throw new Error('Health check failed');
      console.log('✅ Health check passed!');

      // 2. Static file serving (index.html)
      console.log('\n[2/3] Testing GET / (index.html)...');
      const indexRes = await fetch(`http://localhost:${PORT}/`);
      const indexHtml = await indexRes.text();
      if (!indexHtml.includes('취준 캘린더') || !indexHtml.includes('auto-url-input')) {
        throw new Error('index.html did not contain expected elements');
      }
      console.log('✅ Static file serving passed (found auto-url-input)!');

      // 3. POST /api/parse-url with sample URL
      console.log('\n[3/4] Testing POST /api/parse-url with JobKorea sample...');
      const testUrl = 'https://www.jobkorea.co.kr/Recruit/GI_Read/49771879?sc=729&traceId=b8466f9f52f34c88ffb7fb941532c929&sn=103';
      const parseRes = await fetch(`http://localhost:${PORT}/api/parse-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: testUrl })
      });
      const parseData = await parseRes.json();
      if (!parseData.success || parseData.data.company !== '일동제약') {
        throw new Error('API parse-url failed or company mismatch');
      }
      console.log('✅ API parse-url passed successfully!');

      // 4. Supabase DB CRUD tests
      console.log('\n[4/4] Testing Supabase DB CRUD APIs...');
      // 4-1. Create Job
      const createRes = await fetch(`http://localhost:${PORT}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: '잡코리아',
          company: '통합테스트기업',
          title: '풀스택 엔지니어',
          deadline: '2026-09-30T23:59',
          url: 'https://test.com'
        })
      });
      const createData = await createRes.json();
      if (!createData.success || !createData.data.id) {
        throw new Error('Supabase job creation failed: ' + JSON.stringify(createData));
      }
      const createdId = createData.data.id;
      console.log(`   - 공고 생성 성공 (ID: ${createdId})`);

      // 4-2. Read Jobs
      const listRes = await fetch(`http://localhost:${PORT}/api/jobs`);
      const listData = await listRes.json();
      if (!listData.success || !listData.data.some(j => j.id === createdId)) {
        throw new Error('Supabase job list verification failed');
      }
      console.log(`   - 공고 목록 조회 성공 (총 ${listData.data.length}개)`);

      // 4-3. Delete Job
      const delRes = await fetch(`http://localhost:${PORT}/api/jobs/${createdId}`, {
        method: 'DELETE'
      });
      const delData = await delRes.json();
      if (!delData.success) {
        throw new Error('Supabase job deletion failed');
      }
      console.log(`   - 공고 삭제 성공 (ID: ${createdId})`);
      console.log('✅ Supabase DB CRUD APIs passed successfully!');

      console.log('\n🎉 ALL E2E AND SUPABASE TESTS PASSED SUCCESSFULLY!\n');
      process.exit(0);
    } catch (err) {
      console.error('❌ E2E Test Error:', err);
      process.exit(1);
    } finally {
      server.close();
    }
  });
}

runE2ETest();
