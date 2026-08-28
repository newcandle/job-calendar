const Parser = {
    parse: function(rawText) {
        // HTML 소스코드가 붙여넣기 되었는지 감지
        const isHTML = rawText.trim().startsWith('<') && rawText.includes('<html') || rawText.includes('<body') || rawText.includes('<div');
        
        let platform, company, title, deadline, url = '';

        if (isHTML) {
            // HTML 파싱 (정확도 100%)
            const parser = new DOMParser();
            const doc = parser.parseFromString(rawText, 'text/html');
            
            const htmlResult = this.parseFromHTML(doc);
            platform = htmlResult.platform || this.detectPlatform(rawText);
            company = htmlResult.company;
            title = htmlResult.title;
            deadline = htmlResult.deadline;
            url = htmlResult.url;
        } else {
            // 일반 텍스트 파싱 (휴리스틱)
            platform = this.detectPlatform(rawText);
            company = this.extractCompany(rawText, platform);
            title = this.extractTitle(rawText, platform);
            deadline = this.extractDeadline(rawText);
        }

        return {
            platform: platform || '알 수 없음',
            company: company || '',
            title: title || '',
            deadline: deadline || '',
            url: url || ''
        };
    },

    parseFromHTML: function(doc) {
        let platform = '', company = '', title = '', deadline = '', url = '';

        // 1. URL 추출 (og:url 또는 canonical)
        const ogUrl = doc.querySelector('meta[property="og:url"]');
        const canonical = doc.querySelector('link[rel="canonical"]');
        if (ogUrl) url = ogUrl.content;
        else if (canonical) url = canonical.href;

        // 플랫폼 감지 (URL이나 타이틀 기준)
        const docTitle = doc.title || '';
        if (url.includes('jobkorea') || docTitle.includes('잡코리아')) platform = '잡코리아';
        else if (url.includes('saramin') || docTitle.includes('사람인')) platform = '사람인';
        else if (url.includes('linkareer') || docTitle.includes('링커리어')) platform = '링커리어';

        // 2. 타이틀 및 회사명 추출 (og:title 활용이 가장 범용적임)
        // 보통 "회사명 - 공고명 | 플랫폼" 형태를 띔
        const ogTitle = doc.querySelector('meta[property="og:title"]');
        let fullTitle = ogTitle ? ogTitle.content : docTitle;

        if (fullTitle) {
            fullTitle = fullTitle.replace(/&amp;/g, '&'); // HTML Entity 디코딩
            
            if (platform === '잡코리아') {
                // 패턴: "비즈라인 채용 - [신입경력] 풀스택... | 잡코리아"
                const match = fullTitle.match(/^(.*?) 채용\s*-\s*(.*?)\s*\|\s*잡코리아/);
                if (match) {
                    company = match[1].trim();
                    title = match[2].trim();
                }
            } 
            else if (platform === '사람인') {
                // 패턴: "[(주)와이지엔터테인먼트] [8월 수시채용] 홍보팀... (D-11) - 사람인"
                const match = fullTitle.match(/^\[(.*?)\]\s*(.*?)\s*(?:\(D-\d+\))?\s*-\s*사람인/);
                if (match) {
                    company = match[1].trim();
                    title = match[2].trim();
                }
            } 
            else if (platform === '링커리어') {
                // 패턴: "[넥슨컴퍼니] 2026 넥슨컴퍼니 채용형 인턴십... | 공모전 대외활동-링커리어"
                // 패턴2 (회사명 없음): "Associate Problem Solver... | 공모전 대외활동-링커리어"
                const match = fullTitle.match(/^(?:\[(.*?)\]\s*)?(.*?)\s*\|\s*공모전/);
                if (match) {
                    company = match[1] ? match[1].trim() : '';
                    title = match[2].trim();
                }
            }
            
            // 패턴 매칭 실패 시 기본 폴백
            if (!company && !title) {
                const parts = fullTitle.split(/\|| - /).map(p => p.trim());
                if (parts.length >= 2) {
                    company = parts[0].replace(/ 채용$/, '');
                    title = parts[1];
                } else {
                    title = fullTitle;
                }
            }
        }

        // 3. 마감일 추출 (HTML 내 텍스트 전체에서 정규식으로 뽑거나 특정 클래스 탐색)
        // 일단 HTML 전체 텍스트에서 안전하게 기존 정규식 재활용
        const bodyText = doc.body ? doc.body.innerText : '';
        deadline = this.extractDeadline(bodyText);

        return { platform, company, title, deadline, url };
    },

    detectPlatform: function(text) {
        if (text.includes('잡코리아') || text.includes('jobkorea')) return '잡코리아';
        if (text.includes('사람인') || text.includes('saramin')) return '사람인';
        if (text.includes('링커리어') || text.includes('linkareer')) return '링커리어';
        return '기타';
    },

    extractCompany: function(text, platform) {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        for (let line of lines) {
            if (line.includes('(주)') || line.includes('주식회사') || line.includes('Inc.') || line.includes('Corp.')) {
                return line.replace(/복사하기|공유하기|지원하기/g, '').trim();
            }
        }
        return lines.length > 0 ? lines[0] : '';
    },

    extractTitle: function(text, platform) {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        for (let line of lines) {
            if ((line.includes('채용') || line.includes('모집') || line.includes('엔지니어') || line.includes('개발자') || line.includes('신입') || line.includes('경력')) 
                && line.length > 5 && line.length < 50) {
                return line;
            }
        }
        return lines.length > 1 ? lines[1] : '';
    },

    extractDeadline: function(text) {
        const currentYear = new Date().getFullYear();

        const regex1 = /(\d{4})[\.\-\/년]\s*(\d{1,2})[\.\-\/월]\s*(\d{1,2})[일]?(?:\s*\(?\w\)?\s*)?(?:(\d{1,2})[:시]\s*(\d{1,2})[분]?)?/;
        const match1 = text.match(regex1);
        if (match1) {
            let year = match1[1], month = match1[2].padStart(2, '0'), day = match1[3].padStart(2, '0');
            let hour = match1[4] ? match1[4].padStart(2, '0') : '23', minute = match1[5] ? match1[5].padStart(2, '0') : '59';
            return `${year}-${month}-${day}T${hour}:${minute}`;
        }

        const regex2 = /(?:마감|~|까지).{0,5}?(\d{1,2})[\.\-\/월]\s*(\d{1,2})[일]?(?:\s*(\d{1,2})[:시]\s*(\d{1,2})[분]?)?/;
        const match2 = text.match(regex2);
        if (match2) {
            let month = match2[1].padStart(2, '0'), day = match2[2].padStart(2, '0');
            let hour = match2[3] ? match2[3].padStart(2, '0') : '23', minute = match2[4] ? match2[4].padStart(2, '0') : '59';
            return `${currentYear}-${month}-${day}T${hour}:${minute}`;
        }

        return '';
    }
};
