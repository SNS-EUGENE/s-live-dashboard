/* public/js/login.js */

document.addEventListener('DOMContentLoaded', () => {
    // 이미 로그인된 사용자는 관리자 페이지로 이동
    checkUserNotLoggedIn('/admin.html');

    const loginBtn = document.getElementById('loginBtn');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('error-message');

    // 로그인 버튼 클릭 이벤트
    loginBtn.addEventListener('click', () => {
        const email = emailInput.value;
        const password = passwordInput.value;
        
        // 이메일 또는 비밀번호가 비어 있는지 확인
        if (!email || !password) {
            errorMessage.textContent = '이메일과 비밀번호를 모두 입력해주세요.';
            errorMessage.style.display = 'block';
            return;
        }

        errorMessage.style.display = 'none';

        auth.signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // 로그인 성공, admin.html로 이동
                console.log('로그인 성공:', userCredential.user);
                window.location.replace('/admin.html');
            })
            .catch((error) => {
                // 로그인 실패
                console.error('로그인 에러:', error);
                errorMessage.textContent = '이메일 또는 비밀번호가 잘못되었습니다.';
                errorMessage.style.display = 'block';
            });
    });

    // Enter 키로 로그인 시도
    passwordInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            loginBtn.click();
        }
    });
});