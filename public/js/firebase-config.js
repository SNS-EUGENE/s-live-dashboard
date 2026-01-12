/* public/js/firebase-config.js */

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBW245Dx4vvPJ_DGCDGN3p-hu70gjuKTd4",
  authDomain: "fir-live-dashboard.firebaseapp.com",
  projectId: "fir-live-dashboard",
  storageBucket: "fir-live-dashboard.appspot.com", // 여러 파일에서 혼용되고 있어 .appspot.com으로 통일
  messagingSenderId: "259309810096",
  appId: "1:259309810096:web:70b39a71d6cdae61aae675",
  measurementId: "G-QWZPK7H1V5"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// 다른 스크립트에서 공통으로 사용할 수 있도록 전역 변수로 선언
const auth = firebase.auth();
const db = firebase.firestore();