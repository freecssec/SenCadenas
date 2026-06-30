//   SENCADENAS — auth.js
//   Inscription connectée au backend Django

const API_URL = 'http://127.0.0.1:8000/api';

//Utilitaires 
const $ = (id) => document.getElementById(id);
const show = (el) => el?.classList.remove('hidden');
const hide = (el) => el?.classList.add('hidden');

function setError(inputId, errId, msg) {
    const input = document.getElementById(inputId);
    const err   = document.getElementById(errId);
    if (!input || !err) return;
    input.classList.add('invalid');
    input.classList.remove('valid');
    err.textContent = msg;
}

function clearError(inputId, errId) {
    const input = document.getElementById(inputId);
    const err   = document.getElementById(errId);
    if (!input || !err) return;
    input.classList.remove('invalid');
    input.classList.add('valid');
    err.textContent = '';
}

function showAlert(msg, type) {
    const box  = document.getElementById('alert-box');
    const text = document.getElementById('alert-text');
    if (!box || !text) return;
    text.textContent = msg;
    box.className = 'auth-alert' + (type === 'success' ? ' success' : '');
    box.classList.remove('hidden');
}

function hideAlert() {
    const box = document.getElementById('alert-box');
    if (box) box.classList.add('hidden');
}

function saveTokens(access, refresh) {
    sessionStorage.setItem('sc_access',  access);
    sessionStorage.setItem('sc_refresh', refresh);
}

// Toggle mdp 
document.querySelectorAll('.toggle-password').forEach(function(btn) {
    btn.addEventListener('click', function() {
        const input = document.getElementById(btn.dataset.target);
        if (!input) return;
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        btn.querySelector('.eye-icon').style.opacity = isPassword ? '0.5' : '1';
    });
});

//Tooltip
const hintToggle = document.getElementById('hint-toggle');
const masterHint = document.getElementById('master-hint');
if (hintToggle && masterHint) {
    hintToggle.addEventListener('click', function() {
        masterHint.classList.toggle('hidden');
    });
}

//Jauge force (NIST)
function evaluateStrength(pwd) {
    if (!pwd) return { pct: 0, label: 'Entrez un mot de passe', cls: '' };
    let charsetSize = 0;
    if (/[a-z]/.test(pwd)) charsetSize += 26;
    if (/[A-Z]/.test(pwd)) charsetSize += 26;
    if (/[0-9]/.test(pwd)) charsetSize += 10;
    if (/[^a-zA-Z0-9]/.test(pwd)) charsetSize += 32;
    const entropy = pwd.length * Math.log2(charsetSize || 26);
    const common = ['password','123456','azerty','sencadenas','motdepasse','admin'];
    if (common.some(function(c) { return pwd.toLowerCase().includes(c); }))
        return { pct: 8,  label: '❌ Trop commun', cls: 'weak' };
    if (pwd.length < 8)  return { pct: 12, label: '😬 Trop court', cls: 'weak'   };
    if (entropy < 40)    return { pct: 28, label: '😬 Faible',     cls: 'weak'   };
    if (entropy < 60)    return { pct: 50, label: '🟡 Moyen',      cls: 'fair'   };
    if (entropy < 80)    return { pct: 70, label: '🔵 Bien',       cls: 'good'   };
    if (entropy < 100)   return { pct: 85, label: '✅ Fort',       cls: 'strong' };
    return { pct: 100, label: '🔒 Excellent', cls: 'strong' };
}

function updateStrengthMeter(pwd) {
    const fill  = document.getElementById('strength-fill');
    const label = document.getElementById('strength-label');
    if (!fill || !label) return;
    const s = evaluateStrength(pwd);
    fill.style.width  = s.pct + '%';
    fill.className    = 'strength-fill ' + s.cls;
    label.textContent = s.label;
}

const masterPwdInput = document.getElementById('master-password');
if (masterPwdInput) {
    masterPwdInput.addEventListener('input', function() {
        updateStrengthMeter(masterPwdInput.value);
        if (masterPwdInput.value.length >= 15)
            clearError('master-password', 'err-password');
    });
}

//Validation temps réel
const emailInput = document.getElementById('email');
if (emailInput) {
    emailInput.addEventListener('blur', function() {
        const val = emailInput.value.trim();
        const re  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!val || !re.test(val)) setError('email', 'err-email', 'Adresse e-mail invalide.');
        else clearError('email', 'err-email');
    });
}

const confirmInput = document.getElementById('confirm-password');
if (confirmInput) {
    confirmInput.addEventListener('input', function() {
        const pwd = masterPwdInput ? masterPwdInput.value : '';
        if (confirmInput.value && confirmInput.value !== pwd)
            setError('confirm-password', 'err-confirm', 'Les mots de passe ne correspondent pas.');
        else if (confirmInput.value)
            clearError('confirm-password', 'err-confirm');
    });
}

//Loading state
function setLoadingState(loading) {
    const btn     = document.getElementById('submit-btn');
    const text    = document.getElementById('btn-text');
    const arrow   = document.getElementById('btn-arrow');
    const spinner = document.getElementById('btn-spinner');
    if (!btn) return;
    btn.disabled = loading;
    if (loading) {
        if (arrow)   arrow.classList.add('hidden');
        if (spinner) spinner.classList.remove('hidden');
        if (text)    text.textContent = 'Création en cours...';
        btn.style.opacity = '0.8';
    } else {
        if (arrow)   arrow.classList.remove('hidden');
        if (spinner) spinner.classList.add('hidden');
        if (text)    text.textContent = 'Créer mon coffre';
        btn.style.opacity = '1';
    }
}

//Soumission
const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        hideAlert();

        const fullname = (document.getElementById('fullname')?.value || '').trim();
        const email    = (document.getElementById('email')?.value    || '').trim();
        const password = document.getElementById('master-password')?.value  || '';
        const confirm  = document.getElementById('confirm-password')?.value || '';
        const terms    = document.getElementById('terms')?.checked;

        let hasError = false;
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!fullname || fullname.length < 2) {
            setError('fullname', 'err-fullname', 'Nom complet requis.');
            hasError = true;
        }
        if (!email || !emailRe.test(email)) {
            setError('email', 'err-email', 'Adresse e-mail invalide.');
            hasError = true;
        }
        if (!password || password.length < 15) {
            setError('master-password', 'err-password', 'Minimum 15 caractères (NIST SP 800-63B).');
            hasError = true;
        }
        if (!confirm || confirm !== password) {
            setError('confirm-password', 'err-confirm', 'Les mots de passe ne correspondent pas.');
            hasError = true;
        }
        if (!terms) {
            const errTerms = document.getElementById('err-terms');
            if (errTerms) errTerms.textContent = 'Vous devez accepter les conditions.';
            hasError = true;
        } else {
            const errTerms = document.getElementById('err-terms');
            if (errTerms) errTerms.textContent = '';
        }

        if (hasError) return;

        setLoadingState(true);

        try {
            const nameParts = fullname.split(' ');
            const firstName = nameParts[0];
            const lastName  = nameParts.slice(1).join(' ');

            const response = await fetch(API_URL + '/auth/register/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    first_name:       firstName,
                    last_name:        lastName,
                    email:            email,
                    password:         password,
                    password_confirm: confirm,
                })
            });

            const data = await response.json();

            if (!response.ok) {
                const firstError = Object.values(data)[0];
                const msg = Array.isArray(firstError) ? firstError[0] : firstError;
                showAlert(msg || 'Une erreur est survenue.');
                return;
            }

            // Sauvegarder les tokens JWT
            saveTokens(data.tokens.access, data.tokens.refresh);
            sessionStorage.setItem('sc_user', JSON.stringify(data.user));

            showAlert('Compte créé avec succès ! Redirection...', 'success');
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