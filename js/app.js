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

    // 모달 DOM 요소
    const jobDetailModal = document.getElementById('job-detail-modal');
    const modalPlatformBadge = document.getElementById('modal-platform-badge');
    const modalDdayBadge = document.getElementById('modal-dday-badge');
    const modalCompany = document.getElementById('modal-company');
    const modalTitle = document.getElementById('modal-title');
    const modalDeadline = document.getElementById('modal-deadline');
    const modalUrlBtn = document.getElementById('modal-url-btn');
    const modalMemo = document.getElementById('modal-memo');
    const charCountWithSpace = document.getElementById('char-count-with-space');
    const charCountNoSpace = document.getElementById('char-count-no-space');
    const modalBtnClose = document.getElementById('modal-btn-close');
    const modalBtnCancel = document.getElementById('modal-btn-cancel');
    const modalBtnSave = document.getElementById('modal-btn-save');
    const modalBtnDelete = document.getElementById('modal-btn-delete');
    let currentModalJobId = null;

    // 전형 상태 메타데이터
    const STATUS_CONFIG = {
        '서류준비': { icon: '📝', badgeClass: 'badge-status-ready', text: '서류준비' },
        '지원완료': { icon: '📨', badgeClass: 'badge-status-applied', text: '지원완료' },
        '서류합격': { icon: '🎉', badgeClass: 'badge-status-doc-pass', text: '서류합격' },
        '면접진행': { icon: '🎤', badgeClass: 'badge-status-interview', text: '면접진행' },
        '최종합격': { icon: '🏆', badgeClass: 'badge-status-final-pass', text: '최종합격' },
        '불합격':   { icon: '💧', badgeClass: 'badge-status-fail', text: '불합격' }
    };

    let currentStatusFilter = 'all';

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
        const events = jobs.map(job => {
            const statusInfo = STATUS_CONFIG[job.status] || STATUS_CONFIG['서류준비'];
            return {
                id: job.id,
                title: `${statusInfo.icon} [${job.company}] ${job.title}`,
                start: job.deadline, // 마감일을 시작일(이벤트일)로 표시
                allDay: false,
                color: getPlatformColor(job.platform)
            };
        });

        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek'
            },
            events: events,
            eventClick: function(info) {
                info.jsEvent.preventDefault();
                openJobDetailModal(info.event.id);
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
            const statusInfo = STATUS_CONFIG[job.status] || STATUS_CONFIG['서류준비'];
            calendar.addEvent({
                id: job.id,
                title: `${statusInfo.icon} [${job.company}] ${job.title}`,
                start: job.deadline,
                allDay: false,
                color: getPlatformColor(job.platform)
            });
        });
        updateSummaryDashboard(jobs);
    }

    // --- 4. 파싱 기능 ---
    // 4-1. URL 자동 분석 기능 (백엔드 API 호출)
    if (btnParseUrl) {
        btnParseUrl.addEventListener('click', async () => {
            const url = autoUrlInput ? autoUrlInput.value.trim() : '';
            if (!url) {
                alert('공고 링크(URL)를 입력해주세요.');
                autoUrlInput.focus();
                return;
            }

            // UI 로딩 상태 표시
            btnParseUrl.disabled = true;
            btnParseUrlText.textContent = '⏳ 실시간 스크래핑 & AI 분석 중...';
            parseStatus.textContent = '분석 중...';
            parseStatus.className = 'px-2.5 py-0.5 text-xs font-black rounded-md bg-yellow-100 text-yellow-800 border border-yellow-300 animate-pulse';

            try {
                const response = await fetch('/api/parse-url', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: url })
                });

                const result = await response.json();

                if (result.success && result.data) {
                    const data = result.data;
                    parsedPlatform.value = data.platform || '기타';
                    parsedCompany.value = data.company || '';
                    parsedTitle.value = data.title || '';
                    parsedDeadline.value = data.deadline || '';
                    urlInput.value = data.url || url;

                    parseStatus.textContent = '분석 완료!';
                    parseStatus.className = 'px-2.5 py-0.5 text-xs font-black rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300';
                    validateForm();
                } else {
                    throw new Error(result.message || '공고 분석에 실패했습니다.');
                }
            } catch (error) {
                console.error('URL 파싱 실패:', error);
                alert('공고를 분석하지 못했습니다: ' + error.message);
                parseStatus.textContent = '분석 실패';
                parseStatus.className = 'px-2.5 py-0.5 text-xs font-black rounded-md bg-rose-100 text-rose-800 border border-rose-300';
            } finally {
                btnParseUrl.disabled = false;
                btnParseUrlText.textContent = '⚡ 링크 자동 분석하기';
            }
        });

        // 엔터키 지원
        if (autoUrlInput) {
            autoUrlInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    btnParseUrl.click();
                }
            });
        }
    }

    // 4-2. 수동 텍스트 파싱 기능
    btnParse.addEventListener('click', () => {
        const text = rawTextInput.value;
        if (!text.trim()) {
            alert('분석할 텍스트를 입력해주세요.');
            return;
        }

        parseStatus.textContent = '분석 중...';
        parseStatus.className = 'px-2.5 py-0.5 text-xs font-black rounded-md bg-yellow-100 text-yellow-800 border border-yellow-300';

        setTimeout(() => {
            const parsedData = Parser.parse(text);

            parsedPlatform.value = parsedData.platform;
            parsedCompany.value = parsedData.company;
            parsedTitle.value = parsedData.title;
            parsedDeadline.value = parsedData.deadline;

            if (parsedData.company || parsedData.title || parsedData.deadline) {
                parseStatus.textContent = '분석 완료!';
                parseStatus.className = 'px-2.5 py-0.5 text-xs font-black rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300';
            } else {
                parseStatus.textContent = '일부 정보 누락';
                parseStatus.className = 'px-2.5 py-0.5 text-xs font-black rounded-md bg-amber-100 text-amber-800 border border-amber-300';
            }

            validateForm();
        }, 100);
    });

    // 입력 폼 유효성 검사 (마감일 필수)
    [parsedCompany, parsedTitle, parsedDeadline].forEach(input => {
        input.addEventListener('input', validateForm);
    });

    function validateForm() {
        const hasDeadline = !!parsedDeadline.value;
        if (!hasDeadline) {
            deadlineError.classList.remove('hidden');
        } else {
            deadlineError.classList.add('hidden');
        }

        if (hasDeadline && (parsedCompany.value || parsedTitle.value)) {
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
            status: '서류준비',
            memo: '',
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
            btnSaveJob.textContent = '📅 캘린더 & DB에 저장하기';
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
        parseStatus.className = 'px-2.5 py-0.5 text-xs font-black rounded-md bg-zinc-100 text-zinc-500 border border-zinc-300';
        
        // 캘린더 뷰로 이동
        switchView('view-calendar');
    });

    // --- 6. 요약 대시보드 업데이트 ---
    function updateSummaryDashboard(jobs) {
        if (!Array.isArray(jobs)) jobs = Storage.getAllJobs();

        let todayCount = 0;
        let imminentCount = 0;
        let appliedCount = 0;
        let passCount = 0;

        let filterCounts = {
            all: jobs.length,
            '서류준비': 0,
            '지원완료': 0,
            '서류합격': 0,
            '면접진행': 0,
            '최종합격': 0,
            '불합격': 0
        };

        const now = new Date();

        jobs.forEach(job => {
            const status = job.status || '서류준비';
            if (filterCounts[status] !== undefined) filterCounts[status]++;
            if (status === '지원완료') appliedCount++;
            if (status === '서류합격' || status === '최종합격') passCount++;

            const date = new Date(job.deadline);
            if (!isNaN(date)) {
                const diffTime = date - now;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays === 0) todayCount++;
                if (diffDays > 0 && diffDays <= 3) imminentCount++;
            }
        });

        // 대시보드 숫자 업데이트
        const todayEl = document.getElementById('summary-today-count');
        const imminentEl = document.getElementById('summary-imminent-count');
        const appliedEl = document.getElementById('summary-applied-count');
        const passEl = document.getElementById('summary-pass-count');

        if (todayEl) todayEl.textContent = todayCount;
        if (imminentEl) imminentEl.textContent = imminentCount;
        if (appliedEl) appliedEl.textContent = appliedCount;
        if (passEl) passEl.textContent = passCount;

        // 리스트 필터 탭 숫자 업데이트
        const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setTxt('filter-all-count', filterCounts.all);
        setTxt('filter-ready-count', filterCounts['서류준비']);
        setTxt('filter-applied-count', filterCounts['지원완료']);
        setTxt('filter-docpass-count', filterCounts['서류합격']);
        setTxt('filter-interview-count', filterCounts['면접진행']);
        setTxt('filter-finalpass-count', filterCounts['최종합격']);
        setTxt('filter-fail-count', filterCounts['불합격']);
    }

    // 대시보드 카드 클릭 시 해당 조건으로 리스트 뷰 필터링
    document.querySelectorAll('.summary-card').forEach(card => {
        card.addEventListener('click', () => {
            const filter = card.dataset.summaryFilter;
            switchView('view-list');
            
            if (filter === '지원완료') {
                setListFilter('지원완료');
            } else if (filter === '합격') {
                setListFilter('서류합격');
            } else {
                setListFilter(filter);
            }
        });
    });

    // 리스트 상태 필터 버튼 클릭
    document.querySelectorAll('.status-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setListFilter(btn.dataset.statusFilter);
        });
    });

    function setListFilter(filter) {
        currentStatusFilter = filter;
        document.querySelectorAll('.status-filter-btn').forEach(btn => {
            if (btn.dataset.statusFilter === filter) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        renderJobList();
    }

    // --- 7. 리스트 뷰 렌더링 ---
    function renderJobList() {
        const allJobs = Storage.getAllJobs();
        const tbody = document.getElementById('job-list-body');
        const emptyMsg = document.getElementById('empty-list-msg');
        
        updateSummaryDashboard(allJobs);
        tbody.innerHTML = '';

        const now = new Date();

        // 필터링 적용
        let filteredJobs = allJobs.filter(job => {
            const status = job.status || '서류준비';
            if (currentStatusFilter === 'all') return true;
            if (currentStatusFilter === 'today') {
                const d = new Date(job.deadline);
                return !isNaN(d) && Math.ceil((d - now) / (1000 * 60 * 60 * 24)) === 0;
            }
            if (currentStatusFilter === 'imminent') {
                const d = new Date(job.deadline);
                const diff = !isNaN(d) ? Math.ceil((d - now) / (1000 * 60 * 60 * 24)) : -999;
                return diff > 0 && diff <= 3;
            }
            return status === currentStatusFilter;
        });
        
        if (filteredJobs.length === 0) {
            emptyMsg.classList.remove('hidden');
            return;
        }
        
        emptyMsg.classList.add('hidden');
        
        // 마감일 임박 순 정렬
        filteredJobs.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
        
        filteredJobs.forEach(job => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-amber-50/50 transition-colors';
            
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
            const currentStatus = job.status || '서류준비';

            // 상태 드롭다운 셀렉트
            let statusSelectOptions = Object.keys(STATUS_CONFIG).map(s => {
                const selected = s === currentStatus ? 'selected' : '';
                return `<option value="${s}" ${selected}>${STATUS_CONFIG[s].icon} ${s}</option>`;
            }).join('');

            const statusInfo = STATUS_CONFIG[currentStatus] || STATUS_CONFIG['서류준비'];

            // 메모 작성 여부 뱃지
            const hasMemo = (job.memo && job.memo.trim().length > 0);
            const memoBtnBadge = hasMemo 
                ? `<span class="w-2 h-2 rounded-full bg-emerald-500 inline-block mr-1"></span>` 
                : '';

            tr.innerHTML = `
                <td class="px-4 py-3.5 whitespace-nowrap text-sm font-extrabold text-zinc-900 flex items-center border-r border-zinc-100">
                    <span class="inline-block w-2.5 h-2.5 rounded-full mr-2 border border-zinc-900" style="background-color: ${getPlatformColor(job.platform)}"></span>
                    ${job.company}
                </td>
                <td class="px-4 py-3.5 text-sm font-bold text-zinc-700 max-w-xs truncate border-r border-zinc-100" title="${job.title}">
                    ${job.title}
                </td>
                <td class="px-3 py-3.5 whitespace-nowrap text-center border-r border-zinc-100">
                    <select class="job-status-select text-xs font-black px-2 py-1 rounded-md border-2 border-zinc-900 shadow-[1px_1px_0px_#000] cursor-pointer ${statusInfo.badgeClass}" data-id="${job.id}">
                        ${statusSelectOptions}
                    </select>
                </td>
                <td class="px-4 py-3.5 whitespace-nowrap text-xs font-bold text-zinc-600 border-r border-zinc-100">
                    <div class="flex items-center">
                        ${ddayHtml}
                        <span>${formattedDate}</span>
                    </div>
                </td>
                <td class="px-3 py-3.5 whitespace-nowrap text-center border-r border-zinc-100">
                    <button class="btn-open-detail px-2.5 py-1 bg-yellow-100 hover:bg-yellow-300 text-zinc-900 border border-zinc-900 text-xs font-black rounded-lg transition shadow-[1px_1px_0px_#000] cursor-pointer flex items-center justify-center mx-auto" data-id="${job.id}">
                        ${memoBtnBadge}<span>메모 & 상세</span>
                    </button>
                </td>
                <td class="px-3 py-3.5 whitespace-nowrap text-center text-sm font-medium">
                    <button class="btn-delete px-2.5 py-1 bg-rose-50 hover:bg-red-600 hover:text-white text-red-600 border border-red-300 hover:border-zinc-900 text-xs font-black rounded-lg transition shadow-xs cursor-pointer" data-id="${job.id}">삭제</button>
                </td>
            `;
            
            tbody.appendChild(tr);
        });

        // 상태 드롭다운 변경 이벤트
        document.querySelectorAll('.job-status-select').forEach(sel => {
            sel.addEventListener('change', async (e) => {
                const id = e.target.dataset.id;
                const newStatus = e.target.value;
                await Storage.updateJob(id, { status: newStatus });
                refreshCalendar();
                renderJobList();
            });
        });

        // 상세 & 메모 버튼 이벤트 바인딩
        document.querySelectorAll('.btn-open-detail').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                openJobDetailModal(id);
            });
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

    // --- 8. 공고 상세 및 메모 모달 컨트롤러 ---
    function openJobDetailModal(jobId) {
        const jobs = Storage.getAllJobs();
        const job = jobs.find(j => j.id === jobId);
        if (!job) return;

        currentModalJobId = jobId;

        // 기본 정보 채우기
        modalCompany.textContent = job.company;
        modalTitle.textContent = job.title;
        modalPlatformBadge.textContent = job.platform;
        modalPlatformBadge.style.borderColor = getPlatformColor(job.platform);

        // 마감일 및 D-Day 계산
        const dateObj = new Date(job.deadline);
        const formattedDate = !isNaN(dateObj) ? dateObj.toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit' }) : '미상';
        modalDeadline.textContent = formattedDate;

        if (!isNaN(dateObj)) {
            const diffDays = Math.ceil((dateObj - new Date()) / (1000 * 60 * 60 * 24));
            if (diffDays === 0) {
                modalDdayBadge.textContent = 'D-DAY 🔥';
                modalDdayBadge.className = 'px-2.5 py-0.5 bg-red-600 text-white rounded-md text-xs font-black shadow-[1px_1px_0px_#000]';
            } else if (diffDays > 0) {
                modalDdayBadge.textContent = `D-${diffDays}`;
                modalDdayBadge.className = 'px-2.5 py-0.5 bg-yellow-300 text-zinc-900 border border-zinc-900 rounded-md text-xs font-black shadow-[1px_1px_0px_#000]';
            } else {
                modalDdayBadge.textContent = '마감됨';
                modalDdayBadge.className = 'px-2.5 py-0.5 bg-zinc-200 text-zinc-600 rounded-md text-xs font-bold';
            }
        }

        // 공고 링크 버튼
        if (job.url) {
            modalUrlBtn.href = job.url;
            modalUrlBtn.classList.remove('hidden');
        } else {
            modalUrlBtn.classList.add('hidden');
        }

        // 전형 상태 라디오 체크
        const status = job.status || '서류준비';
        const radio = document.querySelector(`input[name="modal-status"][value="${status}"]`);
        if (radio) radio.checked = true;

        // 메모장 채우기 & 글자수 계산
        modalMemo.value = job.memo || '';
        updateCharCount(modalMemo.value);

        // 모달 열기
        jobDetailModal.classList.add('open');
    }

    function closeJobDetailModal() {
        jobDetailModal.classList.remove('open');
        currentModalJobId = null;
    }

    function updateCharCount(text) {
        if (!text) text = '';
        const withSpace = text.length;
        const noSpace = text.replace(/\s/g, '').length;
        charCountWithSpace.textContent = withSpace;
        charCountNoSpace.textContent = noSpace;
    }

    modalMemo.addEventListener('input', () => {
        updateCharCount(modalMemo.value);
    });

    modalBtnClose.addEventListener('click', closeJobDetailModal);
    modalBtnCancel.addEventListener('click', closeJobDetailModal);

    // 모달 배경 클릭 시 닫기
    jobDetailModal.addEventListener('click', (e) => {
        if (e.target === jobDetailModal) {
            closeJobDetailModal();
        }
    });

    // ESC 키로 닫기
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && jobDetailModal.classList.contains('open')) {
            closeJobDetailModal();
        }
    });

    // 모달 저장 버튼
    modalBtnSave.addEventListener('click', async () => {
        if (!currentModalJobId) return;

        const selectedStatusRadio = document.querySelector('input[name="modal-status"]:checked');
        const newStatus = selectedStatusRadio ? selectedStatusRadio.value : '서류준비';
        const newMemo = modalMemo.value;

        modalBtnSave.disabled = true;
        modalBtnSave.textContent = '저장 중...';

        try {
            await Storage.updateJob(currentModalJobId, {
                status: newStatus,
                memo: newMemo
            });

            closeJobDetailModal();
            refreshCalendar();
            renderJobList();
            alert('메모 및 전형 상태가 클라우드에 안전하게 저장되었습니다! 💾');
        } catch (err) {
            console.error('메모 저장 실패:', err);
            alert('저장에 실패했습니다.');
        } finally {
            modalBtnSave.disabled = false;
            modalBtnSave.textContent = '💾 메모 및 상태 저장';
        }
    });

    // 모달 내 삭제 버튼
    modalBtnDelete.addEventListener('click', async () => {
        if (!currentModalJobId) return;
        if (confirm('정말 이 공고를 삭제하시겠습니까?')) {
            await Storage.deleteJob(currentModalJobId);
            closeJobDetailModal();
            refreshCalendar();
            renderJobList();
        }
    });

    // --- 9. 설정 및 백업 기능 ---
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
                renderJobList();
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
    updateSummaryDashboard(Storage.getAllJobs());
    
    // Supabase 최신 데이터 비동기 동기화
    Storage.fetchJobs().then((jobs) => {
        refreshCalendar();
        updateSummaryDashboard(jobs);
        if (!document.getElementById('view-list').classList.contains('hidden')) {
            renderJobList();
        }
    });
    
});
