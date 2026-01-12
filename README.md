# S-LIVE 스튜디오 대관 관리 시스템

> 라이브커머스 스튜디오 예약/대관 스케줄 및 만족도 조사를 관리하는 웹 대시보드

![Firebase](https://img.shields.io/badge/Firebase-Backend-FFCA28?logo=firebase&logoColor=white)
![Vanilla JS](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-blue)

## 주요 기능

| 페이지 | 기능 |
|--------|------|
| **메인** | 오늘/주간 일정 요약, 스튜디오별 현황 |
| **대시보드** | 캘린더 기반 스케줄 조회, 일/주/월 뷰 |
| **관리자** | 예약 추가/수정/삭제, 필터링, 엑셀 내보내기 |
| **통계** | 스튜디오별/기간별 이용 통계, 차트 시각화 |

## 스크린샷

<img width="2542" height="1263" alt="image" src="https://github.com/user-attachments/assets/f9c5e095-a198-48ab-ac40-07e92a253cec" />
<img width="2536" height="1264" alt="image" src="https://github.com/user-attachments/assets/ee3b7201-a1a6-4c7c-96aa-c8f763a2848a" />



## 스튜디오 정보

| 스튜디오 | 용도 | 수용 인원 |
|----------|------|-----------|
| **스튜디오 메인** | 대형 라이브커머스, 다인 촬영 | 10명+ |
| **스튜디오 소형** | 소규모 촬영, 1인 방송 | 1~3명 |
| **스튜디오 키친** | 쿠킹 라이브, 식품 촬영 | 5명 |

## 빠른 시작

```bash
# Firebase CLI 설치 (최초 1회)
npm install -g firebase-tools

# Firebase 로그인
firebase login

# 로컬 서버 실행
firebase serve

# 또는 간단히
npx serve public
```

브라우저에서 http://localhost:5000 접속

## 배포

```bash
# Firebase Hosting 배포
firebase deploy

# Vercel 배포
vercel --prod
```

## 기술 스택

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Backend**: Firebase (Firestore, Authentication, Hosting)
- **라이브러리**: SheetJS (xlsx), Chart.js

## 프로젝트 구조

```
public/
├── index.html          # 로그인 페이지
├── main.html           # 메인 대시보드
├── dashboard.html      # 캘린더 뷰
├── admin.html          # 관리자 페이지
├── statistics.html     # 통계 페이지
├── tool.html           # 유틸리티 도구
├── css/
│   ├── login.css
│   ├── admin.css
│   └── ...
├── js/
│   ├── firebase-config.js   # Firebase 설정
│   ├── auth.js              # 인증 모듈
│   ├── admin.js             # 관리자 기능
│   ├── dashboard.js         # 대시보드 기능
│   ├── statistics.js        # 통계 기능
│   └── ...
└── S-LIVE.png          # 로고

firebase.json           # Firebase 설정
vercel.json             # Vercel 설정
```

## 주요 기능 상세

### 예약 관리
- 스튜디오/날짜/시간대별 예약 등록
- 업체명, 제품명, 담당자 정보 관리
- 예약 상태 관리 (예정/이용중/완료)

### 필터링 & 검색
- 업체명/제품명 검색
- 스튜디오별 필터
- 예약 상태별 필터
- 설문 완료 여부 필터
- 단일 날짜 / 기간 필터

### 만족도 조사
- 이용 완료 후 설문 발송
- 설문 완료율 추적
- 피드백 수집 및 분석

### 데이터 내보내기
- 엑셀(xlsx) 형식 다운로드
- 필터 적용된 데이터 내보내기

## 환경 변수

Firebase 설정은 `public/js/firebase-config.js`에서 관리합니다:

```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

## 라이선스

MIT License

---

Made with ☕ by S-LIVE 개발팀
