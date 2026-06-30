//   SENCADENAS — login.js
//   Connexion connectée au backend Django

const API_URL = 'http://127.0.0.1:8000/api';

const $ = (id) => document.getElementById(id);
const show = (el) => el?.classList.remove('hidden');
const hide = (el) => el?.classList.add('hidden');

function showAlert(msg, type) {
    const box  = $('alert-box');
    const text = $('alert-text');
    if (!box || !text) return;
    text.textContent = msg;
    box.className = 'auth-alert' + (type === 'success' ? ' success' : '');
    show(box);
}
function hideAlert() { hide($('alert-box')); }

function setFieldError(inputId, errId, msg) {
    $(inputId)?.classList.add('invalid');
    $(inputId)?.classList.remove('valid');
    if ($(errId)) $(errId).textContent = msg;
}
function clearFieldError(inputId, errId) {
    $(inputId)?.classList.remove('invalid');
    $(inputId)?.classList.add('valid');
    if ($(errId)) $(errId).textContent = '';
}

function saveTokens(access, refresh) {
    sessionStorage.setItem('sc_access',  access);
    sessionStorage.setItem('sc_refresh', refresh);
}

//Toggle mdp
document.querySelectorAll('.toggle-password').forEach(function(btn) {
    btn.addEventListener('click', function() {
        const input = $(btn.dataset.target);
        if (!input) return;
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        btn.querySelector('.eye-icon').style.opacity = isPassword ? '0.5' : '1';
    });
});

//Gestion tentatives
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS   = 2 * 60 * 1000;
const STORAGE_KEY  = 'sc_login_attempts';

function getAttemptData() {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : { count: 0, lockedUntil: null };
    } catch { return { count: 0, lockedUntil: null }; }
}

function saveAttemptData(data) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function resetAttempts() { sessionStorage.removeItem(STORAGE_KEY); }

function isLocked() {
    const data = getAttemptData();
    if (!data.lockedUntil) return false;
    if (Date.now() < data.lockedUntil) return true;
    resetAttempts();
    return false;
}

function recordFailedAttempt() {
    const data = getAttemptData();
    data.count++;
    if (data.count >= MAX_ATTEMPTS) data.lockedUntil = Date.now() + LOCKOUT_MS;
    saveAttemptData(data);
    return data;
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return m + ':' + s;
}

function showLockedState() {
    const data = getAttemptData();
    const form = $('login-form');
    if (!form) return;
    form.innerHTML = '<div class="locked-state">'
        + '<span class="lock-emoji">🔒</span>'
        + '<h3>Compte temporairement bloqué</h3>'
        + '<p>Trop de tentatives échouées. Patientez quelques minutes.</p>'
        + '<p class="countdown">Déblocage dans : <strong id="countdown-display">'
        + formatTime(Math.ceil((data.lockedUntil - Date.now()) / 1000))
        + '</strong></p></div>';

    const timer = setInterval(function() {
        const left = Math.ceil((data.lockedUntil - Date.now()) / 1000);
        const display = $('countdown-display');
        if (left <= 0) {
            clearInterval(timer);
            resetAttempts();
            location.reload();
        } else if (display) {
            display.textContent = formatTime(left);
        }
    }, 1000);
}

function updateAttemptsWarning(remaining) {
    const warning = $('attempts-warning');
    const countEl = $('attempts-count');
    if (!warning || !countEl) return;
    if (remaining < MAX_ATTEMPTS && remaining > 0) {
        show(warning);
        countEl.textContent = remaining;
    } else {
        hide(warning);
    }
}

//Loading state
function setLoadingState(loading) {
    const btn     = $('submit-btn');
    const text    = $('btn-text');
    const arrow   = $('btn-arrow');
    const spinner = $('btn-spinner');
    if (!btn) return;
    btn.disabled = loading;
    if (loading) {
        hide(arrow); show(spinner);
        if (text) text.textContent = 'Vérification...';
        btn.style.opacity = '0.8';
    } else {
        show(arrow); hide(spinner);
        if (text) text.textContent = 'Ouvrir mon coffre';
        btn.style.opacity = '1';
    }
}

//Init
window.addEventListener('DOMContentLoaded', function() {
    if (isLocked()) { showLockedState(); return; }
    updateAttemptsWarning(MAX_ATTEMPTS - getAttemptData().count);
});

//Validation temps réel
$('email')?.addEventListener('blur', function() {
    const val = $('email').value.trim();
    const re  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!val || !re.test(val)) setFieldError('email', 'err-email', 'Adresse e-mail invalide.');
    else clearFieldError('email', 'err-email');
});

$('master-password')?.addEventListener('input', function() {
    if ($('master-password').value.length > 0)
        clearFieldError('master-password', 'err-password');
});

//Soumission
const loginForm = $('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        hideAlert();

        if (isLocked()) { showLockedState(); return; }

        const email    = ($('email')?.value    || '').trim();
        const password = $('master-password')?.value || '';

        let hasError = false;
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!email || !emailRe.test(email)) {
            setFieldError('email', 'err-email', 'Adresse e-mail invalide.');
            hasError = true;
        }
        if (!password) {
            setFieldError('master-password', 'err-password', 'Le mot de passe est requis.');
            hasError = true;
        }
        if (hasError) return;

        setLoadingState(true);

        try {
            const response = await fetch(API_URL + '/auth/login/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, password: password })
            });

            const data = await response.json();

            if (!response.ok) {
                const attempt = recordFailedAttempt();
                const remaining = MAX_ATTEMPTS - attempt.count;
                if (attempt.count >= MAX_ATTEMPTS) {
                    showLockedState();
                } else {
                    showAlert(data.error || 'Identifiants incorrects.');
                    updateAttemptsWarning(remaining);
                }
                return;
            }

            // Succès
            resetAttempts();
            saveTokens(data.tokens.access, data.tokens.refresh);
            sessionStorage.setItem('sc_user', JSON.stringify(data.user));

            showAlert('Connexion réussie ! Ouverture du coffre...', 'success');
            setTimeout(function() {
                window.location.href = 'dashboard.html';
            }, 1200);

        } catch (err) {
            showAlert('Impossible de contacter le serveur. Vérifiez que le backend est lancé.');
        } finally {
            setLoadingState(false);
        }
    });
}