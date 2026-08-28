document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. 상태 및 DOM 요소 초기화 ---
    let calendar;
    const views = document.querySelectorAll('.view-section');
    const navBtns = document.querySelectorAll('#sidebar-nav .nav-btn, .mobile-nav-btn, .btn-go-add');
    
    // 캘린더 요소
    const calendarEl = document.getElementById('calendar');
    
    // 파싱 및 폼 요소
    const autoUrlInput = document.getElementById('auto-url-input');
    const btnParseUrl = document.getElementById('btn-parse-url');
    const btnParseUrlText = document.getElementById('btn-parse-url-text');
    const rawTextInput = document.getElementById('raw-text-input');
    const urlInput = document.getElementById('url-input');
    const btnParse = document.getElementById('btn-parse');
    const parseStatus = document.getElementById('parse-status');
    const btnSaveJob = document.getElementById('btn-save-job');
    
    const parsedPlatform = document.getElementById('parsed-platform');
    const parsedCompany = document.getElementById('parsed-company');
    const parsedTitle = document.getElementById('parsed-title');
    const parsedDeadline = document.getElementById('parsed-deadline');
    const deadlineError = document.getElementById('deadline-error');

    // --- 2. 탭(뷰) 전환 로직 ---
    function switchView(targetId) {
        views.forEach(view => {
            if (view.id === targetId) {
                view.classList.remove('hidden');
            } else {
                view.classList.add('hidden');
            }
        });
        
        // 데스크톱 사이드바 활성화 갱신
        document.querySelectorAll('#sidebar-nav .nav-btn').forEach(btn => {
            if (btn.dataset.target === targetId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // 모바일 하단바 활성화 갱신
        document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
            if (btn.dataset.target === targetId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // 캘린더 탭으로 돌아왔을 때 렌더링 리프레시 (FullCalendar 크기 문제 방지)
        if (targetId === 'view-calendar' && calendar) {
            setTimeout(() => {
                calendar.render();
            }, 10);
        }
        
        // 리스트 탭일 경우 리스트 새로고침
        if (targetId === 'view-list') {
            renderJobList();
        }
    }

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.target) {
                switchView(btn.dataset.target);
            }
        });
    });

    // --- 3. 캘린더 초기화 ---
    function initCalendar() {
        const jobs = Storage.getAllJobs();
        const events = jobs.map(job => ({
            id: job.id,
            title: `[${job.platform}] ${job.company} - ${job.title}`,
            start: job.deadline, // 마감일을 시작일(이벤트일)로 표시
            allDay: false,
            url: job.url || '#',
            color: getPlatformColor(job.platform)
        }));

        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek'
            },
            events: events,
            eventClick: function(info) {
                if(info.event.url && info.event.url !== window.location.href + '#') {
                    window.open(info.event.url, '_blank');
                    info.jsEvent.preventDefault(); // 기본 링크 이동 방지
                }
            }
        });
        calendar.render();
    }

    function getPlatformColor(platform) {
        if (platform === '잡코리아') return '#3b82f6'; // blue
        if (platform === '사람인') return '#f97316'; // orange
        if (platform === '링커리어') return '#0ea5e9'; // sky
        return '#6b7280'; // gray
    }

    function refreshCalendar() {
        if (!calendar) return;
        const jobs = Storage.getAllJobs();
        calendar.removeAllEvents();
        jobs.forEach(job => {
            calendar.addEvent({
                id: job.id,
                title: `[${job.platform}] ${job.company}`,
                start: job.deadline,
                allDay: false,
                url: job.url || '#',
                color: getPlatformColor(job.platform)
            });
        });
    }

    // --- 4. 파싱 기능 ---
    // 4-1. URL 자동 분석 기능 (백엔드 API 호출)
    if (btnParseUrl) {
        btnParseUrl.addEventListener('click', async () => {
            const url = autoUrlInput ? autoUrlInput.value.trim() : '';
            if (!url) {
                alert('공고 링크(URL)를 입력해주세요.');
                autoUrlInput?.focus();
                return;
            }

            // 로딩 UI 상태 전환
            btnParseUrl.disabled = true;
            btnParseUrl.classList.add('opacity-75', 'cursor-not-allowed');
            if (btnParseUrlText) {
                btnParseUrlText.innerHTML = `
                    <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    공고 실시간 분석 중...
                `;
            }
            
            parseStatus.textContent = '서버에서 분석 중...';
            parseStatus.className = 'px-3 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 ml-2 animate-pulse';

            try {
                const response = await fetch('/api/parse-url', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url })
                });

                const resData = await response.json();

                if (!response.ok || !resData.success) {
                    throw new Error(resData.message || '공고 분석에 실패했습니다.');
                }

                const result = resData.data;
                parsedPlatform.value = result.platform || '';
                parsedCompany.value = result.company || '';
                parsedTitle.value = result.title || '';
                parsedDeadline.value = result.deadline || '';
                if (urlInput) urlInput.value = result.url || url;

                parseStatus.textContent = '분석 완료';
                parseStatus.className = 'px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-600 border border-green-200 ml-2';

                checkFormValidity();
            } catch (err) {
                console.error('URL 파싱 실패:', err);
                parseStatus.textContent = '분석 실패';
                parseStatus.className = 'px-3 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-600 border border-red-200 ml-2';
                alert('공고 링크 분석 중 오류가 발생했습니다:\n' + err.message);
            } finally {
                btnParseUrl.disabled = false;
                btnParseUrl.classList.remove('opacity-75', 'cursor-not-allowed');
                if (btnParseUrlText) btnParseUrlText.textContent = '⚡ 링크 자동 분석하기';
            }
        });

        // URL 입력창에서 Enter 키 누르면 바로 분석
        autoUrlInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                btnParseUrl.click();
            }
        });
    }

    // 4-2. 텍스트 직접 복사/붙여넣기 파싱 기능
    btnParse.addEventListener('click', () => {
        const text = rawTextInput.value.trim();
        if (!text) {
            alert('텍스트를 먼저 붙여넣어 주세요.');
            return;
        }

        parseStatus.textContent = '분석중...';
        parseStatus.className = 'px-3 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-600 border border-yellow-200 ml-2';

        setTimeout(() => {
            const result = Parser.parse(text);
            
            parsedPlatform.value = result.platform;
            parsedCompany.value = result.company;
            parsedTitle.value = result.title;
            parsedDeadline.value = result.deadline;
            
            // HTML 파싱 등으로 URL을 알아냈다면 URL 입력창도 자동 채움
            if (result.url) {
                urlInput.value = result.url;
            }
            
            parseStatus.textContent = '분석 완료';
            parseStatus.className = 'px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-600 border border-green-200 ml-2';
            
            checkFormValidity();
        }, 500); // UI 피드백을 위한 인위적 지연
    });

    parsedDeadline.addEventListener('change', checkFormValidity);
    parsedCompany.addEventListener('input', checkFormValidity);

    function checkFormValidity() {
        const hasDeadline = parsedDeadline.value !== '';
        const hasCompany = parsedCompany.value.trim() !== '';
        
        if (!hasDeadline) {
            deadlineError.classList.remove('hidden');
        } else {
            deadlineError.classList.add('hidden');
        }

        if (hasDeadline && hasCompany) {
            btnSaveJob.disabled = false;
        } else {
            btnSaveJob.disabled = true;
        }
    }

    // --- 5. 공고 저장 기능 ---
    btnSaveJob.addEventListener('click', async () => {
        const newJob = {
            platform: parsedPlatform.value,
            company: parsedCompany.value,
            title: parsedTitle.value,
            deadline: parsedDeadline.value,
            url: urlInput.value.trim(),
            rawText: rawTextInput.value // 원본 데이터도 백업 목적 저장
        };

        btnSaveJob.disabled = true;
        btnSaveJob.textContent = '저장 중...';

        try {
            await Storage.addJob(newJob);
            refreshCalendar();
            alert('캘린더 및 DB에 공고가 추가되었습니다!');
        } catch (e) {
            console.error('공고 저장 오류:', e);
            alert('공고 저장 중 오류가 발생했습니다.');
        } finally {
            btnSaveJob.textContent = '📅 캘린더에 저장하기';
        }
        
        // 입력 폼 초기화
        if (autoUrlInput) autoUrlInput.value = '';
        rawTextInput.value = '';
        urlInput.value = '';
        parsedPlatform.value = '';
        parsedCompany.value = '';
        parsedTitle.value = '';
        parsedDeadline.value = '';
        btnSaveJob.disabled = true;
        parseStatus.textContent = '대기중';
        parseStatus.className = 'px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-500 border border-gray-200 ml-2';
        
        // 캘린더 뷰로 이동
        switchView('view-calendar');
    });

    // --- 6. 리스트 뷰 렌더링 ---
    function renderJobList() {
        const jobs = Storage.getAllJobs();
        const tbody = document.getElementById('job-list-body');
        const emptyMsg = document.getElementById('empty-list-msg');
        
        tbody.innerHTML = '';
        
        if (jobs.length === 0) {
            emptyMsg.classList.remove('hidden');
            return;
        }
        
        emptyMsg.classList.add('hidden');
        
        // 마감일 임박 순 정렬
        jobs.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
        
        jobs.forEach(job => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-amber-50/50 transition-colors';
            
            const now = new Date();
            const dateObj = new Date(job.deadline);
            let ddayHtml = '';
            if (!isNaN(dateObj)) {
                const diffTime = dateObj - now;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays === 0) {
                    ddayHtml = `<span class="px-2 py-0.5 bg-red-600 text-white font-black text-[10px] rounded-md shadow-[1px_1px_0px_#000] mr-2">D-DAY 🔥</span>`;
                } else if (diffDays > 0) {
                    ddayHtml = `<span class="px-2 py-0.5 bg-yellow-300 text-zinc-900 font-black text-[10px] rounded-md border border-zinc-900 shadow-[1px_1px_0px_#000] mr-2">D-${diffDays}</span>`;
                } else {
                    ddayHtml = `<span class="px-2 py-0.5 bg-zinc-100 text-zinc-500 font-bold text-[10px] rounded-md mr-2">마감됨</span>`;
                }
            }

            const formattedDate = !isNaN(dateObj) ? dateObj.toLocaleString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute:'2-digit' }) : '미상';
            
            let urlHtml = job.url 
                ? `<a href="${job.url}" target="_blank" class="inline-flex items-center px-2.5 py-1 bg-white border border-zinc-900 text-zinc-900 hover:bg-yellow-300 text-xs font-bold rounded shadow-[1px_1px_0px_#000] transition">공고 이동 ↗</a>`
                : `<span class="text-zinc-400 text-xs">없음</span>`;

            tr.innerHTML = `
                <td class="px-5 py-4 whitespace-nowrap text-sm font-extrabold text-zinc-900 flex items-center border-r border-zinc-100">
                    <span class="inline-block w-2.5 h-2.5 rounded-full mr-2.5 border border-zinc-900" style="background-color: ${getPlatformColor(job.platform)}"></span>
                    ${job.company}
                </td>
                <td class="px-5 py-4 text-sm font-bold text-zinc-700 max-w-xs truncate border-r border-zinc-100" title="${job.title}">
                    ${job.title}
                </td>
                <td class="px-5 py-4 whitespace-nowrap text-xs font-bold text-zinc-600 border-r border-zinc-100">
                    <div class="flex items-center">
                        ${ddayHtml}
                        <span>${formattedDate}</span>
                    </div>
                </td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-center border-r border-zinc-100">
                    ${urlHtml}
                </td>
                <td class="px-4 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <button class="btn-delete px-2.5 py-1 bg-rose-50 hover:bg-red-600 hover:text-white text-red-600 border border-red-300 hover:border-zinc-900 text-xs font-black rounded-lg transition shadow-xs cursor-pointer" data-id="${job.id}">삭제</button>
                </td>
            `;
            
            tbody.appendChild(tr);
        });

        // 삭제 버튼 이벤트 바인딩
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                if (confirm('정말 이 공고를 삭제하시겠습니까?')) {
                    await Storage.deleteJob(id);
                    renderJobList();
                    refreshCalendar();
                }
            });
        });
    }

    // --- 7. 설정 및 백업 기능 ---
    document.getElementById('btn-export').addEventListener('click', () => {
        Storage.exportData();
    });

    document.getElementById('btn-import').addEventListener('click', () => {
        const fileInput = document.getElementById('file-import');
        if (fileInput.files.length === 0) {
            alert('불러올 JSON 파일을 선택해주세요.');
            return;
        }
        
        Storage.importData(fileInput.files[0], (success, msg) => {
            alert(msg);
            if (success) {
                fileInput.value = '';
                refreshCalendar();
            }
        });
    });

    document.getElementById('btn-clear').addEventListener('click', () => {
        if(confirm('정말 모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다!')) {
            Storage.clearAll();
            refreshCalendar();
            renderJobList();
            alert('모든 데이터가 삭제되었습니다.');
        }
    });

    // --- 초기 실행 ---
    initCalendar();
    // Supabase 최신 데이터 비동기 동기화
    Storage.fetchJobs().then(() => {
        refreshCalendar();
    });
    
});
