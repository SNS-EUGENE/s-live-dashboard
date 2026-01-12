/* public/js/main.js */
document.addEventListener('DOMContentLoaded', function() {
    checkUserLoggedIn('/index.html'); 
    loadScheduleData();

    // 원본 파일과 동일하게 버튼에 이벤트 리스너 추가
    const refreshBtn = document.getElementById('refreshBtn');
    if(refreshBtn) refreshBtn.addEventListener('click', refreshData);
    
    document.getElementById('prevMonth').addEventListener('click', () => changeMonth(-1));
    document.getElementById('nextMonth').addEventListener('click', () => changeMonth(1));

    setInterval(() => {
        console.log('자동 새로고침 (메인)...');
        loadScheduleData();
    }, 1 * 60 * 1000);
});

let scheduleData = null;
let currentYear, currentMonth;
let selectedDate = null;

async function loadScheduleData() {
    try {
        const snapshot = await db.collection('schedules').get();
        scheduleData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const today = getTodayKST();
        if (!selectedDate) {
            selectedDate = today;
        }
        const kstDate = new Date(selectedDate);
        
        generateCalendar(kstDate.getFullYear(), kstDate.getMonth(), selectedDate);
        renderScheduleByDate(selectedDate);
        
    } catch (error) {
        console.error('스케줄 데이터 로드 실패:', error);
        document.getElementById('scheduleContent').innerHTML = `<div class="error">데이터 로드 실패</div>`;
        document.querySelector('#calendarTable tbody').innerHTML = `<tr><td colspan="5" class="error">캘린더 로드 실패</td></tr>`;
    }
}

function getTodayKST() {
    const now = new Date();
    const kstOffset = now.getTime() + 9 * 60 * 60 * 1000;
    const kst = new Date(kstOffset);
    return kst.toISOString().split('T')[0];
}

function calculateRemainingTime(dateStr, studioName) {
    if (!scheduleData) return 12;
    const daySchedules = scheduleData.filter(s => s.date === dateStr && s.studio === studioName);
    return 12 - daySchedules.reduce((sum, s) => sum + (parseInt(s.end) - parseInt(s.start)), 0);
}

function generateCalendar(year, month, activeDateStr = null) {
    currentYear = year;
    currentMonth = month;
    const todayStr = getTodayKST();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startDayOfWeek = firstDayOfMonth.getDay();
    let calendarStart = new Date(firstDayOfMonth);
    if (startDayOfWeek >= 1 && startDayOfWeek <= 5) {
        calendarStart.setDate(calendarStart.getDate() - (startDayOfWeek - 1));
    }

    const endDayOfWeek = lastDayOfMonth.getDay();
    let calendarEnd = new Date(lastDayOfMonth);
    if (endDayOfWeek >= 1 && endDayOfWeek <= 5) {
        calendarEnd.setDate(calendarEnd.getDate() + (5 - endDayOfWeek));
    }

    const tbody = document.querySelector('#calendarTable tbody');
    tbody.innerHTML = "";
    let tr = document.createElement("tr");
    let weekDayCount = 0;

    for (let d = new Date(calendarStart); d <= calendarEnd; d.setDate(d.getDate() + 1)) {
        const day = d.getDay();
        if (day === 0 || day === 6) continue;
        
        // ▼▼▼ [수정] KST 보정 로직 복원 ▼▼▼
        const localDate = new Date(d.getTime() + 9 * 60 * 60 * 1000);
        const dateStr = localDate.toISOString().split('T')[0];
        // ▲▲▲ [수정] KST 보정 로직 복원 ▲▲▲

        const td = document.createElement("td");
        td.setAttribute("data-date", dateStr);
        if (d.getMonth() !== currentMonth) {
            td.classList.add("other-month");
        }
        
        const dateDiv = document.createElement("div");
        dateDiv.className = "date-number";
        dateDiv.textContent = d.getDate();
        td.appendChild(dateDiv);

        if (dateStr >= todayStr) {
            const statusDiv = document.createElement("div");
            statusDiv.className = "studio-status";
            statusDiv.innerHTML = `
                <div class="status-row"><span class="studio-name">메인</span><span class="remaining-hours">${calculateRemainingTime(dateStr, "스튜디오 메인")}시간</span></div>
                <div class="status-row"><span class="studio-name">키친</span><span class="remaining-hours">${calculateRemainingTime(dateStr, "스튜디오 키친")}시간</span></div>
                <div class="status-row"><span class="studio-name">소형</span><span class="remaining-hours">${calculateRemainingTime(dateStr, "스튜디오 소형")}시간</span></div>`;
            td.appendChild(statusDiv);
        }

        if (dateStr === todayStr) td.classList.add("today");
        if (dateStr === activeDateStr) td.classList.add("selected");

        td.addEventListener('click', () => selectDate(dateStr));
        tr.appendChild(td);
        weekDayCount++;

        if (weekDayCount === 5) {
            tbody.appendChild(tr);
            tr = document.createElement("tr");
            weekDayCount = 0;
        }
    }
    
    document.getElementById("calendarTitle").textContent = `${year}년 ${month + 1}월`;
    document.getElementById("calendarPanelTitle").textContent = `${year}년 ${month + 1}월 스튜디오 잔여 시간`;
}

function selectDate(dateStr) {
    selectedDate = dateStr;
    const content = document.getElementById('scheduleContent');
    content.classList.add('updating');
    
    setTimeout(() => {
        renderScheduleByDate(dateStr);
        generateCalendar(currentYear, currentMonth, dateStr);
        content.classList.remove('updating');
    }, 150);
}

function renderScheduleByDate(dateStr) {
    if (!scheduleData) return;
    const filtered = scheduleData.filter(s => s.date === dateStr);
    const byStudio = {};
    filtered.forEach(s => (byStudio[s.studio] = byStudio[s.studio] || []).push(s));
    
    const parsed = new Date(dateStr);
    const formatter = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
    document.getElementById('scheduleTitle').textContent = `${formatter.format(parsed)} 스케줄`;

    const content = document.getElementById('scheduleContent');
    content.innerHTML = "";
    const studioOrder = ["스튜디오 메인", "스튜디오 키친", "스튜디오 소형"];
    const studiosWithBookings = studioOrder.filter(s => byStudio[s] && byStudio[s].length > 0);

    if (studiosWithBookings.length === 0) {
        content.innerHTML = `<div class="no-bookings">선택된 날짜에 예약이 없습니다</div>`;
        return;
    }
    const gridDiv = document.createElement("div");
    gridDiv.className = "studio-grid";
    studiosWithBookings.forEach(studio => {
        const section = document.createElement("div");
        section.className = "studio-section";
        section.innerHTML = `<div class="studio-header">${studio}</div>`;
        const body = document.createElement("div");
        body.className = "studio-body";
        byStudio[studio].sort((a, b) => parseInt(a.start) - parseInt(b.start)).forEach(s => {
            body.innerHTML += `<div class="booking-item">
                <div class="company-name">${s.company}</div>
                <div class="booking-time">${String(s.start).padStart(2, '0')}-${String(s.end).padStart(2, '0')}시</div>
                <div class="product-name">${s.product}</div></div>`;
        });
        section.appendChild(body);
        gridDiv.appendChild(section);
    });
    content.appendChild(gridDiv);
}

function changeMonth(offset) {
    let newDate = new Date(currentYear, currentMonth + offset, 1);
    const todayStr = getTodayKST();
    const todayDate = new Date(todayStr);
    const defaultDate = (newDate.getMonth() === todayDate.getMonth() && newDate.getFullYear() === todayDate.getFullYear()) 
        ? todayStr 
        : newDate.toISOString().split('T')[0];
    selectDate(defaultDate);
}

function refreshData() {
    document.getElementById('scheduleContent').innerHTML = '<div class="loading">데이터를 새로고침하는 중...</div>';
    loadScheduleData();
}