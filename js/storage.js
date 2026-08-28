const STORAGE_KEY = 'job_calendar_data';

const Storage = {
    _cachedJobs: null,

    // 로컬 스토리지 데이터 불러오기 (캐시용)
    _getLocal: function() {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return [];
        try {
            return JSON.parse(data);
        } catch (e) {
            return [];
        }
    },

    _setLocal: function(jobs) {
        this._cachedJobs = jobs;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
    },

    // 동기식 조회 (즉시 렌더링용)
    getAllJobs: function() {
        if (this._cachedJobs !== null) return this._cachedJobs;
        this._cachedJobs = this._getLocal();
        return this._cachedJobs;
    },

    // 비동기 서버/Supabase 동기화 조회
    fetchJobs: async function() {
        try {
            const res = await fetch('/api/jobs');
            if (res.ok) {
                const json = await res.json();
                if (json.success && Array.isArray(json.data)) {
                    this._setLocal(json.data);
                    return json.data;
                }
            }
        } catch (err) {
            console.warn('⚠️ 서버/DB 연결 실패, 로컬 캐시를 사용합니다:', err);
        }
        return this.getAllJobs();
    },

    // 새로운 공고 추가
    addJob: async function(job) {
        // 1. 서버/Supabase에 저장 시도
        try {
            const res = await fetch('/api/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(job)
            });

            if (res.ok) {
                const json = await res.json();
                if (json.success && json.data) {
                    const saved = json.data;
                    const jobs = this.getAllJobs().filter(j => j.id !== saved.id);
                    jobs.push(saved);
                    this._setLocal(jobs);
                    return saved;
                }
            }
        } catch (err) {
            console.warn('⚠️ 서버 저장 실패, 로컬에 저장합니다:', err);
        }

        // 2. 오프라인 폴백 로컬 저장
        const jobs = this.getAllJobs();
        job.id = 'local_' + Date.now();
        job.created_at = new Date().toISOString();
        jobs.push(job);
        this._setLocal(jobs);
        return job;
    },

    // 공고 삭제
    deleteJob: async function(id) {
        try {
            await fetch(`/api/jobs/${id}`, { method: 'DELETE' });
        } catch (err) {
            console.warn('⚠️ 서버 삭제 요청 실패:', err);
        }
        let jobs = this.getAllJobs().filter(job => job.id !== id);
        this._setLocal(jobs);
    },

    // 공고 수정
    updateJob: async function(id, updates) {
        try {
            const res = await fetch(`/api/jobs/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            if (res.ok) {
                const json = await res.json();
                if (json.success && json.data) {
                    let jobs = this.getAllJobs().map(j => j.id === id ? json.data : j);
                    this._setLocal(jobs);
                    return json.data;
                }
            }
        } catch (err) {
            console.warn('⚠️ 서버 수정 실패:', err);
        }
        let jobs = this.getAllJobs().map(j => j.id === id ? { ...j, ...updates } : j);
        this._setLocal(jobs);
        return jobs.find(j => j.id === id);
    },

    // 전체 삭제
    clearAll: function() {
        this._cachedJobs = [];
        localStorage.removeItem(STORAGE_KEY);
    },

    // 데이터 내보내기 (JSON 파일로 다운로드)
    exportData: function() {
        const jobs = this.getAllJobs();
        const dataStr = JSON.stringify(jobs, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const exportFileDefaultName = `job_calendar_backup_${new Date().toISOString().slice(0, 10)}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    },

    // 데이터 불러오기 (JSON 파일 읽어서 병합)
    importData: async function(file, callback) {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const importedJobs = JSON.parse(event.target.result);
                if (Array.isArray(importedJobs)) {
                    let addedCount = 0;
                    for (const job of importedJobs) {
                        delete job.id; // 신규 ID 발급
                        await this.addJob(job);
                        addedCount++;
                    }
                    callback(true, `${addedCount}개의 데이터를 Supabase에 복구 완료했습니다.`);
                } else {
                    callback(false, "올바른 백업 파일 형식이 아닙니다.");
                }
            } catch (e) {
                callback(false, "파일을 읽는 중 오류가 발생했습니다.");
            }
        };
        reader.readAsText(file);
    }
};
