# 🎯 취준 캘린더 (Job Calendar)

> **채용 공고 링크(URL)만 넣으면 1초 만에 마감일과 기업 정보를 캘린더로 자동 등록해 주는 취준생 맞춤형 일정 관리 웹 서비스**

![Node.js](https://img.shields.io/badge/Node.js-24-green)
![Express](https://img.shields.io/badge/Express-4.19-lightgrey)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v3-blue)
![FullCalendar](https://img.shields.io/badge/FullCalendar-v6-orange)

---

## ✨ 핵심 기능

1. **⚡ 공고 링크(URL) 원클릭 자동 분석**
   - **잡코리아**, **사람인**, **링커리어** 공고 링크를 입력하면 백엔드 스크래퍼가 1초 이내에 자동 분석
   - 회사명, 직무/공고명, 서류 마감일시(한국 표준시 KST) 정밀 추출
2. **📅 인터랙티브 취업 캘린더**
   - FullCalendar 기반 월간/주간 마감 일정 시각화
   - 플랫폼별 고유 컬러 태그 적용 (잡코리아: 파랑, 사람인: 주황, 링커리어: 하늘)
   - 캘린더 일정 클릭 시 원본 채용 공고로 바로 연결
3. **📋 지원 공고 리스트 관리**
   - 마감일 임박순 자동 정렬 테이블
   - 개별 삭제 및 지원 링크 바로가기
4. **💾 데이터 백업 및 복원**
   - JSON 파일 형태의 Export/Import 기능 지원 (중복 방지 병합 포함)
5. **📝 텍스트 직접 복사 붙여넣기 지원 (보조 파서)**
   - 비공개 공고나 로그인 페이지 내용도 `Ctrl+A, Ctrl+C` 후 붙여넣기로 분석 가능

---

## 🛠️ 기술 스택

- **Backend**: Node.js, Express.js
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, Tailwind CSS
- **Library**: FullCalendar v6.1.15
- **Testing**: Node.js Native Test Suite (Live URLs & 15 Fixtures)

---

## 🚀 빠른 시작 가이드 (Local Run)

### 1. 저장소 클론 및 패키지 설치
```bash
git clone https://github.com/newcandle/job-calendar.git
cd job-calendar
npm install
```

### 2. 서버 실행
```bash
npm start
```
브라우저에서 `http://localhost:3000`에 접속합니다.

### 3. 테스트 실행
```bash
npm test
```
라이브 공고 3종 및 15개 샘플 데이터 검증이 자동 수행됩니다.

---

## 📁 프로젝트 구조

```
취준캘린더/
├── server.js              # Express 백엔드 서버 (API + 정적 파일 서빙)
├── server/
│   └── parsers/           # 사이트별 전용 스크래핑/파서 엔진
│       ├── index.js       # 파서 라우터 & HTTP 요청 핸들러
│       ├── jobkorea.js    # 잡코리아 전용 파서
│       ├── saramin.js     # 사람인 전용 파서
│       └── linkareer.js   # 링커리어 전용 파서
├── index.html             # 메인 SPA 화면
├── css/                   # 스타일시트
├── js/
│   ├── app.js             # 프론트엔드 UI 컨트롤러 & 캘린더 로직
│   ├── parser.js          # 클라이언트 사이드 텍스트 파서 (보조)
│   └── storage.js         # 로컬 스토리지 & 백업/복원 매니저
├── data/                  # 3대 플랫폼 공고 샘플 데이터 15건
├── test/                  # 자동화 테스트 스위트
└── package.json
```
