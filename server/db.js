const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const LOCAL_BACKUP_PATH = path.join(__dirname, '..', 'data', 'jobs_local.json');

// 로컬 백업 헬퍼 함수
function getLocalJobs() {
  try {
    if (fs.existsSync(LOCAL_BACKUP_PATH)) {
      return JSON.parse(fs.readFileSync(LOCAL_BACKUP_PATH, 'utf-8'));
    }
  } catch (e) {}
  return [];
}

function saveLocalJobs(jobs) {
  try {
    const dir = path.dirname(LOCAL_BACKUP_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOCAL_BACKUP_PATH, JSON.stringify(jobs, null, 2), 'utf-8');
  } catch (e) {}
}

const db = {
  isConfigured: () => Boolean(SUPABASE_URL && SUPABASE_KEY),

  /**
   * 모든 공고 목록 조회
   */
  async getAllJobs() {
    if (!this.isConfigured()) {
      return getLocalJobs();
    }

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/jobs?select=*&order=deadline.asc`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });

      if (!res.ok) {
        throw new Error(`Supabase 조회 실패 (${res.status})`);
      }

      const jobs = await res.json();
      saveLocalJobs(jobs); // 로컬 캐시 업데이트
      return jobs;
    } catch (err) {
      console.warn('⚠️ Supabase 연결 실패, 로컬 캐시 사용:', err.message);
      return getLocalJobs();
    }
  },

  /**
   * 새 공고 등록
   */
  async createJob(jobData) {
    const newJob = {
      platform: jobData.platform || '기타',
      company: jobData.company || '',
      title: jobData.title || '',
      deadline: jobData.deadline,
      url: jobData.url || '',
      status: jobData.status || '서류준비',
      memo: jobData.memo || ''
    };

    if (!this.isConfigured()) {
      const jobs = getLocalJobs();
      newJob.id = 'local_' + Date.now();
      newJob.created_at = new Date().toISOString();
      jobs.push(newJob);
      saveLocalJobs(jobs);
      return newJob;
    }

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/jobs`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(newJob)
      });

      if (!res.ok) {
        throw new Error(`Supabase 저장 실패 (${res.status})`);
      }

      const data = await res.json();
      return data[0];
    } catch (err) {
      console.error('Supabase 공고 등록 오류:', err.message);
      throw err;
    }
  },

  /**
   * 공고 삭제
   */
  async deleteJob(id) {
    if (!this.isConfigured() || String(id).startsWith('local_')) {
      let jobs = getLocalJobs();
      jobs = jobs.filter(j => j.id !== id);
      saveLocalJobs(jobs);
      return true;
    }

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${id}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });

      if (!res.ok) {
        throw new Error(`Supabase 삭제 실패 (${res.status})`);
      }

      return true;
    } catch (err) {
      console.error('Supabase 공고 삭제 오류:', err.message);
      throw err;
    }
  },

  /**
   * 공고 정보 업데이트 (상태, 메모 등)
   */
  async updateJob(id, updates) {
    if (!this.isConfigured() || String(id).startsWith('local_')) {
      let jobs = getLocalJobs();
      const idx = jobs.findIndex(j => j.id === id);
      if (idx !== -1) {
        jobs[idx] = { ...jobs[idx], ...updates };
        saveLocalJobs(jobs);
        return jobs[idx];
      }
      return null;
    }

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updates)
      });

      if (!res.ok) {
        throw new Error(`Supabase 수정 실패 (${res.status})`);
      }

      const data = await res.json();
      return data[0];
    } catch (err) {
      console.error('Supabase 공고 수정 오류:', err.message);
      throw err;
    }
  }
};

module.exports = db;
