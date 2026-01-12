/* public/js/admin.js - 완전한 버전 */

let adminManager;

document.addEventListener('DOMContentLoaded', () => {
    checkUserLoggedIn('/index.html');
    adminManager = new AdminManager();
});

class SecurityUtils {
    static escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    static sanitizeInput(input) {
        if (!input || typeof input !== 'string') return '';
        return input.replace(/<[^>]*>/g, '');
    }
}

class DataService {
    constructor() {
        this.db = firebase.firestore();
        this.collection = this.db.collection('schedules');
        this.scheduleData = [];
    }

    async loadSchedules() {
        try {
            const snapshot = await this.collection.get();
            this.scheduleData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log('Firestore에서 로드됨:', this.scheduleData.length, '개 일정');
            return this.scheduleData;
        } catch (error) {
            console.error("Firestore 로드 실패:", error);
            throw error;
        }
    }

    async loadSchedulesByDateRange(startDate, endDate) {
        try {
            console.log(`📅 날짜 범위 로드: ${startDate} ~ ${endDate}`);
            const snapshot = await this.collection
                .where('date', '>=', startDate)
                .where('date', '<=', endDate)
                .get();
            this.scheduleData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log('Firestore에서 로드됨:', this.scheduleData.length, '개 일정 (날짜 범위 필터링)');
            return this.scheduleData;
        } catch (error) {
            console.error("Firestore 범위 로드 실패:", error);
            throw error;
        }
    }

    getNumericValue(input) {
        if (!input) return 0;
        const value = input.value.replace(/[^\d]/g, '');
        return value === '' ? 0 : parseInt(value, 10);
    }

    async saveSchedule(schedule) {
        try {
            if (schedule.id) {
                const docId = schedule.id;
                const dataToSave = { ...schedule };
                delete dataToSave.id;
                await this.collection.doc(docId).set(dataToSave, { merge: true });
                return { id: docId, ...dataToSave };
            } else {
                const { id, ...dataToSave } = schedule;
                const docRef = await this.collection.add(dataToSave);
                return { id: docRef.id, ...dataToSave };
            }
        } catch (error) {
            console.error("Firestore 저장 실패:", error);
            throw error;
        }
    }

    async deleteSchedule(id) {
        try {
            await this.collection.doc(id).delete();
            return true;
        } catch (error) {
            console.error("Firestore 삭제 실패:", error);
            throw error;
        }
    }
}

class AdminManager {
    constructor() {
        this.dataService = new DataService();
        this.currentSchedules = [];
        this.filteredSchedules = [];
        this.editingSchedule = null;
        this.surveyingSchedule = null;
        this.currentDateMode = 'range';
        this.isLoading = false;
        this.importConflictQueue = [];
        this.conflictPromiseResolver = null;
        this.applyAllAction = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setDefaultDateRange();
        this.setDateMode('range');
        await this.loadData();
    }

    setupEventListeners() {
        document.getElementById('addScheduleBtn').addEventListener('click', () => this.showAddModal());
        document.getElementById('closeModalBtn').addEventListener('click', () => this.hideModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.hideModal());
        document.getElementById('scheduleForm').addEventListener('submit', (e) => this.handleSubmit(e));
        document.getElementById('searchInput').addEventListener('input', () => this.applyFilters());
        document.getElementById('studioFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('statusFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('surveyFilter').addEventListener('change', () => this.applyFilters());
        
        document.getElementById('singleDateMode').addEventListener('click', () => this.setDateMode('single'));
        document.getElementById('rangeMode').addEventListener('click', () => this.setDateMode('range'));
        document.getElementById('singleDate').addEventListener('change', () => this.handleDateChange());
        document.getElementById('startDate').addEventListener('change', () => this.handleDateChange());
        document.getElementById('endDate').addEventListener('change', () => this.handleDateChange());
        
        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
        document.getElementById('importBtn').addEventListener('click', () => this.importData());
        document.getElementById('refreshBtn').addEventListener('click', () => this.refreshData());
        document.getElementById('scheduleModal').addEventListener('click', (e) => {
            if (e.target.id === 'scheduleModal') this.hideModal();
        });

        document.getElementById('closeSurveyModalBtn').addEventListener('click', () => this.hideSurveyModal());
        document.getElementById('cancelSurveyBtn').addEventListener('click', () => this.hideSurveyModal());
        document.getElementById('deleteSurveyBtn').addEventListener('click', () => this.deleteSurvey());
        document.getElementById('surveyForm').addEventListener('submit', (e) => this.handleSurveySubmit(e));
        document.getElementById('surveyModal').addEventListener('click', (e) => {
            if (e.target.id === 'surveyModal') this.hideSurveyModal();
        });
        
        document.getElementById('overwriteBtn').addEventListener('click', () => this.resolveConflict('overwrite'));
        document.getElementById('mergeBtn').addEventListener('click', () => this.resolveConflict('merge'));
        document.getElementById('skipBtn').addEventListener('click', () => this.resolveConflict('skip'));

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideModal();
                this.hideSurveyModal();
                if (document.getElementById('conflictModal').classList.contains('show')) {
                    this.resolveConflict('skip');
                }
            }
        });
    }

    async loadData() {
        if (this.isLoading) {
            console.log('⚠️ 이미 로딩 중이므로 건너뜀');
            return;
        }

        try {
            this.isLoading = true;
            const tbody = document.getElementById('schedulesTableBody');
            tbody.innerHTML = `<tr><td colspan="7"><div class="loading">데이터를 불러오는 중...</div></td></tr>`;
            
            const dateRange = this.getDateRange();
            console.log('📅 로딩할 날짜 범위:', dateRange);
            
            this.currentSchedules = await this.dataService.loadSchedulesByDateRange(dateRange.start, dateRange.end);
            this.applyFilters();
            this.updateStats();
        } catch (error) {
            console.error('데이터 로드 실패:', error);
            this.showError('데이터를 불러올 수 없습니다. Firestore 연결을 확인해주세요.');
        } finally {
            this.isLoading = false;
        }
    }

    setDateMode(mode) {
        const singleBtn = document.getElementById('singleDateMode');
        const rangeBtn = document.getElementById('rangeMode');
        const singleGroup = document.getElementById('singleDateGroup');
        const rangeGroup = document.getElementById('rangeDateGroup');

        if (mode === 'single') {
            singleBtn.classList.add('active');
            rangeBtn.classList.remove('active');
            singleGroup.style.display = 'flex';
            rangeGroup.style.display = 'none';
        } else {
            singleBtn.classList.remove('active');
            rangeBtn.classList.add('active');
            singleGroup.style.display = 'none';
            rangeGroup.style.display = 'flex';
        }
        
        this.currentDateMode = mode;
        console.log(`📅 날짜 모드 변경: ${mode}`);
    }

    setDefaultDateRange() {
        const today = this.getTodayKST();
        const oneWeekAgo = this.getDateOffset(today, -7);
        const oneWeekLater = this.getDateOffset(today, 7);
        
        document.getElementById('startDate').value = oneWeekAgo;
        document.getElementById('endDate').value = oneWeekLater;
        document.getElementById('singleDate').value = today;
        
        console.log(`📅 디폴트 날짜 범위 설정: ${oneWeekAgo} ~ ${oneWeekLater}`);
    }

    getDateRange() {
        if (this.currentDateMode === 'single') {
            const singleDate = document.getElementById('singleDate').value;
            if (!singleDate) {
                const today = this.getTodayKST();
                return { start: today, end: today };
            }
            return { start: singleDate, end: singleDate };
        } else {
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            
            if (!startDate || !endDate) {
                const today = this.getTodayKST();
                return {
                    start: this.getDateOffset(today, -7),
                    end: this.getDateOffset(today, 7)
                };
            }
            
            return { start: startDate, end: endDate };
        }
    }

    async handleDateChange() {
        if (this.isLoading) {
            console.log('⚠️ 로딩 중이므로 날짜 변경 건너뜀');
            return;
        }

        const dateRange = this.getDateRange();
        
        if (this.currentDateMode === 'range' && dateRange.start > dateRange.end) {
            const startInput = document.getElementById('startDate');
            const endInput = document.getElementById('endDate');
            
            startInput.style.borderColor = '#ef4444';
            endInput.style.borderColor = '#ef4444';
            
            setTimeout(() => {
                startInput.style.borderColor = '';
                endInput.style.borderColor = '';
            }, 2000);
            
            return;
        }

        clearTimeout(this.dateChangeTimeout);
        this.dateChangeTimeout = setTimeout(async () => {
            console.log('📅 날짜 변경됨, 데이터 다시 로드');
            await this.loadData();
        }, 300);
    }
    
    updateStats() {
        const today = this.getTodayKST();
        const thisWeek = this.getThisWeekRange();
        const todayCount = this.currentSchedules.filter(s => s.date === today).length;
        const weekCount = this.currentSchedules.filter(s => s.date >= thisWeek.start && s.date <= thisWeek.end).length;
        const companyCount = new Set(this.currentSchedules.map(s => s.company)).size;
        
        const completedSurveys = this.currentSchedules.filter(s => s.survey && s.survey.completed).length;
        const surveyRate = this.currentSchedules.length > 0 ? Math.round((completedSurveys / this.currentSchedules.length) * 100) : 0;
        
        document.getElementById('todayCount').innerHTML = `${todayCount}<span style="font-size: 0.8rem; color: #64748b; margin-left: 0.25rem;">건</span>`;
        document.getElementById('weekCount').innerHTML = `${weekCount}<span style="font-size: 0.8rem; color: #64748b; margin-left: 0.25rem;">건</span>`;
        document.getElementById('companyCount').innerHTML = `${companyCount}<span style="font-size: 0.8rem; color: #64748b; margin-left: 0.25rem;">개</span>`;
        document.getElementById('surveyRate').innerHTML = `${surveyRate}<span style="font-size: 0.8rem; color: #64748b; margin-left: 0.25rem;">%</span>`;
    }

    getTodayKST() {
        const now = new Date();
        const kstOffset = 9 * 60 * 60 * 1000;
        const kst = new Date(now.getTime() + kstOffset);
        return kst.toISOString().split('T')[0];
    }

    getThisWeekRange() {
        const today = new Date(this.getTodayKST());
        const day = today.getDay();
        const diffToMonday = today.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(today.setDate(diffToMonday));
        const friday = new Date(new Date(monday).setDate(monday.getDate() + 4));
        return {
            start: monday.toISOString().split('T')[0],
            end: friday.toISOString().split('T')[0]
        };
    }

    getDateOffset(dateString, offsetDays) {
        const date = new Date(dateString);
        date.setDate(date.getDate() + offsetDays);
        return date.toISOString().split('T')[0];
    }

    applyFilters() {
        const searchTerm = SecurityUtils.sanitizeInput(document.getElementById('searchInput').value.toLowerCase());
        const studioFilter = document.getElementById('studioFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;
        const surveyFilter = document.getElementById('surveyFilter').value;
        
        this.filteredSchedules = this.currentSchedules.filter(schedule => {
            const matchesSearch = !searchTerm || (schedule.company && schedule.company.toLowerCase().includes(searchTerm)) || (schedule.product && schedule.product.toLowerCase().includes(searchTerm));
            const matchesStudio = !studioFilter || schedule.studio === studioFilter;
            const matchesStatus = !statusFilter || this.getScheduleStatus(schedule) === statusFilter;
            
            let matchesSurvey = true;
            if (surveyFilter) {
                const surveyCompleted = schedule.survey && schedule.survey.completed;
                if (surveyFilter === 'completed') {
                    matchesSurvey = surveyCompleted;
                } else if (surveyFilter === 'pending') {
                    matchesSurvey = !surveyCompleted;
                }
            }
            
            return matchesSearch && matchesStudio && matchesStatus && matchesSurvey;
        });
        this.renderTable();
    }

    renderTable() {
        const tbody = document.getElementById('schedulesTableBody');
        if (this.filteredSchedules.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7"><div class="no-data"><div class="no-data-icon">📅</div><div>검색 결과가 없습니다</div><div style="font-size: 0.9rem; margin-top: 0.5rem;">다른 검색어를 입력하거나 필터를 변경해보세요</div></div></td></tr>`;
            return;
        }
        
        const sortedSchedules = [...this.filteredSchedules].sort((a, b) => {
            const statusA = this.getScheduleStatus(a);
            const statusB = this.getScheduleStatus(b);
            const today = this.getTodayKST();
            const twoDaysAgo = this.getDateOffset(today, -2);
            const tomorrow = this.getDateOffset(today, 1);
            
            const getPriority = (schedule, status) => {
                const scheduleDate = schedule.date;
                if (status === 'active') return 1;
                if (status === 'upcoming') {
                    if (scheduleDate <= tomorrow) return 2;
                    return 4;
                }
                if (status === 'completed') {
                    if (scheduleDate >= twoDaysAgo) return 3;
                    return 5;
                }
                return 6;
            };
            
            const priorityA = getPriority(a, statusA);
            const priorityB = getPriority(b, statusB);
            
            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }
            
            if (priorityA === 1) {
                return parseInt(a.start, 10) - parseInt(b.start, 10);
            } else if (priorityA === 2 || priorityA === 4) {
                if (a.date !== b.date) return new Date(a.date) - new Date(b.date);
                return parseInt(a.start, 10) - parseInt(b.start, 10);
            } else if (priorityA === 3 || priorityA === 5) {
                if (a.date !== b.date) return new Date(b.date) - new Date(a.date);
                return parseInt(b.start, 10) - parseInt(a.start, 10);
            }
            
            return 0;
        });
        
        tbody.innerHTML = sortedSchedules.map(schedule => {
            const status = this.getScheduleStatus(schedule);
            const statusInfo = this.getStatusInfo(status);
            const surveyCompleted = schedule.survey && schedule.survey.completed;
            const surveyButtonClass = surveyCompleted ? 'btn-survey completed' : 'btn-survey';
            const surveyButtonText = surveyCompleted ? '✅ 설문 완료' : '📝 설문 대기';
            
            return `<tr class="schedule-row" data-id="${SecurityUtils.escapeHtml(schedule.id)}">
                <td class="schedule-date">${SecurityUtils.escapeHtml(this.formatDate(schedule.date))}</td>
                <td class="schedule-studio ${this.getStudioClass(schedule.studio)}">${SecurityUtils.escapeHtml(schedule.studio || '')}</td>
                <td class="schedule-company">${SecurityUtils.escapeHtml(schedule.company || '')}</td>
                <td class="schedule-time">${String(schedule.start || '').padStart(2, '0')}-${String(schedule.end || '').padStart(2, '0')}시</td>
                <td class="schedule-product">${SecurityUtils.escapeHtml(schedule.product || '')}</td>
                <td><span class="status-badge status-${status}">${statusInfo.text}</span></td>
                <td>
                    <div class="action-buttons" style="flex-direction: column; gap: 0.3rem;">
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-sm btn-primary" onclick="adminManager.editSchedule('${SecurityUtils.escapeHtml(schedule.id)}')">✏️ 수정</button>
                            <button class="btn btn-sm btn-danger" onclick="adminManager.deleteSchedule('${SecurityUtils.escapeHtml(schedule.id)}')">🗑️ 삭제</button>
                        </div>
                        <div style="display: flex; gap: 0.5rem; justify-content: center;">
                            <button class="btn btn-sm ${surveyButtonClass}" onclick="adminManager.showSurveyModal('${SecurityUtils.escapeHtml(schedule.id)}')" style="width: 100%;">${surveyButtonText}</button>
                        </div>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', timeZone: 'Asia/Seoul' }).format(date);
    }

    getScheduleStatus(schedule) {
        const now = new Date();
        const startTime = new Date(`${schedule.date}T${String(schedule.start).padStart(2, '0')}:00:00+09:00`);
        const endTime = new Date(`${schedule.date}T${String(schedule.end).padStart(2, '0')}:00:00+09:00`);
        if (now < startTime) return 'upcoming';
        if (now >= startTime && now <= endTime) return 'active';
        return 'completed';
    }

    getStatusInfo(status) {
        const statusMap = { 'active': { text: '이용 중' }, 'upcoming': { text: '예정' }, 'completed': { text: '이용 완료' } };
        return statusMap[status] || { text: '알 수 없음' };
    }

    getStudioClass(studio) {
        if (!studio) return '';
        if (studio.includes('메인')) return 'studio-main';
        if (studio.includes('소형')) return 'studio-small';
        if (studio.includes('키친')) return 'studio-kitchen';
        return '';
    }

    async deleteSurvey() {
        if (!this.surveyingSchedule) { 
            alert('삭제할 설문이 없습니다.'); 
            return; 
        }
        if (!this.surveyingSchedule.survey || !this.surveyingSchedule.survey.completed) { 
            alert('완료된 설문만 삭제할 수 있습니다.'); 
            return; 
        }
        if (!confirm('설문 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;

        const deleteBtn = document.getElementById('deleteSurveyBtn');
        deleteBtn.disabled = true;
        deleteBtn.textContent = '삭제 중...';

        try {
            const updatedSchedule = { ...this.surveyingSchedule };
            delete updatedSchedule.survey;
            await this.dataService.saveSchedule(updatedSchedule);
            alert('설문 데이터가 삭제되었습니다.');
            await this.loadData();
            this.hideSurveyModal();
        } catch (error) {
            console.error('설문 삭제 실패:', error);
            alert('설문 삭제 중 오류가 발생했습니다: ' + error.message);
        } finally {
            deleteBtn.disabled = false;
            deleteBtn.textContent = '🗑️ 설문 삭제';
        }
    }

    showSurveyModal(scheduleId) {
        const schedule = this.currentSchedules.find(s => s.id === scheduleId);
        if (!schedule) return;
        this.surveyingSchedule = schedule;
        
        document.getElementById('surveyScheduleInfo').textContent = `${schedule.company} - ${this.formatDate(schedule.date)}`;
        document.getElementById('surveyScheduleDetails').textContent = `${schedule.studio} | ${String(schedule.start).padStart(2, '0')}:00-${String(schedule.end).padStart(2, '0')}:00 | ${schedule.product}`;
        
        const deleteBtn = document.getElementById('deleteSurveyBtn');
        if (schedule.survey && schedule.survey.completed) {
            deleteBtn.style.display = 'block';
        } else {
            deleteBtn.style.display = 'none';
        }

        if (schedule.survey) {
            const survey = schedule.survey;
            document.getElementById('facilityRating').value = survey.facilityRating || '';
            document.getElementById('staffKindness').value = survey.staffKindness || '';
            document.getElementById('equipmentExpertise').value = survey.equipmentExpertise || '';
            document.getElementById('reservationSatisfaction').value = survey.reservationSatisfaction || '';
            document.getElementById('cleanliness').value = survey.cleanliness || '';
            document.getElementById('equipmentSatisfaction').value = survey.equipmentSatisfaction || '';
            document.getElementById('discoveryPath').value = survey.discoveryPath || '';
            document.getElementById('studioBenefits').value = survey.studioBenefits || '';
            document.getElementById('revenue').value = survey.revenue ? parseInt(survey.revenue, 10).toLocaleString('ko-KR') : '';
            document.getElementById('viewerCount').value = survey.viewerCount ? parseInt(survey.viewerCount, 10).toLocaleString('ko-KR') : '';
            document.getElementById('feedback').value = survey.feedback || '';
        } else {
            document.getElementById('surveyForm').reset();
        }

        this.toggleSurveyFields(schedule.purpose);
        document.getElementById('surveyModal').classList.add('show');
        this.setupNumberInputs();
    }

    toggleSurveyFields(purpose) {
        const revenueField = document.getElementById('revenue');
        const viewerCountField = document.getElementById('viewerCount');
        const revenueGroup = revenueField.closest('.form-group');
        const viewerCountGroup = viewerCountField.closest('.form-group');
        
        const isLiveCommerce = purpose === '라이브커머스';
        
        revenueField.disabled = !isLiveCommerce;
        viewerCountField.disabled = !isLiveCommerce;
        
        if (!isLiveCommerce) {
            revenueField.value = '';
            viewerCountField.value = '';
        }
        
        if (isLiveCommerce) {
            revenueGroup.style.opacity = '1';
            viewerCountGroup.style.opacity = '1';
            revenueField.style.backgroundColor = '';
            viewerCountField.style.backgroundColor = '';
        } else {
            revenueGroup.style.opacity = '0.5';
            viewerCountGroup.style.opacity = '0.5';
            revenueField.style.backgroundColor = '#f3f4f6';
            viewerCountField.style.backgroundColor = '#f3f4f6';
        }
    }
    
    setupNumberInputs() {
        const setupListener = (input, step) => {
            if (!input) return;
            
            const format = (el) => {
                let value = el.value.replace(/[^\d]/g, '');
                if (value === '') return;
                el.value = parseInt(value, 10).toLocaleString('ko-KR');
            };

            const handleKey = (e) => {
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    const current = this.dataService.getNumericValue(e.target);
                    const newValue = e.key === 'ArrowUp' ? current + step : Math.max(0, current - step);
                    e.target.value = newValue.toLocaleString('ko-KR');
                }
            };

            input.addEventListener('input', (e) => format(e.target));
            input.addEventListener('keydown', handleKey);
        };

        setupListener(document.getElementById('revenue'), 10000);
        setupListener(document.getElementById('viewerCount'), 100);
    }

    hideSurveyModal() {
        document.getElementById('surveyModal').classList.remove('show');
        this.surveyingSchedule = null;
    }

    async handleSurveySubmit(e) {
        e.preventDefault();
        if (!this.surveyingSchedule) return;

        const formData = {
            facilityRating: document.getElementById('facilityRating').value,
            staffKindness: document.getElementById('staffKindness').value,
            equipmentExpertise: document.getElementById('equipmentExpertise').value,
            reservationSatisfaction: document.getElementById('reservationSatisfaction').value,
            cleanliness: document.getElementById('cleanliness').value,
            equipmentSatisfaction: document.getElementById('equipmentSatisfaction').value,
            discoveryPath: document.getElementById('discoveryPath').value,
            studioBenefits: document.getElementById('studioBenefits').value,
            revenue: this.dataService.getNumericValue(document.getElementById('revenue')),
            viewerCount: this.dataService.getNumericValue(document.getElementById('viewerCount')),
            feedback: document.getElementById('feedback').value,
            completed: true,
            submittedAt: new Date().toISOString()
        };

        const requiredFields = ['facilityRating', 'staffKindness', 'equipmentExpertise', 'reservationSatisfaction', 'cleanliness', 'equipmentSatisfaction'];
        for (const field of requiredFields) {
            if (!formData[field]) {
                alert(`${this.getFieldName(field)} 항목은 필수입니다.`);
                return;
            }
        }

        const saveBtn = document.getElementById('saveSurveyBtn');
        saveBtn.disabled = true;
        saveBtn.textContent = '저장 중...';

        try {
            const updatedSchedule = { ...this.surveyingSchedule, survey: formData };
            await this.dataService.saveSchedule(updatedSchedule);
            alert('설문조사가 완료되었습니다.');
            await this.loadData();
            this.hideSurveyModal();
        } catch (error) {
            console.error('설문 저장 실패:', error);
            alert('설문 저장 중 오류가 발생했습니다.');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = '설문 완료';
        }
    }

    showAddModal() {
        this.editingSchedule = null;
        document.getElementById('modalTitle').textContent = '새 예약 추가';
        document.getElementById('saveBtn').textContent = '저장';
        document.getElementById('scheduleForm').reset();
        document.getElementById('modalDate').value = this.getTodayKST();
        this.showModal();
    }

    editSchedule(id) {
        const schedule = this.currentSchedules.find(s => s.id === id);
        if (schedule) this.showEditModal(schedule);
    }

    showEditModal(schedule) {
        this.editingSchedule = schedule;
        document.getElementById('modalTitle').textContent = '예약 수정';
        document.getElementById('saveBtn').textContent = '수정';
        document.getElementById('modalDate').value = schedule.date;
        document.getElementById('modalStudio').value = schedule.studio;
        document.getElementById('modalCompany').value = schedule.company;
        document.getElementById('modalStart').value = String(schedule.start).padStart(2, '0');
        document.getElementById('modalEnd').value = String(schedule.end).padStart(2, '0');
        document.getElementById('modalPurpose').value = schedule.purpose || '';
        document.getElementById('modalProduct').value = schedule.product;
        this.showModal();
    }

    showModal() { 
        document.getElementById('scheduleModal').classList.add('show'); 
    }
    
    hideModal() { 
        document.getElementById('scheduleModal').classList.remove('show'); 
        this.editingSchedule = null; 
    }

    async handleSubmit(e) {
        e.preventDefault();
        const formData = {
            date: document.getElementById('modalDate').value,
            studio: document.getElementById('modalStudio').value,
            company: document.getElementById('modalCompany').value,
            start: parseInt(document.getElementById('modalStart').value, 10),
            end: parseInt(document.getElementById('modalEnd').value, 10),
            purpose: document.getElementById('modalPurpose').value,
            product: document.getElementById('modalProduct').value
        };
        if (!this.validateForm(formData)) return;
        const saveBtn = document.getElementById('saveBtn');
        saveBtn.disabled = true;
        saveBtn.textContent = '저장 중...';
        try {
            if (this.editingSchedule) {
                formData.id = this.editingSchedule.id;
                if (this.editingSchedule.survey) {
                    formData.survey = this.editingSchedule.survey;
                }
            }
            await this.dataService.saveSchedule(formData);
            alert(this.editingSchedule ? '예약이 수정되었습니다.' : '새 예약이 추가되었습니다.');
            await this.loadData();
            this.hideModal();
        } catch (error) {
            console.error('저장 실패:', error);
            alert('저장 중 오류가 발생했습니다.');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = this.editingSchedule ? '수정' : '저장';
        }
    }

    validateForm(formData) {
        for (const key in formData) {
            if (!formData[key]) {
                alert(`${this.getFieldName(key)} 항목은 필수입니다.`);
                return false;
            }
        }
        if (formData.start >= formData.end) {
            alert('종료 시간은 시작 시간보다 늦어야 합니다.');
            return false;
        }
        const conflicts = this.currentSchedules.filter(schedule => {
            if (this.editingSchedule && schedule.id === this.editingSchedule.id) return false;
            return schedule.date === formData.date && schedule.studio === formData.studio && !(parseInt(schedule.end, 10) <= formData.start || parseInt(schedule.start, 10) >= formData.end);
        });
        if (conflicts.length > 0) {
            alert('선택한 시간대에 이미 다른 예약이 있습니다.');
            return false;
        }
        return true;
    }

    getFieldName(field) {
        const fieldNames = { 
            date: '날짜', 
            studio: '스튜디오', 
            company: '업체명', 
            start: '시작 시간', 
            end: '종료 시간', 
            purpose: '이용 목적',
            product: '제품명', 
            facilityRating: '시설 만족도', 
            staffKindness: '직원 친절도', 
            equipmentExpertise: '장비 전문성', 
            reservationSatisfaction: '예약 만족도', 
            cleanliness: '청결 상태', 
            equipmentSatisfaction: '비품 만족도' 
        };
        return fieldNames[field] || field;
    }

    async deleteSchedule(id) {
        const schedule = this.currentSchedules.find(s => s.id === id);
        if (!schedule) return;
        if (confirm(`'${schedule.company}'의 ${this.formatDate(schedule.date)} 예약을 삭제하시겠습니까?`)) {
            try {
                await this.dataService.deleteSchedule(id);
                await this.loadData();
                alert('예약이 삭제되었습니다.');
            } catch (error) {
                console.error('삭제 실패:', error);
                alert('삭제 중 오류가 발생했습니다.');
            }
        }
    }

    exportData() {
        if (this.filteredSchedules.length === 0) {
            alert('내보낼 데이터가 없습니다. 필터를 확인해주세요.');
            return;
        }
        try {
            const dataToExport = this.filteredSchedules.map(({ id, ...rest }) => rest);
            const dataStr = JSON.stringify(dataToExport, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `slive_schedule_${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            URL.revokeObjectURL(link.href);
            alert('현재 필터링된 데이터가 내보내기되었습니다.');
        } catch (error) {
            console.error('내보내기 실패:', error);
            alert('내보내기 중 오류가 발생했습니다.');
        }
    }
    
    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.csv,.xls,.xlsx';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    let schedulesData;
                    const fileExtension = file.name.split('.').pop().toLowerCase();
                    if (fileExtension === 'json') {
                        schedulesData = JSON.parse(event.target.result);
                    } else if (['csv', 'xls', 'xlsx'].includes(fileExtension)) {
                        const data = event.target.result;
                        const workbook = XLSX.read(data, { type: 'array' });
                        const sheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[sheetName];
                        schedulesData = XLSX.utils.sheet_to_json(worksheet).map(item => this.mapExcelData(item)).filter(Boolean);
                    } else {
                        alert('지원하지 않는 파일 형식입니다.');
                        return;
                    }
                    if (!schedulesData || schedulesData.length === 0) {
                        alert('파일에서 가져올 유효한 데이터가 없습니다.');
                        return;
                    }
                    await this.handleImportConflicts(schedulesData);
                } catch (error) {
                    console.error('가져오기 실패:', error);
                    alert('파일을 가져오는 중 오류가 발생했습니다: ' + error.message);
                }
            };
            const fileExtension = file.name.split('.').pop().toLowerCase();
            if (['csv', 'xls', 'xlsx'].includes(fileExtension)) {
                reader.readAsArrayBuffer(file);
            } else {
                reader.readAsText(file);
            }
        };
        input.click();
    }

    async handleImportConflicts(schedulesData) {
        this.importConflictQueue = [];
        this.applyAllAction = null;
        const toAdd = [], toUpdate = [], skipped = [];

        for (const newSchedule of schedulesData) {
            const existingSchedule = this.currentSchedules.find(s => 
                s.date === newSchedule.date &&
                s.studio === newSchedule.studio &&
                s.start === newSchedule.start
            );

            if (existingSchedule) {
                this.importConflictQueue.push({ existingSchedule, newSchedule });
            } else {
                toAdd.push(newSchedule);
            }
        }
        
        if (this.importConflictQueue.length > 0) {
            await this.processConflictQueue(toAdd, toUpdate, skipped);
        }

        if (toAdd.length === 0 && toUpdate.length === 0 && skipped.length === 0 && this.importConflictQueue.length > 0) {
            alert(`가져오기가 완료되었습니다. 처리된 중복 항목: ${this.importConflictQueue.length}개`);
            return;
        }

        if (toAdd.length === 0 && toUpdate.length === 0 && skipped.length > 0) {
            alert(`${skipped.length}개 항목을 모두 건너뛰었습니다.`);
            return;
        }
        
        if(toAdd.length > 0 || toUpdate.length > 0) {
             const confirmMsg = `
                📊 가져오기 결과를 반영하시겠습니까?
                • 새로 추가: ${toAdd.length}개
                • 업데이트: ${toUpdate.length}개  
                • 건너뛴 항목: ${skipped.length}개
            `;
            if (!confirm(confirmMsg)) {
                alert('가져오기가 취소되었습니다.');
                return;
            }

            try {
                const batch = firebase.firestore().batch();
                toAdd.forEach(schedule => {
                    const docRef = this.dataService.collection.doc();
                    batch.set(docRef, schedule);
                });
                toUpdate.forEach(schedule => {
                    const { id, ...dataToSave } = schedule;
                    const docRef = this.dataService.collection.doc(id);
                    batch.set(docRef, dataToSave, { merge: true });
                });

                await batch.commit();
                await this.loadData();
                alert(`✅ 가져오기 완료!\n• 추가: ${toAdd.length}개\n• 업데이트: ${toUpdate.length}개\n• 건너뜀: ${skipped.length}개`);
            } catch (error) {
                console.error('배치 저장 실패:', error);
                alert('데이터 저장 중 오류가 발생했습니다: ' + error.message);
            }
        } else if(this.importConflictQueue.length === 0 && schedulesData.length > 0) {
            alert('중복된 항목이 없어, 가져오기를 진행하지 않았습니다.');
        }
    }

    async processConflictQueue(toAdd, toUpdate, skipped) {
        if (this.importConflictQueue.length === 0) return;

        const conflict = this.importConflictQueue.shift();
        const { existingSchedule, newSchedule } = conflict;
        let action;

        if (this.applyAllAction) {
            action = this.applyAllAction;
        } else {
            action = await this.showConflictDialog(existingSchedule, newSchedule);
        }
        
        if (action === 'overwrite') {
            const scheduleToUpdate = { ...newSchedule, id: existingSchedule.id };
            if(existingSchedule.survey && !confirm('⚠️ 경고: 완료된 설문이 삭제됩니다.\n정말 덮어쓰시겠습니까?')) {
                skipped.push(conflict);
            } else {
                toUpdate.push(scheduleToUpdate);
            }
        } else if (action === 'merge') {
            const mergedSchedule = { ...newSchedule, id: existingSchedule.id, survey: existingSchedule.survey || null };
            toUpdate.push(mergedSchedule);
        } else {
            skipped.push(conflict);
        }

        await this.processConflictQueue(toAdd, toUpdate, skipped);
    }

    showConflictDialog(existing, newData) {
        return new Promise(resolve => {
            this.conflictPromiseResolver = resolve;

            document.getElementById('conflictModal').classList.add('show');
            document.getElementById('applyToAllConflicts').checked = false;

            document.getElementById('conflictCompany').textContent = existing.company;
            document.getElementById('conflictDate').textContent = this.formatDate(existing.date);
            
            const formatDetails = (schedule, hasSurvey = false) => `
                <p><strong>시간:</strong> <span class="highlight">${String(schedule.start).padStart(2,'0')}:00 - ${String(schedule.end).padStart(2,'0')}:00</span></p>
                <p><strong>스튜디오:</strong> ${SecurityUtils.escapeHtml(schedule.studio)}</p>
                <p><strong>제품:</strong> ${SecurityUtils.escapeHtml(schedule.product || '없음')}</p>
                ${hasSurvey ? '<div class="survey-info">📝 설문 완료됨</div>' : ''}
            `;
            
            document.getElementById('existingScheduleInfo').innerHTML = formatDetails(existing, !!existing.survey);
            document.getElementById('newScheduleInfo').innerHTML = formatDetails(newData);
        });
    }
    
    resolveConflict(action) {
        if(this.conflictPromiseResolver) {
            if (document.getElementById('applyToAllConflicts').checked) {
                this.applyAllAction = action;
            }
            this.conflictPromiseResolver(action);
            this.conflictPromiseResolver = null;
            document.getElementById('conflictModal').classList.remove('show');
        }
    }

    mapExcelData(item) {
        try {
            const getStudioName = (rawName) => {
                if (!rawName) return '';
                const name = String(rawName).trim();
                if (name.includes('스튜디오3(메인)')) return '스튜디오 메인';
                if (name.includes('스튜디오2(주방)')) return '스튜디오 키친';
                if (name.includes('스튜디오1(소형)')) return '스튜디오 소형';
                return name;
            };

            const excelDateToJSDate = (serial) => {
                if (typeof serial !== 'number' || serial < 1) {
                   const dateMatch = String(serial).match(/\d{4}-\d{2}-\d{2}/);
                   return dateMatch ? dateMatch[0] : '';
                }
                const utc_days = Math.floor(serial - 25569);
                const utc_value = utc_days * 86400;
                const date_info = new Date(utc_value * 1000);
                return new Date(date_info.getTime() + (date_info.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            };

            const companyRaw = item['신청자명 ( 단체명 )'] || '';
            const companyMatch = companyRaw.match(/\(([^)]+)\)/);
            const timeRaw = item['이용시간'] || '';
            const timeRange = String(timeRaw).split('~');

            const schedule = {
                company: companyMatch ? companyMatch[1].trim() : companyRaw.trim(),
                date: excelDateToJSDate(item['대관일']),
                start: timeRange[0] ? parseInt(timeRange[0].split(':')[0], 10) : 0,
                end: timeRange[1] ? parseInt(timeRange[1].split(':')[0], 10) : 0,
                studio: getStudioName(item['장소']),
                purpose: item['이용목적'] || '일반',
                product: item['행사목적'] || ''
            };
            
            if (schedule.date && schedule.company && schedule.studio && schedule.start && schedule.end) {
                return schedule;
            }
            return null;
        } catch (e) {
            console.warn("엑셀 행 처리 중 오류:", item, e);
            return null;
        }
    }

    async refreshData() {
        try {
            await this.loadData();
            document.getElementById('searchInput').value = '';
            document.getElementById('studioFilter').value = '';
            document.getElementById('statusFilter').value = '';
            document.getElementById('surveyFilter').value = '';
            
            this.setDefaultDateRange();
            this.setDateMode('range');
            
            alert('데이터가 새로고침되었습니다.');
        } catch (error) {
            console.error('새로고침 실패:', error);
            alert('새로고침 중 오류가 발생했습니다.');
        }
    }

    showError(message) {
        const tbody = document.getElementById('schedulesTableBody');
        tbody.innerHTML = `<tr><td colspan="7"><div class="no-data"><div class="no-data-icon">❌</div><div style="color: #dc2626; font-weight: 600;">오류 발생</div><div style="font-size: 0.9rem; margin-top: 0.5rem;">${SecurityUtils.escapeHtml(message)}</div></div></td></tr>`;
    }
}