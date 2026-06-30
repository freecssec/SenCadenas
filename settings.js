// ═══════════════════════════════════════════
//   SENCADENAS — settings.js
// ═══════════════════════════════════════════
'use strict';

const $ = (id) => document.getElementById(id);
const show = (el) => el?.classList.remove('hidden');
const hide = (el) => el?.classList.add('hidden');

// ── Toast ──────────────────────────────────
function showToast(msg, duration = 2400) {
    const toast = $('toast');
    $('toast-text').textContent = msg;
    show(toast);
    clearTimeout(toast._t);
    toast._t = setTimeout(() => hide(toast), duration);
}

// ── Navigation sections ────────────────────
const sectionTitles = {
    profile:  'Profil',
    security: 'Sécurité',
    twofa:    'Double authentification',
    sessions: 'Sessions actives',
    danger:   'Zone de danger',
};

function switchSection(key) {
    document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item[data-section]').forEach(b => b.classList.remove('active'));
    $(`section-${key}`)?.classList.add('active');
    document.querySelector(`.nav-item[data-section="${key}"]`)?.classList.add('active');
    $('topbar-title').textContent = `Paramètres — ${sectionTitles[key]}`;
}

// ── Toggle password ────────────────────────
document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
        const inp = $(btn.dataset.target);
        if (!inp) return;
        inp.type = inp.type === 'password' ? 'text' : 'password';
        btn.querySelector('.eye-icon').style.opacity = inp.type === 'text' ? '0.5' : '1';
    });
});

// ── Jauge force mot de passe ───────────────
function calcStrength(pwd) {
    if (!pwd) return { pct: 0, label: '—', cls: '' };
    let charsetSize = 0;
    if (/[a-z]/.test(pwd)) charsetSize += 26;
    if (/[A-Z]/.test(pwd)) charsetSize += 26;
    if (/[0-9]/.test(pwd)) charsetSize += 10;
    if (/[^a-zA-Z0-9]/.test(pwd)) charsetSize += 32;
    const entropy = pwd.length * Math.log2(charsetSize || 26);
    const common = ['password','azerty','sencadenas','motdepasse','admin','qwerty','123456'];
    if (common.some(c => pwd.toLowerCase().includes(c)))
        return { pct: 8, label: '❌ Trop commun', cls: 'weak' };
    if (pwd.length < 8)   return { pct: 12, label: '😬 Trop court',  cls: 'weak'   };
    if (entropy < 40)     return { pct: 28, label: '😬 Faible',      cls: 'weak'   };
    if (entropy < 60)     return { pct: 50, label: '🟡 Moyen',       cls: 'fair'   };
    if (entropy < 80)     return { pct: 70, label: '🔵 Bien',        cls: 'good'   };
    if (entropy < 100)    return { pct: 85, label: '✅ Fort',        cls: 'strong' };
    return { pct: 100, label: '🔒 Excellent', cls: 'strong' };
}

function updateStrength(pwd, fillId, labelId) {
    const s = calcStrength(pwd);
    const fill  = $(fillId);
    const label = $(labelId);
    if (!fill || !label) return;
    fill.style.width  = s.pct + '%';
    fill.className    = 'strength-fill ' + s.cls;
    label.textContent = s.label;
}

$('s-new-pwd')?.addEventListener('input', e => {
    updateStrength(e.target.value, 's-strength-fill', 's-strength-label');
    // Vérif confirmation en temps réel
    const confirm = $('s-confirm-pwd')?.value;
    if (confirm) checkConfirm();
});

$('s-confirm-pwd')?.addEventListener('input', checkConfirm);

function checkConfirm() {
    const pwd     = $('s-new-pwd')?.value || '';
    const confirm = $('s-confirm-pwd')?.value || '';
    const err     = $('s-confirm-err');
    if (!err) return true;
    if (confirm && confirm !== pwd) {
        err.textContent = 'Les mots de passe ne correspondent pas.';
        return false;
    }
    err.textContent = '';
    return true;
}

// ── Profil : enregistrer ──────────────────
$('save-profile-btn')?.addEventListener('click', () => {
    const name  = $('p-fullname')?.value.trim();
    const email = $('p-email')?.value.trim();
    if (!name || !email) { showToast('⚠️ Remplissez tous les champs'); return; }
    // Mettre à jour l'affichage avatar
    $('avatar-display').textContent    = name.charAt(0).toUpperCase();
    $('avatar-name-display').textContent  = name;
    $('avatar-email-display').textContent = email;
    // TODO: appel API PATCH /api/user
    showToast('✅ Profil mis à jour');
});

// ── Sécurité : changer mot de passe ──────
$('save-pwd-btn')?.addEventListener('click', () => {
    const current = $('s-current-pwd')?.value || '';
    const newPwd  = $('s-new-pwd')?.value     || '';
    const confirm = $('s-confirm-pwd')?.value || '';

    if (!current) { showToast('⚠️ Saisissez le mot de passe actuel'); return; }
    if (newPwd.length < 15) { showToast('⚠️ Minimum 15 caractères (NIST)'); return; }
    if (!checkConfirm()) return;
    if (newPwd === current) { showToast('⚠️ Le nouveau mot de passe doit être différent'); return; }

    // TODO: appel API POST /api/change-password
    showToast('✅ Mot de passe maître mis à jour');
    $('s-current-pwd').value = '';
    $('s-new-pwd').value     = '';
    $('s-confirm-pwd').value = '';
    updateStrength('', 's-strength-fill', 's-strength-label');
});

// ── 2FA ────────────────────────────────────
let twofaEnabled = false;

$('twofa-toggle-btn')?.addEventListener('click', () => {
    if (twofaEnabled) {
        // Désactiver
        openConfirm({
            title:   'Désactiver le 2FA ?',
            message: 'Votre compte sera moins protégé. Vous pourrez le réactiver à tout moment.',
            keyword: 'DÉSACTIVER',
            onConfirm: () => {
                twofaEnabled = false;
                update2FAStatus();
                showToast('✅ Double authentification désactivée');
            }
        });
    } else {
        // Afficher le setup
        show($('twofa-setup-card'));
        $('twofa-toggle-btn').textContent = 'Annuler';
    }
});

$('twofa-cancel-btn')?.addEventListener('click', () => {
    hide($('twofa-setup-card'));
    $('twofa-toggle-btn').textContent = 'Activer le 2FA';
    resetOTP();
});

$('copy-secret-btn')?.addEventListener('click', async () => {
    const secret = $('totp-secret')?.textContent || '';
    await navigator.clipboard.writeText(secret.replace(/\s/g,'')).catch(()=>{});
    showToast('✅ Clé TOTP copiée');
});

// Vérifier le code OTP
$('twofa-verify-btn')?.addEventListener('click', () => {
    const digits = [...document.querySelectorAll('.otp-digit')].map(i => i.value).join('');
    if (digits.length < 6) {
        showOTPError('Entrez les 6 chiffres.');
        return;
    }
    // TODO: vérifier avec le backend
    // Simulation : code "123456" valide
    if (digits === '123456' || digits.length === 6) {
        twofaEnabled = true;
        hide($('twofa-setup-card'));
        update2FAStatus();
        resetOTP();
        showToast('🔐 2FA activé avec succès !');
    } else {
        showOTPError('Code invalide. Réessayez.');
    }
});

function update2FAStatus() {
    const icon  = $('twofa-icon');
    const title = $('twofa-status-title');
    const desc  = $('twofa-status-desc');
    const btn   = $('twofa-toggle-btn');
    if (twofaEnabled) {
        icon.className  = 'twofa-status-icon on';
        icon.innerHTML  = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>`;
        title.textContent = '2FA activé ✅';
        desc.textContent  = 'Votre compte est protégé par une double authentification.';
        btn.textContent   = 'Désactiver le 2FA';
        btn.className     = 'btn-outline danger-outline';
    } else {
        icon.className  = 'twofa-status-icon off';
        icon.innerHTML  = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>`;
        title.textContent = '2FA désactivé';
        desc.textContent  = 'Votre compte n\'est protégé que par votre mot de passe maître.';
        btn.textContent   = 'Activer le 2FA';
        btn.className     = 'btn-primary';
    }
}

// OTP inputs — navigation auto entre les champs
document.querySelectorAll('.otp-digit').forEach((input, i, all) => {
    input.addEventListener('input', () => {
        input.value = input.value.replace(/\D/g, '').slice(-1);
        if (input.value) {
            input.classList.add('filled');
            if (i < all.length - 1) all[i + 1].focus();
        } else {
            input.classList.remove('filled');
        }
        hide($('otp-error'));
        input.classList.remove('error');
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && i > 0) {
            all[i - 1].focus();
        }
    });
    // Coller un code d'un coup
    input.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text').replace(/\D/g,'').slice(0, 6);
        text.split('').forEach((ch, j) => {
            if (all[j]) { all[j].value = ch; all[j].classList.add('filled'); }
        });
        if (all[text.length - 1]) all[Math.min(text.length, all.length-1)].focus();
    });
});

function showOTPError(msg) {
    const err = $('otp-error');
    err.textContent = msg;
    show(err);
    document.querySelectorAll('.otp-digit').forEach(i => i.classList.add('error'));
    setTimeout(() => document.querySelectorAll('.otp-digit').forEach(i => i.classList.remove('error')), 800);
}

function resetOTP() {
    document.querySelectorAll('.otp-digit').forEach(i => { i.value=''; i.classList.remove('filled','error'); });
    hide($('otp-error'));
}

// ── Sessions ───────────────────────────────
const SESSIONS = [
    { id: 's1', device: 'Chrome · Windows 11', location: 'Dakar, Sénégal', ip: '154.66.xx.xx', time: 'Session actuelle', current: true,  icon: 'desktop' },
    { id: 's2', device: 'Safari · iPhone 15',  location: 'Dakar, Sénégal', ip: '154.66.xx.xx', time: 'Il y a 2 heures',  current: false, icon: 'mobile' },
    { id: 's3', device: 'Firefox · Ubuntu',    location: 'Thiès, Sénégal', ip: '197.xx.xx.xx', time: 'Hier à 18h42',     current: false, icon: 'desktop' },
];

function renderSessions() {
    const list = $('sessions-list');
    if (!list) return;
    list.innerHTML = SESSIONS.map(s => `
        <div class="session-row" id="session-${s.id}">
            <div class="session-icon">
                ${s.icon === 'mobile'
                    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>`
                    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`}
            </div>
            <div class="session-info">
                <div class="session-device">
                    ${s.device}
                    ${s.current ? '<span class="session-current-badge">Actuel</span>' : ''}
                </div>
                <div class="session-meta">${s.location} · ${s.ip} · ${s.time}</div>
            </div>
            ${!s.current ? `<button class="session-revoke" data-id="${s.id}">Révoquer</button>` : ''}
        </div>
    `).join('');

    list.querySelectorAll('.session-revoke').forEach(btn => {
        btn.addEventListener('click', () => {
            const id  = btn.dataset.id;
            const row = $(`session-${id}`);
            if (row) { row.style.opacity='0'; row.style.transition='opacity 0.3s'; setTimeout(()=>row.remove(), 300); }
            showToast('✅ Session révoquée');
        });
    });
}

$('revoke-all-btn')?.addEventListener('click', () => {
    openConfirm({
        title:   'Déconnecter tous les autres appareils ?',
        message: 'Toutes les autres sessions seront immédiatement fermées. Vous resterez connecté sur cet appareil.',
        keyword: 'DÉCONNECTER',
        onConfirm: () => {
            document.querySelectorAll('.session-row:not(:first-child)').forEach(r => r.remove());
            showToast('✅ Toutes les autres sessions ont été révoquées');
        }
    });
});

// ── Zone de danger ─────────────────────────
$('export-btn')?.addEventListener('click', () => {
    // Exporter le coffre (simulé)
    const vault = JSON.parse(localStorage.getItem('sc_vault_v1') || '[]');
    const data  = JSON.stringify({ exported_at: new Date().toISOString(), entries: vault }, null, 2);
    const blob  = new Blob([data], { type: 'application/json' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href      = url;
    a.download  = `sencadenas-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ Coffre exporté');
});

$('clear-vault-btn')?.addEventListener('click', () => {
    openConfirm({
        title:   'Vider le coffre ?',
        message: 'Tous vos mots de passe, cartes et notes seront supprimés définitivement. Cette action est irréversible.',
        keyword: 'VIDER',
        onConfirm: () => {
            localStorage.removeItem('sc_vault_v1');
            showToast('🗑️ Coffre vidé');
        }
    });
});

$('delete-account-btn')?.addEventListener('click', () => {
    openConfirm({
        title:   'Supprimer votre compte ?',
        message: 'Toutes vos données seront effacées de nos serveurs de façon permanente. Cette action est totalement irréversible.',
        keyword: 'SUPPRIMER',
        onConfirm: () => {
            localStorage.clear();
            showToast('Compte supprimé. Redirection...');
            setTimeout(() => window.location.href = 'index.html', 1500);
        }
    });
});

// ── Modal confirmation ─────────────────────
let confirmCallback = null;

function openConfirm({ title, message, keyword, onConfirm }) {
    $('confirm-title').textContent   = title;
    $('confirm-message').textContent = message;
    $('confirm-keyword').textContent = keyword;
    $('confirm-input').value = '';
    $('confirm-ok').disabled = true;
    confirmCallback = onConfirm;
    show($('confirm-overlay'));
    setTimeout(() => $('confirm-input')?.focus(), 100);
}

$('confirm-input')?.addEventListener('input', (e) => {
    const keyword = $('confirm-keyword')?.textContent || '';
    $('confirm-ok').disabled = e.target.value !== keyword;
});

$('confirm-ok')?.addEventListener('click', () => {
    hide($('confirm-overlay'));
    confirmCallback?.();
    confirmCallback = null;
});

['confirm-close','confirm-cancel'].forEach(id => {
    $(id)?.addEventListener('click', () => {
        hide($('confirm-overlay'));
        confirmCallback = null;
    });
});

$('confirm-overlay')?.addEventListener('click', (e) => {
    if (e.target === $('confirm-overlay')) {
        hide($('confirm-overlay'));
        confirmCallback = null;
    }
});

// ── Sidebar & init ─────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    renderSessions();

    // Nav sections
    document.querySelectorAll('.nav-item[data-section]').forEach(btn => {
        btn.addEventListener('click', () => switchSection(btn.dataset.section));
    });

    // Sidebar collapse
    $('sidebar-collapse')?.addEventListener('click', () => {
        $('sidebar').classList.toggle('collapsed');
    });

    // Mobile menu
    $('mobile-menu-btn')?.addEventListener('click', () => {
        $('sidebar').classList.toggle('mobile-open');
    });

    // Logout
    $('logout-btn')?.addEventListener('click', () => {
        if (confirm('Se déconnecter ?')) window.location.href = 'login.html';
    });

    // Escape ferme les modals
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !$('confirm-overlay')?.classList.contains('hidden')) {
            hide($('confirm-overlay'));
            confirmCallback = null;
        }
    });
});