const STORAGE_KEY = 'job_calendar_data';

const Storage = {
    // 모든 데이터 불러오기
    getAllJobs: function() {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return [];
        try {
            return JSON.parse(data);
        } catch (e) {
            console.error("데이터 파싱 오류:", e);
            return [];
        }
    },

    // 새로운 공고 추가
    addJob: function(job) {
        const jobs = this.getAllJobs();
        job.id = Date.now().toString(); // 고유 ID 생성
        job.createdAt = new Date().toISOString();
        jobs.push(job);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
        return job;
    },

    // 공고 삭제
    deleteJob: function(id) {
        let jobs = this.getAllJobs();
        jobs = jobs.filter(job => job.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
    },

    // 전체 삭제
    clearAll: function() {
        localStorage.removeItem(STORAGE_KEY);
    },

    // 데이터 내보내기 (JSON 파일로 다운로드)
    exportData: function() {
        const jobs = this.getAllJobs();
        const dataStr = JSON.stringify(jobs, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `job_calendar_backup_${new Date().toISOString().slice(0,10)}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    },

    // 데이터 불러오기 (JSON 파일 읽어서 병합)
    importData: function(file, callback) {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedJobs = JSON.parse(event.target.result);
                if (Array.isArray(importedJobs)) {
                    let currentJobs = this.getAllJobs();
                    // ID 기준으로 중복 방지 (간단하게 구현)
                    const existingIds = new Set(currentJobs.map(j => j.id));
                    let addedCount = 0;
                    
                    importedJobs.forEach(job => {
                        if (!existingIds.has(job.id)) {
                            currentJobs.push(job);
                            addedCount++;
                        }
                    });
                    
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentJobs));
                    callback(true, `${addedCount}개의 데이터를 추가로 불러왔습니다.`);
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
