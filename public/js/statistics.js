/* public/js/statistics.js */

let statisticsManager;

document.addEventListener('DOMContentLoaded', () => {
    // checkUserLoggedIn('/index.html');
    statisticsManager = new StatisticsManager();
});

class StatisticsManager {
    constructor() {
        this.db = firebase.firestore();
        this.collection = this.db.collection('schedules');
        this.currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        this.usageChart = null;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.initDateSelector();
        await this.loadStatistics();
    }

    setupEventListeners() {
        document.getElementById('updateStatsBtn').addEventListener('click', () => this.loadStatistics());
        document.getElementById('refreshStatsBtn').addEventListener('click', () => this.loadStatistics());
        document.getElementById('topCount').addEventListener('change', () => this.renderTopCompanies());
    }

    initDateSelector() {
        const monthInput = document.getElementById('statsMonth');
        monthInput.value = this.currentMonth;
    }

    async loadStatistics() {
        try {
            this.currentMonth = document.getElementById('statsMonth').value;
            
            // 로딩 상태 표시
            this.showLoading();
            
            // 데이터 로드
            const schedules = await this.getSchedulesForMonth(this.currentMonth);
            
            // 현재 스케줄 저장 (다른 메서드에서 사용)
            this.currentSchedules = schedules;
            
            // 각 통계 계산 및 렌더링
            await this.renderUsageStats(schedules);
            await this.renderUsageChart(schedules);
            this.renderTopCompanies(schedules);
            this.renderLiveCommerceStats(schedules);
            this.renderSatisfactionStats(schedules);
            
        } catch (error) {
            console.error('통계 로드 실패:', error);
            alert('통계를 불러오는 중 오류가 발생했습니다.');
        }
    }

    async getSchedulesForMonth(month) {
        const [year, monthNum] = month.split('-');
        const startDate = `${year}-${monthNum}-01`;
        const endDate = `${year}-${monthNum}-${new Date(year, monthNum, 0).getDate()}`;
        
        const snapshot = await this.collection
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .get();
            
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    showLoading() {
        document.getElementById('usageTableBody').innerHTML = '<tr><td colspan="5" class="loading">데이터를 불러오는 중...</td></tr>';
        document.getElementById('topCompaniesList').innerHTML = '<div class="loading">데이터를 불러오는 중...</div>';
        document.getElementById('satisfactionGrid').innerHTML = '<div class="loading">데이터를 불러오는 중...</div>';
    }

    // 1. 스튜디오 이용 현황
    async renderUsageStats(schedules) {
        const [year, month] = this.currentMonth.split('-');
        const daysInMonth = new Date(year, month, 0).getDate();
        const businessDays = await this.getBusinessDays(year, parseInt(month));
        const holidays = await this.getHolidays(year, parseInt(month));
        
        // 운영기간 업데이트
        document.getElementById('operationPeriod').textContent = 
            `${year}.${month}.01 ~ ${year}.${month}.${daysInMonth.toString().padStart(2, '0')}`;

        const stats = {
            '라이브커머스': { operatingDays: businessDays, usageDays: 0, totalBookings: 0 },
            '일반': { operatingDays: businessDays, usageDays: 0, totalBookings: 0 },
            '스튜디오 메인': { operatingDays: businessDays, usageDays: 0, totalBookings: 0 },
            '스튜디오 소형': { operatingDays: businessDays, usageDays: 0, totalBookings: 0 },
            '스튜디오 키친': { operatingDays: businessDays, usageDays: 0, totalBookings: 0 },
            '총 이용률': { operatingDays: businessDays, usageDays: 0, totalBookings: 0 }
        };

        // 날짜별 이용 현황 계산
        const usedDates = {
            '라이브커머스': new Set(),
            '일반': new Set(),
            '스튜디오 메인': new Set(),
            '스튜디오 소형': new Set(),
            '스튜디오 키친': new Set(),
            '총 이용률': new Set()
        };

        schedules.forEach(schedule => {
            const date = schedule.date;
            const purpose = schedule.purpose || '일반';
            const studio = schedule.studio;
            
            // 공휴일 날짜 형식으로 변환 (YYYYMMDD)
            const dateStr = date.replace(/-/g, '');
            
            // 공휴일이면 통계에서 제외
            if (holidays.has(dateStr)) {
                return;
            }

            // 목적별 통계
            if (stats[purpose]) {
                usedDates[purpose].add(date);
                stats[purpose].totalBookings++;
            }

            // 스튜디오별 통계
            if (stats[studio]) {
                usedDates[studio].add(date);
                stats[studio].totalBookings++;
            }

            // 전체 통계
            usedDates['총 이용률'].add(date);
            stats['총 이용률'].totalBookings++;
        });

        // 이용일수 계산
        Object.keys(usedDates).forEach(key => {
            stats[key].usageDays = usedDates[key].size;
        });

        // 테이블 렌더링
        const tbody = document.getElementById('usageTableBody');
        tbody.innerHTML = Object.entries(stats).map(([category, data]) => {
            const usageRate = data.operatingDays > 0 ? 
                ((data.usageDays / data.operatingDays) * 100).toFixed(2) : '0.00';
            
            return `
                <tr>
                    <td class="category-col">${category}</td>
                    <td>${data.operatingDays}</td>
                    <td>${data.usageDays}</td>
                    <td class="usage-rate">${usageRate}%</td>
                    <td>${data.totalBookings}회</td>
                </tr>
            `;
        }).join('');
    }
    
    async getSchedulesForMonth(month) {
        const [year, monthNum] = month.split('-');
        const startDate = `${year}-${monthNum}-01`;
        const endDate = `${year}-${monthNum}-${new Date(year, monthNum, 0).getDate()}`;
        
        const snapshot = await this.collection
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .get();
            
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    showLoading() {
        document.getElementById('usageTableBody').innerHTML = '<tr><td colspan="5" class="loading">데이터를 불러오는 중...</td></tr>';
        document.getElementById('topCompaniesList').innerHTML = '<div class="loading">데이터를 불러오는 중...</div>';
        document.getElementById('satisfactionGrid').innerHTML = '<div class="loading">데이터를 불러오는 중...</div>';
    }



    async getBusinessDays(year, month) {
        try {
            // 공휴일 정보 가져오기
            const holidays = await this.getHolidays(year, month);
            
            const daysInMonth = new Date(year, month, 0).getDate();
            let businessDays = 0;
            
            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(year, month - 1, day);
                const dayOfWeek = date.getDay();
                const dateStr = `${year}${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}`;
                
                // 주말이 아니고 공휴일이 아닌 경우만 영업일로 계산
                if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.has(dateStr)) {
                    businessDays++;
                }
            }
            
            return businessDays;
        } catch (error) {
            console.error('영업일 계산 중 오류:', error);
            // API 오류 시 기본적으로 주말만 제외
            return this.getBasicBusinessDays(year, month);
        }
    }

    async getHolidays(year, month) {
        const holidays = new Set();
        
        try {
            const serviceKey = 'MfawTc1b6AR481DZak5cdqLzva6OO15ixLGQogH78sjWHDOXZ5Se1m9KZg7I3%2FBbHCVFZVaJvasn0sVjRJ5a%2BQ%3D%3D';
            const solYear = year;
            const solMonth = month.toString().padStart(2, '0');
            
            const url = `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?serviceKey=${serviceKey}&solYear=${solYear}&solMonth=${solMonth}&_type=json&numOfRows=50`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.response && data.response.body && data.response.body.items) {
                const items = Array.isArray(data.response.body.items.item) 
                    ? data.response.body.items.item 
                    : [data.response.body.items.item];
                
                items.forEach(item => {
                    if (item && item.locdate) {
                        holidays.add(item.locdate.toString());
                    }
                });
            }
        } catch (error) {
            // API 실패 시 주요 양력 공휴일만 하드코딩
            this.addBasicHolidays(holidays, year, month);
        }
        
        return holidays;
    }

    addBasicHolidays(holidays, year, month) {
        // 주요 양력 공휴일 하드코딩 (API 실패 시 대체용)
        const basicHolidays = {
            '01': ['01'], // 신정
            '03': ['01'], // 삼일절
            '05': ['05'], // 어린이날
            '06': ['06'], // 현충일
            '08': ['15'], // 광복절
            '10': ['03', '09'], // 개천절, 한글날
            '12': ['25']  // 크리스마스
        };
        
        const monthStr = month.toString().padStart(2, '0');
        if (basicHolidays[monthStr]) {
            basicHolidays[monthStr].forEach(day => {
                const dateStr = `${year}${monthStr}${day}`;
                holidays.add(dateStr);
            });
        }
    }

    getBasicBusinessDays(year, month) {
        // API 완전 실패 시 기본 평일 계산 (주말만 제외)
        const daysInMonth = new Date(year, month, 0).getDate();
        let businessDays = 0;
        
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month - 1, day);
            const dayOfWeek = date.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                businessDays++;
            }
        }
        
        return businessDays;
    }

    // 2. 이용률 비교 차트
    async renderUsageChart(schedules) {
        const ctx = document.getElementById('usageChart').getContext('2d');
        
        // 기존 차트 파괴
        if (this.usageChart) {
            this.usageChart.destroy();
        }

        // 월별 데이터 계산 (현재년도와 전년도)
        const currentYear = new Date().getFullYear();
        const monthlyData = await this.calculateMonthlyUsage(schedules, currentYear);
        
        this.usageChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
                datasets: [
                    {
                        label: `라이브커머스 ${currentYear}년도`,
                        data: monthlyData.liveCommerce,
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        borderWidth: 3,
                        fill: false,
                        tension: 0.4
                    },
                    {
                        label: `일반 ${currentYear}년도`,
                        data: monthlyData.general,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderWidth: 3,
                        fill: false,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '이용률 (%)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: '월'
                        }
                    }
                }
            }
        });
    }

    async calculateMonthlyUsage(schedules, year) {
        const monthlyData = {
            liveCommerce: Array(12).fill(0),
            general: Array(12).fill(0)
        };

        // 각 월별로 데이터 계산
        for (let month = 1; month <= 12; month++) {
            const monthStr = month.toString().padStart(2, '0');
            const monthSchedules = await this.getSchedulesForMonth(`${year}-${monthStr}`);
            
            const businessDays = await this.getBusinessDays(year, month);
            if (businessDays === 0) continue;

            const liveCommerceDays = new Set();
            const generalDays = new Set();

            monthSchedules.forEach(schedule => {
                const purpose = schedule.purpose || '일반';
                if (purpose === '라이브커머스') {
                    liveCommerceDays.add(schedule.date);
                } else {
                    generalDays.add(schedule.date);
                }
            });

            monthlyData.liveCommerce[month - 1] = ((liveCommerceDays.size / businessDays) * 100).toFixed(1);
            monthlyData.general[month - 1] = ((generalDays.size / businessDays) * 100).toFixed(1);
        }

        return monthlyData;
    }

    // 3. 주요 스튜디오 이용 업체
    renderTopCompanies(schedules) {
        // 인자 확인
        if (!schedules) {
            schedules = this.currentSchedules || [];
        }
        
        const companyStats = {};

        schedules.forEach(schedule => {
            const company = schedule.company;
            const purpose = schedule.purpose || '일반';
            
            if (!companyStats[company]) {
                companyStats[company] = { count: 0, purpose: purpose };
            }
            companyStats[company].count++;
        });

        // 정렬 및 상위 N개 추출
        const topCount = parseInt(document.getElementById('topCount').value);
        const sortedCompanies = Object.entries(companyStats)
            .sort(([,a], [,b]) => b.count - a.count)
            .slice(0, topCount);

        // 렌더링
        const container = document.getElementById('topCompaniesList');
        
        if (sortedCompanies.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #64748b; padding: 2rem;">해당 월에 이용 업체가 없습니다.</div>';
            return;
        }

        container.innerHTML = sortedCompanies.map(([company, data], index) => {
            let rank = index + 1;
            
            // 동점자 처리
            if (index > 0 && sortedCompanies[index - 1][1].count === data.count) {
                rank = ''; // 동점자는 순번 표시 안함
            }

            return `
                <div class="company-item">
                    <div class="company-rank">${rank}</div>
                    <div class="company-name">${company}</div>
                    <div class="company-purpose">${data.purpose}</div>
                    <div class="company-count">${data.count}회</div>
                </div>
            `;
        }).join('');
    }

    // 4. 라이브커머스 통계
    renderLiveCommerceStats(schedules) {
        const liveCommerceSchedules = schedules.filter(s => 
            s.purpose === '라이브커머스' && s.survey && s.survey.completed
        );

        let totalViewers = 0;
        let totalRevenue = 0;

        liveCommerceSchedules.forEach(schedule => {
            const survey = schedule.survey;
            totalViewers += survey.viewerCount || 0;
            totalRevenue += survey.revenue || 0;
        });

        const avgRevenue = totalViewers > 0 ? Math.round(totalRevenue / totalViewers) : 0;

        // 렌더링
        document.getElementById('totalViewers').innerHTML = 
            `${totalViewers.toLocaleString('ko-KR')}<span class="lc-stat-unit">명</span>`;
        document.getElementById('totalRevenue').innerHTML = 
            `${totalRevenue.toLocaleString('ko-KR')}<span class="lc-stat-unit">원</span>`;
        document.getElementById('avgRevenue').innerHTML = 
            `${avgRevenue.toLocaleString('ko-KR')}<span class="lc-stat-unit">원</span>`;
    }

    // 5. 만족도 조사 결과
    renderSatisfactionStats(schedules) {
        const surveyFields = [
            { key: 'facilityRating', name: '시설 만족도' },
            { key: 'staffKindness', name: '직원 친절도' },
            { key: 'equipmentExpertise', name: '장비 전문성' },
            { key: 'reservationSatisfaction', name: '예약 만족도' },
            { key: 'cleanliness', name: '청결 상태' },
            { key: 'equipmentSatisfaction', name: '비품 만족도' }
        ];

        const ratingScores = {
            '매우 만족': 5,
            '만족': 4,
            '보통': 3,
            '불만족': 2,
            '매우 불만족': 1
        };

        const container = document.getElementById('satisfactionGrid');
        
        const completedSurveys = schedules.filter(s => s.survey && s.survey.completed);
        
        if (completedSurveys.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #64748b; padding: 2rem; grid-column: 1 / -1;">완료된 설문조사가 없습니다.</div>';
            return;
        }

        container.innerHTML = surveyFields.map(field => {
            let totalScore = 0;
            let totalCount = 0;

            completedSurveys.forEach(schedule => {
                const rating = schedule.survey[field.key];
                if (rating && ratingScores[rating]) {
                    totalScore += ratingScores[rating];
                    totalCount++;
                }
            });

            const averageScore = totalCount > 0 ? (totalScore / totalCount).toFixed(1) : '0.0';

            return `
                <div class="satisfaction-item">
                    <div class="satisfaction-title">${field.name}</div>
                    <div class="satisfaction-score">${averageScore}</div>
                    <div class="satisfaction-total">총 ${totalCount}건 응답</div>
                </div>
            `;
        }).join('');
    }
}