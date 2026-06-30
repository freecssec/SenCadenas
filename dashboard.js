//   SENCADENAS — dashboard.js
//   Coffre connecté au backend Django

'use strict';

const API_URL = 'http://127.0.0.1:8000/api';

//Utilitaires
const $ = (id) => document.getElementById(id);
const show = (el) => el?.classList.remove('hidden');
const hide = (el) => el?.classList.add('hidden');

//Auth helpers
function getAccessToken()  { return sessionStorage.getItem('sc_access');  }
function getRefreshToken() { return sessionStorage.getItem('sc_refresh'); }
function getUser()         {
    try { return JSON.parse(sessionStorage.getItem('sc_user') || 'null'); }
    catch { return null; }
}

function saveTokens(access, refresh) {
    sessionStorage.setItem('sc_access',  access);
    sessionStorage.setItem('sc_refresh', refresh);
}

function logout() {
    sessionStorage.clear();
    window.location.href = 'login.html';
}

// Requête API avec token JWT
async function apiFetch(endpoint, options) {
    options = options || {};
    const token = getAccessToken();

    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (token) headers['Authorization'] = 'Bearer ' + token;

    let response = await fetch(API_URL + endpoint, Object.assign({}, options, { headers }));

    // Token expiré → essayer de le rafraîchir
    if (response.status === 401) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
            headers['Authorization'] = 'Bearer ' + getAccessToken();
            response = await fetch(API_URL + endpoint, Object.assign({}, options, { headers }));
        } else {
            logout();
            return null;
        }
    }

    return response;
}

//Rafraîchir le token JWT
async function refreshAccessToken() {
    const refresh = getRefreshToken();
    if (!refresh) return false;
    try {
        const res = await fetch(API_URL + '/auth/refresh/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh })
        });
        if (!res.ok) return false;
        const data = await res.json();
        saveTokens(data.access, data.refresh || refresh);
        return true;
    } catch { return false; }
}

//Toast
function showToast(msg, duration) {
    duration = duration || 2200;
    const toast = $('toast');
    $('toast-text').textContent = msg;
    show(toast);
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function() { hide(toast); }, duration);
}

//Copie presse-papier
async function copyToClipboard(text, label) {
    label = label || 'Copié !';
    try {
        await navigator.clipboard.writeText(text);
        showToast('✅ ' + label);
    } catch {
        showToast('❌ Impossible de copier');
    }
}

//   DONNÉES — chargées depuis le backend

let vault = [];
let currentFilter   = 'all';
let currentSearch   = '';
let editingId       = null;
let currentModalType = 'login';

//Charger le coffre depuis l'API
async function loadVault() {
    try {
        const res = await apiFetch('/vault/');
        if (!res || !res.ok) return;
        const data = await res.json();
        // DRF retourne soit un tableau, soit { results: [...] }
        vault = Array.isArray(data) ? data : (data.results || []);
        render();
    } catch (err) {
        showToast('❌ Erreur de chargement du coffre');
        console.error(err);
    }
}

//Mapper les données backend → frontend
function mapEntry(e) {
    return {
        id:         e.id,
        type:       e.type,
        name:       e.name,
        favorite:   e.favorite,
        username:   e.username   || '',
        password:   e.password   || '',
        url:        e.url        || '',
        cardHolder: e.card_holder || '',
        cardNumber: e.card_number || '',
        expiry:     e.expiry     || '',
        cvv:        e.cvv        || '',
        note:       e.note       || '',
        createdAt:  e.created_at,
    };
}

//   FORCE DU MOT DE PASSE (NIST)

function calcStrength(pwd) {
    if (!pwd) return { score: 0, label: '—', cls: '', pct: 0 };
    let charsetSize = 0;
    if (/[a-z]/.test(pwd)) charsetSize += 26;
    if (/[A-Z]/.test(pwd)) charsetSize += 26;
    if (/[0-9]/.test(pwd)) charsetSize += 10;
    if (/[^a-zA-Z0-9]/.test(pwd)) charsetSize += 32;
    const entropy = pwd.length * Math.log2(charsetSize || 26);
    const common  = ['password','123456','azerty','sencadenas','motdepasse','admin','qwerty'];
    if (common.some(function(c) { return pwd.toLowerCase().includes(c); }))
        return { score: 10, label: '❌ Trop commun', cls: 'weak',   pct: 8   };
    if (pwd.length < 8)   return { score: 15, label: '😬 Trop court', cls: 'weak',   pct: 12  };
    if (entropy < 40)     return { score: 30, label: '😬 Faible',     cls: 'weak',   pct: 28  };
    if (entropy < 60)     return { score: 50, label: '🟡 Moyen',      cls: 'fair',   pct: 50  };
    if (entropy < 80)     return { score: 70, label: '🔵 Bien',       cls: 'good',   pct: 70  };
    if (entropy < 100)    return { score: 85, label: '✅ Fort',       cls: 'strong', pct: 85  };
    return { score: 100, label: '🔒 Excellent', cls: 'strong', pct: 100 };
}

function updateStrengthMeter(pwd, fillId, labelId) {
    const fill  = $(fillId);
    const label = $(labelId);
    if (!fill || !label) return;
    const s = calcStrength(pwd);
    fill.style.width  = s.pct + '%';
    fill.className    = 'strength-fill ' + s.cls;
    label.textContent = s.label || '—';
}

function getStrengthBadge(pwd) {
    const s = calcStrength(pwd);
    return '<span class="strength-badge ' + s.cls + '">' + s.label + '</span>';
}

//   COULEURS ICÔNES
const BRAND_COLORS = {
    facebook:'#1877f2', fb:'#1877f2', instagram:'#e4405f', ig:'#e4405f',
    gmail:'#ea4335', google:'#4285f4', wave:'#ff6600', twitter:'#1da1f2',
    linkedin:'#0077b5', github:'#333', netflix:'#e50914', amazon:'#ff9900',
    whatsapp:'#25d366', telegram:'#229ed9', paypal:'#003087',
};

function getIconColor(name) {
    const key = (name || '').toLowerCase().split(/[\s.]/)[0];
    return BRAND_COLORS[key] || stringToColor(name);
}

function stringToColor(str) {
    let hash = 0;
    for (const c of (str || '')) hash = c.charCodeAt(0) + ((hash << 5) - hash);
    return 'hsl(' + (Math.abs(hash) % 360) + ', 50%, 38%)';
}

function getIconLabel(entry) {
    if (entry.type === 'note') return '📝';
    return (entry.name || '??').slice(0, 2).toUpperCase();
}

//   RENDU

function escAttr(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function escHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getFilteredEntries() {
    return vault.map(mapEntry).filter(function(e) {
        const matchFilter =
            currentFilter === 'all'      ? true :
            currentFilter === 'favorite' ? e.favorite :
            e.type === currentFilter;
        const q = currentSearch.toLowerCase();
        const matchSearch = !q ||
            e.name.toLowerCase().includes(q) ||
            (e.username || '').toLowerCase().includes(q);
        return matchFilter && matchSearch;
    });
}

function sortEntries(entries) {
    const sort = $('sort-select') ? $('sort-select').value : 'name';
    return entries.slice().sort(function(a, b) {
        if (sort === 'name')      return a.name.localeCompare(b.name);
        if (sort === 'name-desc') return b.name.localeCompare(a.name);
        if (sort === 'recent')    return new Date(b.createdAt) - new Date(a.createdAt);
        if (sort === 'strength') {
            const sa = a.password ? calcStrength(a.password).score : 0;
            const sb = b.password ? calcStrength(b.password).score : 0;
            return sb - sa;
        }
        return 0;
    });
}

function renderEntries() {
    const filtered = sortEntries(getFilteredEntries());
    const list     = $('entries-list');
    const empty    = $('empty-state');

    $('entries-count-label').textContent = filtered.length + ' élément' + (filtered.length > 1 ? 's' : '');

    if (filtered.length === 0) {
        list.innerHTML = '';
        show(empty);
        return;
    }
    hide(empty);

    list.innerHTML = filtered.map(function(e, i) {
        const sub = e.type === 'login' ? (e.username || e.url || '') :
                    e.type === 'card'  ? ('•••• •••• •••• ' + (e.cardNumber || '').slice(-4)) :
                    'Note sécurisée';
        const strengthHTML = e.type === 'login' && e.password ? getStrengthBadge(e.password) : '';
        const favHTML      = e.favorite ? '<span class="fav-star">⭐</span>' : '';
        const color        = getIconColor(e.name);
        const label        = getIconLabel(e);
        const copyBtn      = e.type === 'login'
            ? '<button class="entry-action-btn copy" title="Copier le mot de passe" data-action="copy" data-id="' + escAttr(String(e.id)) + '">'
            + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>'
            + '</button>' : '';

        return '<div class="entry-row" data-id="' + escAttr(String(e.id)) + '" style="animation-delay:' + (i * 0.04) + 's">'
            + '<div class="entry-row-icon" style="background:' + color + '">' + label + '</div>'
            + '<div class="entry-row-info">'
            + '<div class="entry-row-name">' + escHtml(e.name) + '</div>'
            + '<div class="entry-row-sub">'  + escHtml(sub)    + '</div>'
            + '</div>'
            + '<div class="entry-row-meta">'
            + strengthHTML + favHTML
            + '<div class="entry-row-actions">'
            + copyBtn
            + '<button class="entry-action-btn delete" title="Supprimer" data-action="delete" data-id="' + escAttr(String(e.id)) + '">'
            + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>'
            + '</button>'
            + '</div></div></div>';
    }).join('');
}

function updateCounts() {
    const mapped = vault.map(mapEntry);
    $('count-all').textContent   = vault.length;
    $('count-fav').textContent   = mapped.filter(function(e) { return e.favorite; }).length;
    $('count-login').textContent = mapped.filter(function(e) { return e.type === 'login'; }).length;
    $('count-card').textContent  = mapped.filter(function(e) { return e.type === 'card';  }).length;
    $('count-note').textContent  = mapped.filter(function(e) { return e.type === 'note';  }).length;
    $('stat-total').textContent  = vault.length;

    const logins = mapped.filter(function(e) { return e.type === 'login' && e.password; });
    const weak   = logins.filter(function(e) { return calcStrength(e.password).score < 50; }).length;
    const strong = logins.filter(function(e) { return calcStrength(e.password).score >= 80; }).length;

    const pwdMap = {};
    logins.forEach(function(e) { pwdMap[e.password] = (pwdMap[e.password] || 0) + 1; });
    const reused = logins.filter(function(e) { return pwdMap[e.password] > 1; }).length;

    $('stat-weak').textContent   = weak;
    $('stat-strong').textContent = strong;
    $('stat-reused').textContent = reused;

    const pct   = logins.length ? Math.round((strong / logins.length) * 100) : 100;
    const badge = $('security-score-badge');
    $('score-label').textContent = 'Score : ' + pct + '%';
    badge.className = 'security-score ' + (pct >= 80 ? 'good' : pct >= 50 ? 'warn' : 'bad');

    // Infos utilisateur dans la sidebar
    const user = getUser();
    if (user) {
        const name = (user.first_name + ' ' + user.last_name).trim() || user.email;
        const avatar = document.querySelector('.user-avatar');
        const uname  = document.querySelector('.user-name');
        const uemail = document.querySelector('.user-email');
        if (avatar) avatar.textContent = name.charAt(0).toUpperCase();
        if (uname)  uname.textContent  = name;
        if (uemail) uemail.textContent = user.email;
    }
}

function render() {
    updateCounts();
    renderEntries();
}

//   ACTIONS SUR LES ENTRÉES

window.copyPwd = function(id) {
    const e = vault.find(function(x) { return String(x.id) === String(id); });
    if (e && e.password) copyToClipboard(e.password, 'Mot de passe copié !');
};

window.deleteEntry = async function(id) {
    if (!confirm('Supprimer cet élément du coffre ?')) return;
    try {
        const res = await apiFetch('/vault/' + id + '/', { method: 'DELETE' });
        if (res && (res.ok || res.status === 204)) {
            vault = vault.filter(function(x) { return String(x.id) !== String(id); });
            render();
            showToast('🗑️ Élément supprimé');
        }
    } catch { showToast('Erreur lors de la suppression'); }
};

//Délégation d'événement
function initEntriesClickHandler() {
    const list = $('entries-list');
    if (!list || list._delegated) return;
    list._delegated = true;
    list.addEventListener('click', function(e) {
        const actionBtn = e.target.closest('[data-action]');
        if (actionBtn) {
            e.stopPropagation();
            const id     = actionBtn.dataset.id;
            const action = actionBtn.dataset.action;
            if (action === 'copy')   window.copyPwd(id);
            if (action === 'delete') window.deleteEntry(id);
            return;
        }
        const row = e.target.closest('.entry-row');
        if (row && row.dataset.id) openDetail(row.dataset.id);
    });
}

//   MODAL AJOUT / ÉDITION

function openModal(mode, id) {
    editingId = id || null;
    $('modal-title').textContent = id ? "Modifier l'élément" : 'Ajouter un élément';
    resetModalForm();
    if (id) {
        const raw = vault.find(function(x) { return String(x.id) === String(id); });
        if (!raw) return;
        const e = mapEntry(raw);
        switchModalType(e.type);
        fillModalForm(e);
    } else {
        switchModalType('login');
    }
    show($('modal-overlay'));
    $('f-name')?.focus();
}

function resetModalForm() {
    ['f-name','f-username','f-password','f-url','f-cardholder','f-cardnumber','f-expiry','f-cvv','f-note'].forEach(function(id) {
        const el = $(id);
        if (el) el.value = '';
    });
    const fav = $('f-favorite');
    if (fav) fav.checked = false;
    updateStrengthMeter('', 'modal-strength-fill', 'modal-strength-label');
}

function fillModalForm(e) {
    if ($('f-name'))     $('f-name').value     = e.name     || '';
    if ($('f-favorite')) $('f-favorite').checked = e.favorite || false;
    if (e.type === 'login') {
        if ($('f-username')) $('f-username').value = e.username || '';
        if ($('f-password')) $('f-password').value = e.password || '';
        if ($('f-url'))      $('f-url').value      = e.url      || '';
        updateStrengthMeter(e.password || '', 'modal-strength-fill', 'modal-strength-label');
    } else if (e.type === 'card') {
        if ($('f-cardholder')) $('f-cardholder').value = e.cardHolder || '';
        if ($('f-cardnumber')) $('f-cardnumber').value = e.cardNumber || '';
        if ($('f-expiry'))     $('f-expiry').value     = e.expiry     || '';
        if ($('f-cvv'))        $('f-cvv').value        = e.cvv        || '';
    } else if (e.type === 'note') {
        if ($('f-note')) $('f-note').value = e.note || '';
    }
}

function switchModalType(type) {
    currentModalType = type;
    ['login','card','note'].forEach(function(t) {
        $('fields-' + t)?.classList.toggle('hidden', t !== type);
        document.querySelector('.modal-tab[data-type="' + t + '"]')?.classList.toggle('active', t === type);
    });
}

async function saveEntry() {
    const name = ($('f-name')?.value || '').trim();
    if (!name) { showToast('Nom requis'); return; }

    // Construire le payload selon le type
    const payload = {
        type:     currentModalType,
        name:     name,
        favorite: $('f-favorite')?.checked || false,
    };

    if (currentModalType === 'login') {
        const pwd = $('f-password')?.value || '';
        if (!pwd) { showToast('⚠️ Mot de passe requis'); return; }
        payload.username = ($('f-username')?.value || '').trim();
        payload.password = pwd;
        payload.url      = ($('f-url')?.value      || '').trim();
    } else if (currentModalType === 'card') {
        payload.card_holder = ($('f-cardholder')?.value || '').trim();
        payload.card_number = ($('f-cardnumber')?.value || '').trim();
        payload.expiry      = ($('f-expiry')?.value     || '').trim();
        payload.cvv         = ($('f-cvv')?.value        || '').trim();
    } else {
        payload.note = ($('f-note')?.value || '').trim();
    }

    try {
        let res, data;
        if (editingId) {
            // PATCH — modifier
            res  = await apiFetch('/vault/' + editingId + '/', {
                method: 'PATCH',
                body:   JSON.stringify(payload)
            });
        } else {
            // POST — créer
            res  = await apiFetch('/vault/', {
                method: 'POST',
                body:   JSON.stringify(payload)
            });
        }

        if (!res || !res.ok) {
            const err = await res.json();
            const msg = Object.values(err)[0];
            showToast('❌ ' + (Array.isArray(msg) ? msg[0] : msg));
            return;
        }

        data = await res.json();

        if (editingId) {
            const idx = vault.findIndex(function(x) { return String(x.id) === String(editingId); });
            if (idx !== -1) vault[idx] = data;
            showToast('Élément modifié');
        } else {
            vault.unshift(data);
            showToast('Élément ajouté au coffre');
        }

        closeModal('modal-overlay');
        render();

    } catch { showToast('Erreur réseau'); }
}

function closeModal(overlayId) {
    hide($(overlayId));
    editingId = null;
}

//   MODAL DÉTAIL
let pwdVisible = false;

function openDetail(id) {
    const raw = vault.find(function(x) { return String(x.id) === String(id); });
    if (!raw) return;
    const e = mapEntry(raw);

    $('detail-icon').style.background = getIconColor(e.name);
    $('detail-icon').textContent      = getIconLabel(e);
    $('detail-name').textContent      = e.name;
    $('detail-type-badge').textContent =
        e.type === 'login' ? ' Mot de passe' :
        e.type === 'card'  ? 'Carte' : 'Note';

    let body = '';
    if (e.type === 'login') {
        body += detailField('Identifiant', e.username, true);
        body += detailFieldPwd('Mot de passe', e.password);
        if (e.url) body += '<div class="detail-field"><div class="detail-field-label">URL</div>'
            + '<div class="detail-field-value"><a href="' + escAttr(e.url) + '" target="_blank" rel="noopener" style="color:var(--green);text-decoration:none">' + escHtml(e.url) + '</a></div></div>';
        body += '<div class="detail-field"><div class="detail-field-label">Force</div><div>' + getStrengthBadge(e.password) + '</div></div>';
    } else if (e.type === 'card') {
        body += detailField('Titulaire',   e.cardHolder, true);
        body += detailField('Numéro',      e.cardNumber, true, true);
        body += detailField('Expiration',  e.expiry,     false);
        body += detailField('CVV',         '•••',        false);
    } else {
        body += '<div class="detail-field"><div class="detail-field-label">Note</div>'
            + '<div class="detail-field-value mono" style="white-space:pre-wrap;word-break:break-word">'
            + escHtml(e.note) + '</div></div>';
    }

    $('detail-body').innerHTML = body;
    pwdVisible = false;

    // Bouton afficher mdp
    const pwdToggle = $('detail-pwd-toggle');
    if (pwdToggle) {
        pwdToggle.onclick = function() {
            pwdVisible = !pwdVisible;
            const el = $('detail-pwd-val');
            if (el) el.textContent = pwdVisible ? (pwdToggle.dataset.pwd || '') : '••••••••••••';
        };
    }

    // Boutons copier
    $('detail-body').querySelectorAll('[data-copy]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            copyToClipboard(btn.dataset.copy, 'Copié !');
        });
    });

    $('detail-delete').onclick = function() { closeModal('detail-overlay'); window.deleteEntry(id); };
    $('detail-edit').onclick   = function() { closeModal('detail-overlay'); openModal('edit', id);  };

    show($('detail-overlay'));
}

function detailField(label, value, copyable, mono) {
    const raw      = value || '';
    const displayed = escHtml(raw);
    const copyBtn  = copyable
        ? '<button class="detail-copy-btn" data-copy="' + escAttr(raw) + '" title="Copier">'
        + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>'
        + '</button>' : '';
    return '<div class="detail-field">'
        + '<div class="detail-field-label">' + escHtml(label) + '</div>'
        + '<div class="detail-field-value ' + (mono ? 'mono' : '') + '">'
        + '<span>' + (displayed || '—') + '</span>' + copyBtn
        + '</div></div>';
}

function detailFieldPwd(label, pwd) {
    return '<div class="detail-field">'
        + '<div class="detail-field-label">' + escHtml(label) + '</div>'
        + '<div class="detail-field-value mono">'
        + '<span id="detail-pwd-val" style="letter-spacing:0.1em">••••••••••••</span>'
        + '<div style="display:flex;gap:6px">'
        + '<button class="detail-copy-btn" id="detail-pwd-toggle" data-pwd="' + escAttr(pwd) + '" title="Afficher">'
        + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
        + '</button>'
        + '<button class="detail-copy-btn" data-copy="' + escAttr(pwd) + '" title="Copier">'
        + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>'
        + '</button>'
        + '</div></div></div>';
}

//   GÉNÉRATEUR NIST SP 800-63B Rev.4
const WORDLIST = [
    'girafe','soleil','dakar','baobab','pluie','montagne','fleuve','savane',
    'mango','palmier','sable','ocean','etoile','lune','nuage','vent',
    'foret','plage','riviere','colline','village','marche','pirogue','kora',
    'griot','liberte','paix','lumiere','feuille','racine','chemin','horizon',
    'aurore','famille','partage','sagesse','courage','espoir','victoire',
    'papaye','goyave','tamarin','kapok','vague','maree','lagune',
    'hyene','gazelle','elephant','perroquet','flamant','cigogne',
];

function randomWord() { return WORDLIST[Math.floor(Math.random() * WORDLIST.length)]; }
function capitalize(w) { return w.charAt(0).toUpperCase() + w.slice(1); }

let currentGenMode = 'passphrase';
let currentSep     = '-';
let generatedPwd   = '';

function generatePassphrase() {
    const count     = parseInt($('words-count')?.value || 4);
    const cap       = $('pp-capitalize')?.checked;
    const addNumber = $('pp-number')?.checked;
    const words     = Array.from({ length: count }, function() {
        const w = randomWord();
        return cap ? capitalize(w) : w;
    });
    if (addNumber) words.push(Math.floor(Math.random() * 90) + 10);
    return words.join(currentSep);
}

function generateRandom() {
    const len     = parseInt($('rand-length')?.value || 20);
    const upper   = $('rc-upper')?.checked;
    const lower   = $('rc-lower')?.checked;
    const digits  = $('rc-digits')?.checked;
    const symbols = $('rc-symbols')?.checked;
    let charset   = '';
    if (upper)   charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (lower)   charset += 'abcdefghijklmnopqrstuvwxyz';
    if (digits)  charset += '0123456789';
    if (symbols) charset += '!@#$%^&*()-_=+[]{}|;:,.<>?';
    if (!charset) charset = 'abcdefghijklmnopqrstuvwxyz';
    const arr = new Uint32Array(len);
    crypto.getRandomValues(arr);
    return Array.from(arr, function(n) { return charset[n % charset.length]; }).join('');
}

function calcEntropy(pwd) {
    let cs = 0;
    if (/[a-z]/.test(pwd)) cs += 26;
    if (/[A-Z]/.test(pwd)) cs += 26;
    if (/[0-9]/.test(pwd)) cs += 10;
    if (/[^a-zA-Z0-9]/.test(pwd)) cs += 32;
    if (/[\s\-_.]/.test(pwd)) cs = Math.max(cs, WORDLIST.length);
    return Math.round(pwd.length * Math.log2(cs || 26));
}

function entropyToTime(bits) {
    const secs = Math.pow(2, bits) / 1e10;
    if (secs < 1)          return 'instantané';
    if (secs < 60)         return Math.round(secs) + ' secondes';
    if (secs < 3600)       return Math.round(secs/60) + ' minutes';
    if (secs < 86400)      return Math.round(secs/3600) + ' heures';
    if (secs < 31536000)   return Math.round(secs/86400) + ' jours';
    if (secs < 31536000e3) return Math.round(secs/31536000) + ' ans';
    return '> million d\'années';
}

function refreshGenerator() {
    generatedPwd = currentGenMode === 'passphrase' ? generatePassphrase() : generateRandom();
    $('gen-password-display').textContent = generatedPwd;
    const bits = calcEntropy(generatedPwd);
    $('entropy-bits').textContent = bits + ' bits';
    $('entropy-time').textContent = entropyToTime(bits);
    const pct  = Math.min(100, Math.round(bits / 128 * 100));
    const fill = $('entropy-bar-fill');
    fill.style.width      = pct + '%';
    fill.style.background = bits < 50 ? '#ef4444' : bits < 80 ? '#f59e0b' : 'var(--green)';
}

//   ÉVÉNEMENTS
document.addEventListener('DOMContentLoaded', async function() {

    // Vérifier l'auth
    if (!getAccessToken()) {
        window.location.href = 'login.html';
        return;
    }

    // Charger le coffre depuis le backend
    await loadVault();
    initEntriesClickHandler();

    // Sidebar collapse
    $('sidebar-collapse')?.addEventListener('click', function() {
        $('sidebar').classList.toggle('collapsed');
    });

    // Mobile menu
    $('mobile-menu-btn')?.addEventListener('click', function() {
        $('sidebar').classList.toggle('mobile-open');
    });

    // Logout
    $('logout-btn')?.addEventListener('click', async function() {
        if (!confirm('Se déconnecter de SenCadenas ?')) return;
        try {
            await apiFetch('/auth/logout/', {
                method: 'POST',
                body: JSON.stringify({ refresh: getRefreshToken() })
            });
        } catch {}
        logout();
    });

    // Filtres nav
    document.querySelectorAll('.nav-item[data-filter]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.nav-item').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            const titles = { all:'Tous les éléments', favorite:'Favoris', login:'Mots de passe', card:'Cartes bancaires', note:'Notes sécurisées' };
            $('topbar-title').textContent = titles[currentFilter] || 'Coffre';
            renderEntries();
        });
    });

    // Recherche
    $('search-input')?.addEventListener('input', function(e) {
        currentSearch = e.target.value;
        renderEntries();
    });

    // Tri
    $('sort-select')?.addEventListener('change', renderEntries);

    // Bouton Ajouter
    $('add-btn')?.addEventListener('click', function() { openModal('add'); });

    // Modal overlay
    $('modal-overlay')?.addEventListener('click', function(e) {
        if (e.target === $('modal-overlay')) closeModal('modal-overlay');
    });
    $('modal-close')?.addEventListener('click',  function() { closeModal('modal-overlay'); });
    $('modal-cancel')?.addEventListener('click', function() { closeModal('modal-overlay'); });
    $('modal-save')?.addEventListener('click',   saveEntry);

    // Onglets type modal
    document.querySelectorAll('.modal-tab').forEach(function(tab) {
        tab.addEventListener('click', function() { switchModalType(tab.dataset.type); });
    });

    // Toggle password modal
    document.querySelectorAll('.toggle-password').forEach(function(btn) {
        btn.addEventListener('click', function() {
            const inp = $(btn.dataset.target);
            if (!inp) return;
            inp.type = inp.type === 'password' ? 'text' : 'password';
        });
    });

    // Jauge modal
    $('f-password')?.addEventListener('input', function(e) {
        updateStrengthMeter(e.target.value, 'modal-strength-fill', 'modal-strength-label');
    });

    // Bouton Générer
    $('generate-btn')?.addEventListener('click', function() {
        refreshGenerator();
        show($('gen-overlay'));
    });

    // Générateur
    $('gen-overlay')?.addEventListener('click', function(e) {
        if (e.target === $('gen-overlay')) closeModal('gen-overlay');
    });
    $('gen-close')?.addEventListener('click',   function() { closeModal('gen-overlay'); });
    $('gen-cancel')?.addEventListener('click',  function() { closeModal('gen-overlay'); });

    document.querySelectorAll('.gen-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.gen-tab').forEach(function(t) { t.classList.remove('active'); });
            tab.classList.add('active');
            currentGenMode = tab.dataset.mode;
            $('gen-passphrase')?.classList.toggle('hidden', currentGenMode !== 'passphrase');
            $('gen-random')?.classList.toggle('hidden',     currentGenMode !== 'random');
            refreshGenerator();
        });
    });

    document.querySelectorAll('.sep-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.sep-btn').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            currentSep = btn.dataset.sep;
            refreshGenerator();
        });
    });

    ['words-count','rand-length','pp-capitalize','pp-number','rc-upper','rc-lower','rc-digits','rc-symbols'].forEach(function(id) {
        $(id)?.addEventListener('input', function() {
            if (id === 'words-count' && $('words-count-label')) $('words-count-label').textContent = $('words-count').value;
            if (id === 'rand-length' && $('rand-length-label')) $('rand-length-label').textContent = $('rand-length').value;
            refreshGenerator();
        });
    });

    $('gen-refresh')?.addEventListener('click', refreshGenerator);
    $('gen-copy')?.addEventListener('click', function() {
        if (generatedPwd) copyToClipboard(generatedPwd, 'Mot de passe copié !');
    });
    $('gen-use')?.addEventListener('click', function() {
        if (!generatedPwd) return;
        const inp = $('f-password');
        if (inp) {
            inp.value = generatedPwd;
            inp.type  = 'text';
            updateStrengthMeter(generatedPwd, 'modal-strength-fill', 'modal-strength-label');
        }
        closeModal('gen-overlay');
        showToast('Mot de passe inséré');
    });

    // Détail modal
    $('detail-overlay')?.addEventListener('click', function(e) {
        if (e.target === $('detail-overlay')) closeModal('detail-overlay');
    });
    $('detail-close')?.addEventListener('click', function() { closeModal('detail-overlay'); });

    // Formatage carte
    $('f-cardnumber')?.addEventListener('input', function(e) {
        let v = e.target.value.replace(/\D/g,'').slice(0,16);
        e.target.value = v.replace(/(.{4})/g,'$1 ').trim();
    });
    $('f-expiry')?.addEventListener('input', function(e) {
        let v = e.target.value.replace(/\D/g,'').slice(0,4);
        if (v.length >= 2) v = v.slice(0,2) + '/' + v.slice(2);
        e.target.value = v;
    });

    // Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            ['modal-overlay','gen-overlay','detail-overlay'].forEach(function(id) {
                if (!$(id)?.classList.contains('hidden')) closeModal(id);
            });
        }
    });
});