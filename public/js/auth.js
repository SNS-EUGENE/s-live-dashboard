/* public/js/auth.js */

/**
 * 사용자가 로그인되어 있는지 확인하고, 로그아웃 상태이면 지정된 페이지로 리디렉션합니다.
 * @param {string} [redirectPage='/index.html'] 로그아웃 상태일 때 리디렉션할 경로
 */
function checkUserLoggedIn(redirectPage = '/index.html') {
    auth.onAuthStateChanged(user => {
        if (!user) {
            console.log("로그인되지 않은 접근, 로그인 페이지로 리디렉션합니다.");
            window.location.replace(redirectPage);
        }
    });
}

/**
 * 사용자가 이미 로그인되어 있는지 확인하고, 로그인 상태이면 지정된 페이지로 리디렉션합니다.
 * @param {string} [redirectPage='/admin.html'] 로그인 상태일 때 리디렉션할 경로
 */
function checkUserNotLoggedIn(redirectPage = '/admin.html') {
    auth.onAuthStateChanged(user => {
        if (user) {
            console.log("이미 로그인된 사용자, 관리자 페이지로 리디렉션합니다.");
            window.location.replace(redirectPage);
        }
    });
}