(function() {
    'use strict';

    // ==============================
    // 1. FIREBASE INIT
    // ==============================
    if (typeof firebase === 'undefined') {
        document.body.innerHTML = '<div style="padding:2rem;color:#f44;"><h2>Ошибка: Firebase SDK не загружен</h2><p>Проверьте подключение к интернету.</p></div>';
        return;
    }
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();

    // ==============================
    // 2. СОСТОЯНИЕ
    // ==============================
    let currentUser = null;
    let currentView = 'auth';
    let currentGame = null;
    let currentFilter = 'all';
    let currentCards = [];
    let currentCommonCards = [];
    let allGames = [];
    let editingCardId = null;
    let cardsUnsubscribe = null;
    let commonCardsUnsubscribe = null;

    // ==============================
    // 3. DOM ССЫЛКИ
    // ==============================
    const $ = id => document.getElementById(id);
    const sections = {
        auth: $('authSection'),
        games: $('gamesSection'),
        game: $('gameSection'),
        info: $('infoSection'),
    };
    const container = $('cardContainer');
    const toast = $('toast');
    const gameInfo = $('gameInfo');
    const filterBar = $('filterBar');

    // ==============================
    // 4. УТИЛИТЫ
    // ==============================
    function showToast(msg, isError) {
        toast.textContent = msg;
        toast.className = 'toast' + (isError ? ' error' : '');
        toast.style.display = 'block';
        clearTimeout(toast._hideTimer);
        toast._hideTimer = setTimeout(() => { toast.style.display = 'none'; }, 3500);
    }

    function showView(name) {
        Object.keys(sections).forEach(k => {
            sections[k].style.display = k === name ? 'block' : 'none';
        });
        currentView = name;
    }

    function formatDate(ts) {
        if (!ts) return '—';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleDateString('ru-RU');
    }

    function getCardTypeLabel(type) {
        const labels = {
            player: '🧙 Игрок', friendly: '🤝 Друг', enemy: '👹 Враг',
            weapon: '⚔️ Оружие', armor: '🛡️ Броня', artifact: '🔮 Артефакт',
            tool: '🔧 Инструмент', consumable: '🧪 Расходник', skill: '🎯 Навык',
            location: '🗺️ Локация', story: '📖 Сюжет', reward: '🏆 Награда'
        };
        return labels[type] || type;
    }

    function getEquipmentSubtype(type) {
        return { weapon: 'weapons', armor: 'armor', artifact: 'artifacts', tool: 'tools' }[type] || null;
    }

    function getDefaultCardData(type) {
        const base = { name: '', description: '' };
        switch (type) {
            case 'player':
                return { ...base, profession: '', role: '', level: 1, stats: { strength: 1, agility: 1, endurance: 1, intelligence: 1, wisdom: 1, charisma: 1 }, health: { max: 10, current: 10 }, armor: { type: '', ac: 10, resistance: 0, durability: 0 }, equipment: [], consumables: [], skills: [], goals: [] };
            case 'friendly':
                return { ...base, role: '', health: 10, armor: { ac: 10, resistance: 0, durability: 0 }, stats: {}, motivation: '', secrets: [], skills: [], dialogue: {} };
            case 'enemy':
                return { ...base, type: '', subtype: '', health: 10, armor: { ac: 10, resistance: 0, durability: 0 }, stats: {}, skills: [], weakness: '', location: '', dialogue: {} };
            case 'weapon':
                return { ...base, damage: '', bonus: '', range: '', weight: '' };
            case 'armor':
                return { ...base, ac: '', resistance: '', durability: '', weight: '' };
            case 'artifact':
            case 'tool':
                return { ...base, bonus: '', weight: '' };
            case 'consumable':
                return { ...base, type: '', effect: '', rarity: '', weight: '' };
            case 'skill':
                return { ...base, type: 'активный', cooldown: '', effect: '', damage: '', check: '' };
            case 'location':
                return { ...base, atmosphere: '', clues: [], npcs: [], loot: [] };
            case 'story':
                return { ...base, summary: '', true_cause: '', villain: { name: '', motivation: '', secrets: [] }, endings: {}, moral: '' };
            case 'reward':
                return { ...base, paths: [] };
            default:
                return { ...base };
        }
    }

    // ==============================
    // 5. AUTH (логин/пароль без почты)
    // ==============================
    let currentUsername = '';

    function usernameToEmail(username) {
        return username.toLowerCase().replace(/[^a-z0-9]/g, '_') + '@dnd.local';
    }

    function loadUsername(uid) {
        return db.collection('usernames').doc(uid).get().then(doc => {
            if (doc.exists) {
                currentUsername = doc.data().username;
                $('userDisplay').textContent = currentUsername;
            } else {
                currentUsername = uid.slice(0, 8);
                $('userDisplay').textContent = currentUsername;
            }
        });
    }

    auth.onAuthStateChanged(user => {
        currentUser = user;
        if (user) {
            $('authButtons').style.display = 'none';
            $('userMenu').style.display = 'flex';
            loadUsername(user.uid).then(() => {
                showView('games');
                loadGames();
            });
        } else {
            currentUsername = '';
            $('authButtons').style.display = 'flex';
            $('userMenu').style.display = 'none';
            showView('auth');
            $('loginForm').style.display = 'block';
            $('registerForm').style.display = 'none';
            cleanupGameListeners();
        }
    });

    function showAuthError(el, msg) {
        el.textContent = msg;
        el.style.display = 'block';
        setTimeout(() => { el.style.display = 'none'; }, 4000);
    }

    $('showLoginBtn').addEventListener('click', () => { showView('auth'); $('loginForm').style.display = 'block';
        $('registerForm').style.display = 'none'; });
    $('showRegisterBtn').addEventListener('click', () => { showView('auth'); $('loginForm').style.display = 'none';
        $('registerForm').style.display = 'block'; });
    $('switchToLogin').addEventListener('click', e => { e.preventDefault(); $('loginForm').style.display = 'block';
        $('registerForm').style.display = 'none'; });
    $('switchToRegister').addEventListener('click', e => { e.preventDefault(); $('loginForm').style.display = 'none';
        $('registerForm').style.display = 'block'; });

    $('loginBtn').addEventListener('click', () => {
        const username = $('loginUsername').value.trim();
        const pass = $('loginPassword').value.trim();
        if (!username || !pass) { showAuthError($('authError'), 'Заполните все поля'); return; }
        const email = usernameToEmail(username);
        auth.signInWithEmailAndPassword(email, pass)
            .then(() => showToast('✅ Вход выполнен'))
            .catch(err => {
                if (err.code === 'auth/user-not-found') {
                    showAuthError($('authError'), 'Пользователь не найден');
                } else if (err.code === 'auth/wrong-password') {
                    showAuthError($('authError'), 'Неверный пароль');
                } else {
                    showAuthError($('authError'), err.message);
                }
            });
    });

    $('registerBtn').addEventListener('click', () => {
        const username = $('registerUsername').value.trim();
        const pass = $('registerPassword').value.trim();
        const confirm = $('registerConfirm').value.trim();
        if (!username || !pass || !confirm) { showAuthError($('regError'), 'Заполните все поля'); return; }
        if (username.length < 3) { showAuthError($('regError'), 'Логин минимум 3 символа'); return; }
        if (!/^[a-zа-яё0-9_]+$/i.test(username)) { showAuthError($('regError'), 'Логин: только буквы, цифры и _'); return; }
        if (pass.length < 6) { showAuthError($('regError'), 'Пароль минимум 6 символов'); return; }
        if (pass !== confirm) { showAuthError($('regError'), 'Пароли не совпадают'); return; }

        // Check if username is already taken
        db.collection('usernames').where('username', '==', username).get().then(snap => {
            if (!snap.empty) {
                showAuthError($('regError'), 'Этот логин уже занят');
                return;
            }
            const email = usernameToEmail(username);
            auth.createUserWithEmailAndPassword(email, pass)
                .then(result => {
                    return db.collection('usernames').doc(result.user.uid).set({ username });
                })
                .then(() => showToast('✅ Регистрация успешна'))
                .catch(err => showAuthError($('regError'), err.message));
        }).catch(err => showAuthError($('regError'), err.message));
    });

    $('logoutBtn').addEventListener('click', () => {
        cleanupGameListeners();
        auth.signOut().then(() => showToast('👋 Вы вышли'));
    });

    // ==============================
    // 6. VIEW ROUTING
    // ==============================
    $('myGamesBtn').addEventListener('click', () => {
        cleanupGameListeners();
        currentGame = null;
        showView('games');
        loadGames();
    });
    $('infoBtn').addEventListener('click', () => {
        showView('info');
    });
    $('backFromInfoBtn').addEventListener('click', () => {
        if (currentUser) {
            if (currentGame) { showView('game'); } else { showView('games'); }
        } else { showView('auth'); }
    });
    $('backToGamesBtn').addEventListener('click', () => {
        cleanupGameListeners();
        currentGame = null;
        showView('games');
        loadGames();
    });

    // ==============================
    // 7. GAMES CRUD
    // ==============================
    function loadGames() {
        if (!currentUser) return;
        $('gamesGrid').innerHTML = '<div class="loading">Загрузка игр...</div>';
        db.collection('games')
            .where('ownerId', '==', currentUser.uid)
            .onSnapshot(snapshot => {
                allGames = [];
                snapshot.forEach(doc => {
                    const g = { id: doc.id, ...doc.data() };
                    g._created = g.createdAt?.toMillis?.() || 0;
                    allGames.push(g);
                });
                allGames.sort((a, b) => b._created - a._created);
                renderGamesGrid();
            }, err => {
                let msg = err.message;
                if (err.code === 'failed-precondition' && msg.includes('index')) {
                    msg = 'Требуется создать индекс в Firebase Console. Нажмите на ссылку в консоли браузера (F12).';
                }
                showToast('❌ Ошибка загрузки игр: ' + msg, true);
                $('gamesGrid').innerHTML = '<div class="empty-state">Ошибка загрузки. Проверьте консоль (F12).</div>';
            });
    }

    function renderGamesGrid() {
        const grid = $('gamesGrid');
        if (!allGames.length) {
            grid.innerHTML = '<div class="empty-state">📭 У вас пока нет игр. Создайте первую!</div>';
            return;
        }
        grid.innerHTML = allGames.map(g => `
            <div class="game-card" data-id="${g.id}">
                <div class="game-card-header">
                    <span class="game-card-name">${g.name || 'Без названия'}</span>
                    <span class="game-card-date">${formatDate(g.createdAt)}</span>
                </div>
                ${g.setting ? `<div class="game-card-setting">🏔️ ${g.setting}</div>` : ''}
                ${g.description ? `<div class="game-card-desc">${g.description}</div>` : ''}
                <div class="game-card-footer">
                    <button class="btn-small" data-action="open-game" data-id="${g.id}">📂 Открыть</button>
                    <button class="btn-small" data-action="delete-game" data-id="${g.id}">🗑️</button>
                </div>
            </div>
        `).join('');
        grid.querySelectorAll('[data-action="open-game"]').forEach(btn => {
            btn.addEventListener('click', () => openGame(btn.dataset.id));
        });
        grid.querySelectorAll('[data-action="delete-game"]').forEach(btn => {
            btn.addEventListener('click', () => deleteGame(btn.dataset.id));
        });
    }

    $('createGameBtn').addEventListener('click', () => {
        $('gameNameInput').value = '';
        $('gameSettingInput').value = '';
        $('gameDescInput').value = '';
        document.querySelector('input[name="rulesMode"][value="simplified"]').checked = true;
        $('gameModal').style.display = 'flex';
    });
    $('gameModalCloseBtn').addEventListener('click', () => $('gameModal').style.display = 'none');
    $('gameModalCancelBtn').addEventListener('click', () => $('gameModal').style.display = 'none');
    $('gameModalSaveBtn').addEventListener('click', () => {
        const name = $('gameNameInput').value.trim();
        if (!name) { showToast('❌ Введите название игры', true); return; }
        if (!currentUser) return;
        const rulesMode = document.querySelector('input[name="rulesMode"]:checked').value;
        db.collection('games').add({
            name,
            setting: $('gameSettingInput').value.trim(),
            description: $('gameDescInput').value.trim(),
            ownerId: currentUser.uid,
            rulesMode,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            $('gameModal').style.display = 'none';
            showToast('✅ Игра создана');
        }).catch(err => showToast('❌ Ошибка: ' + err.message, true));
    });

    function deleteGame(id) {
        if (!confirm('Удалить игру и все её карточки?')) return;
        // delete all cards for this game first
        db.collection('cards').where('gameId', '==', id).get().then(snap => {
            const batch = db.batch();
            snap.forEach(doc => batch.delete(doc.ref));
            batch.delete(db.collection('games').doc(id));
            return batch.commit();
        }).then(() => {
            showToast('🗑️ Игра удалена');
        }).catch(err => showToast('❌ Ошибка: ' + err.message, true));
    }

    // ==============================
    // 8. OPEN GAME
    // ==============================
    function openGame(gameId) {
        db.collection('games').doc(gameId).get().then(doc => {
            if (!doc.exists) { showToast('❌ Игра не найдена', true); return; }
            currentGame = { id: doc.id, ...doc.data() };
            showView('game');
            renderGameView();
            setupGameListeners(gameId);
        }).catch(err => showToast('❌ Ошибка: ' + err.message, true));
    }

    function getRulesLabel(mode) {
        return mode === 'full' ? '🐉 Полные D&D 5e' : '📋 Упрощённые';
    }

    function renderGameView() {
        if (!currentGame) return;
        const mode = currentGame.rulesMode || 'simplified';
        $('gameTitle').innerHTML = `🎮 ${currentGame.name || 'Без названия'} <span class="rules-badge">${getRulesLabel(mode)}</span>`;
        $('sidebarGameName').innerHTML = `${currentGame.name || '—'} <span class="rules-badge" style="font-size:0.7rem;">${mode === 'full' ? '🐉' : '📋'}</span>`;
        $('sidebarGameSetting').textContent = currentGame.setting ? `🏔️ ${currentGame.setting}` : '';
        $('sidebarGameDesc').textContent = currentGame.description || '';
        gameInfo.innerHTML = `🏔️ <strong>${currentGame.name || 'Игра'}</strong>${currentGame.setting ? ' · ' + currentGame.setting : ''} · ${getRulesLabel(mode)}`;
        currentFilter = 'all';
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.filter-btn[data-filter="all"]').classList.add('active');
    }

    function setupGameListeners(gameId) {
        cleanupGameListeners();
        // Listen to cards for this game
        cardsUnsubscribe = db.collection('cards')
            .where('gameId', '==', gameId)
            .onSnapshot(snap => {
                currentCards = [];
                snap.forEach(doc => {
                    currentCards.push({ id: doc.id, ...doc.data() });
                });
                renderCards();
                updateStats();
            }, err => showToast('❌ Ошибка загрузки карточек: ' + err.message, true));
        // Listen to common cards
        commonCardsUnsubscribe = db.collection('cards')
            .where('isCommon', '==', true)
            .onSnapshot(snap => {
                currentCommonCards = [];
                snap.forEach(doc => {
                    currentCommonCards.push({ id: doc.id, ...doc.data() });
                });
                renderCommonCardsList();
                renderCards();
            }, err => { /* ignore */ });
    }

    function cleanupGameListeners() {
        if (cardsUnsubscribe) { cardsUnsubscribe();
            cardsUnsubscribe = null; }
        if (commonCardsUnsubscribe) { commonCardsUnsubscribe();
            commonCardsUnsubscribe = null; }
    }

    function updateStats() {
        const stats = $('gameStats');
        if (!stats) return;
        const byType = {};
        currentCards.forEach(c => {
            byType[c.type] = (byType[c.type] || 0) + 1;
        });
        const total = currentCards.length;
        const common = currentCommonCards.length;
        stats.innerHTML = `<p><strong>${total}</strong> карточек всего</p><p><strong>${common}</strong> общих карточек</p>` +
            Object.entries(byType).map(([t, n]) => `<span class="stat-pill">${getCardTypeLabel(t)}: ${n}</span>`).join('');
    }

    // ==============================
    // 9. D&D 5e HELPER FUNCTIONS
    // ==============================
    function calcMod(score) {
        if (score == null || score === '') return 0;
        return Math.floor((Number(score) - 10) / 2);
    }

    function calcProfBonus(level) {
        level = Number(level) || 1;
        return Math.ceil(level / 4) + 1;
    }

    const SKILLS_5E = {
        'acrobatics': 'Акробатика', 'animal_handling': 'Уход за животными', 'arcana': 'Магия',
        'athletics': 'Атлетика', 'deception': 'Обман', 'history': 'История', 'insight': 'Проницательность',
        'intimidation': 'Запугивание', 'investigation': 'Расследование', 'medicine': 'Медицина',
        'nature': 'Природа', 'perception': 'Восприятие', 'performance': 'Выступление',
        'persuasion': 'Убеждение', 'religion': 'Религия', 'sleight_of_hand': 'Ловкость рук',
        'stealth': 'Скрытность', 'survival': 'Выживание'
    };
    const SKILL_ABILITIES = {
        'acrobatics': 'dexterity', 'animal_handling': 'wisdom', 'arcana': 'intelligence',
        'athletics': 'strength', 'deception': 'charisma', 'history': 'intelligence',
        'insight': 'wisdom', 'intimidation': 'charisma', 'investigation': 'intelligence',
        'medicine': 'wisdom', 'nature': 'intelligence', 'perception': 'wisdom',
        'performance': 'charisma', 'persuasion': 'charisma', 'religion': 'intelligence',
        'sleight_of_hand': 'dexterity', 'stealth': 'dexterity', 'survival': 'wisdom'
    };
    const SAVE_ABILITIES = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
    const SAVE_LABELS = { strength: 'Сила', dexterity: 'Ловкость', constitution: 'Телосложение', intelligence: 'Интеллект', wisdom: 'Мудрость', charisma: 'Харизма' };
    const STAT_LABELS = SAVE_LABELS;

    function isFullMode() {
        return currentGame && currentGame.rulesMode === 'full';
    }

    function buildDndPlayerExtra(data) {
        const s = data.stats || {};
        const level = Number(data.level) || 1;
        const prof = calcProfBonus(level);
        const race = data.race || '';
        const cls = data.class || '';
        const subclass = data.subclass || '';
        const background = data.background || '';
        const alignment = data.alignment || '';
        const xp = data.xp || '';
        const saveProfs = data.saveProficiencies || [];
        const skillProfs = data.skillProficiencies || [];
        const spellAbility = data.spellcastingAbility || '';
        const spellDC = spellAbility ? (8 + prof + calcMod(s[spellAbility])) : '';
        const spellAtk = spellAbility ? (prof + calcMod(s[spellAbility])) : '';

        let sHtml = SAVE_ABILITIES.map(k => {
            const val = s[k] ?? '—';
            const mod = val === '—' ? '—' : (calcMod(val) >= 0 ? '+' + calcMod(val) : calcMod(val));
            const isProf = saveProfs.includes(k);
            return `<div class="stat-item${isProf ? ' save-proficient' : ''}"><span title="${isProf ? 'Владение' : ''}">${SAVE_LABELS[k]}${isProf ? ' ⚡' : ''}</span><span>${val} (${mod})</span></div>`;
        }).join('');

        let skillsHtml = Object.entries(SKILLS_5E).map(([key, label]) => {
            const abil = SKILL_ABILITIES[key];
            const abilMod = calcMod(s[abil]);
            const isProf = skillProfs.includes(key);
            const bonus = isProf ? abilMod + prof : abilMod;
            const sign = bonus >= 0 ? '+' : '';
            return `<span class="skill-pill${isProf ? ' skilled' : ''}" title="${label} (${STAT_LABELS[abil]})">${label} ${sign}${bonus}</span>`;
        }).join('');

        let spellsHtml = '';
        if (spellAbility) {
            const slots = data.spellSlots || {};
            const spells = data.spells || [];
            spellsHtml = `
                <div class="dnd-section">
                    <strong>🔮 Заклинания</strong>
                    <div class="dnd-stat-row"><span>КД закл: ${spellDC}</span><span>Атака: +${spellAtk}</span><span>Способность: ${STAT_LABELS[spellAbility]}</span></div>
                    ${Object.keys(slots).length ? `<div class="dnd-stat-row"><span>Ячейки:</span>${Object.entries(slots).filter(([k,v]) => v).map(([k,v]) => `<span>${k} ур: ${v}</span>`).join('')}</div>` : ''}
                    ${spells.length ? `<div class="list-tag">${spells.map(s => `<span>${s.name||s}${s.level ? ' ['+s.level+']' : ''}${s.prepared ? ' ✓' : ''}</span>`).join('')}</div>` : ''}
                </div>`;
        }

        return `
            <div class="dnd-banner">⚡ Уровень ${level} · Б.М. +${prof} · ${race ? race + ' ' : ''}${cls ? cls + (subclass ? ' ('+subclass+')' : '') : ''}</div>
            ${background ? `<div class="dnd-stat-row"><span>📖 Предыстория: ${background}</span>${alignment ? `<span>⚖️ ${alignment}</span>` : ''}${xp ? `<span>📊 ${xp} XP</span>` : ''}</div>` : ''}
            <div class="dnd-section"><strong>🛡️ Спасброски</strong><div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin:0.3rem 0;">${sHtml}</div></div>
            <div class="dnd-section"><strong>🎯 Навыки</strong><div class="skills-grid">${skillsHtml}</div></div>
            <div class="dnd-stat-row">
                <span>❤️ HP ${data.health?.current || '—'}/${data.health?.max || '—'}</span>
                <span>🛡️ КБ ${data.armor?.ac || '—'}</span>
                <span>🏃‍♂️ Скорость ${data.speed || '30'} фт</span>
                <span>🎲 Кости HP: ${data.hitDice || '—'}</span>
            </div>
            ${data.features?.length ? `<div class="dnd-section"><strong>⚔️ Особенности</strong><div class="list-tag">${data.features.map(f => `<span title="${f.description||''}">${f.name||f}</span>`).join('')}</div></div>` : ''}
            ${spellsHtml}
        `;
    }

    function buildDndEnemyExtra(data) {
        const s = data.stats || {};
        const skills = data.skills || [];
        const cr = data.challengeRating || '';
        const xp = data.xp || '';
        return `
            ${cr ? `<div class="dnd-banner">⚠️ CR ${cr}${xp ? ' · ' + xp + ' XP' : ''}</div>` : ''}
            ${data.resistances?.length ? `<div class="dnd-stat-row"><span>🔰 Сопротивления: ${data.resistances.join(', ')}</span></div>` : ''}
            ${data.immunities?.length ? `<div class="dnd-stat-row"><span>🛡️ Иммунитеты: ${data.immunities.join(', ')}</span></div>` : ''}
            ${data.conditionImmunities?.length ? `<div class="dnd-stat-row"><span>🧊 Недейств. эффекты: ${data.conditionImmunities.join(', ')}</span></div>` : ''}
            ${data.senses ? `<div class="dnd-stat-row"><span>👁️ Чувства: ${data.senses}</span></div>` : ''}
            ${data.languages ? `<div class="dnd-stat-row"><span>🗣️ Языки: ${data.languages}</span></div>` : ''}
            ${data.legendaryActions ? `<div class="dnd-stat-row"><span>👑 Легендарные действия (${data.legendaryActions}/ход)</span></div>` : ''}
        `;
    }

    function renderCards() {
        if (!container) return;
        const allCards = [...currentCards, ...currentCommonCards];
        if (!allCards.length) {
            container.innerHTML = '<div class="empty-state">📭 Нет карточек. Добавьте первую!</div>';
            return;
        }
        const filtered = currentFilter === 'all' ?
            allCards :
            allCards.filter(c => c.type === currentFilter);
        if (!filtered.length) {
            container.innerHTML = `<div class="empty-state">Нет карточек типа "${getCardTypeLabel(currentFilter)}"</div>`;
            return;
        }
        let html = '';
        filtered.forEach(card => {
            html += buildCard(card);
        });
        container.innerHTML = html;
        attachCardHandlers();
    }

    function renderCommonCardsList() {
        const list = $('commonCardsList');
        if (!list) return;
        if (!currentCommonCards.length) {
            list.innerHTML = '<p style="opacity:0.6;font-size:0.85rem;">Нет общих карточек</p>';
            return;
        }
        list.innerHTML = currentCommonCards.map(c =>
            `<span class="common-card-pill">${getCardTypeLabel(c.type)}: ${c.data?.name || c.name || '—'}</span>`
        ).join('');
    }

    function buildCard(card) {
        const data = card.data || {};
        const type = card.type || 'unknown';
        const isCommon = card.isCommon ? '<span class="common-badge">🏷️ Общее</span>' : '';
        const deleteAction = `delete-card-${card.id}`;
        const editAction = `edit-card-${card.id}`;

        const fullMode = isFullMode();
        let body = '';
        switch (type) {
            case 'player':
                body = buildPlayerCardBody(data, fullMode);
                break;
            case 'friendly':
                body = buildFriendlyCardBody(data);
                break;
            case 'enemy':
                body = buildEnemyCardBody(data, fullMode);
                break;
            case 'weapon':
            case 'armor':
            case 'artifact':
            case 'tool':
                body = buildEquipmentCardBody(data, type);
                break;
            case 'consumable':
                body = buildConsumableCardBody(data);
                break;
            case 'skill':
                body = buildSkillCardBody(data);
                break;
            case 'location':
                body = buildLocationCardBody(data);
                break;
            case 'story':
                body = buildStoryCardBody(data);
                break;
            case 'reward':
                body = buildRewardCardBody(data);
                break;
            default:
                body = `<div class="info-block">${data.description || '—'}</div>`;
        }

        const typeLabels = {
            player: 'player-card', friendly: 'npc-friendly-card', enemy: 'npc-enemy-card',
            weapon: 'equipment-card', armor: 'equipment-card', artifact: 'equipment-card',
            tool: 'equipment-card', consumable: 'consumable-card', skill: 'skill-card',
            location: 'location-card', story: 'story-card', reward: 'reward-card'
        };
        const cardClass = typeLabels[type] || '';

        return `
            <div class="character-card ${cardClass}">
                <div class="card-header">
                    <span class="char-name">${data.name || card.name || '—'} ${isCommon}</span>
                    <span class="card-type-badge">${getCardTypeLabel(type)}</span>
                </div>
                ${body}
                <div class="card-footer no-print">
                    <button class="btn-small" data-action="${editAction}">✏️</button>
                    <button class="btn-small" data-action="${deleteAction}">🗑️</button>
                </div>
            </div>
        `;
    }

    // ---- Card builders (adapted from original) ----
    function buildPlayerCardBody(d, fullMode) {
        if (fullMode) return buildDndPlayerExtra(d);
        const s = d.stats || {};
        const h = d.health || { max: '—', current: '—' };
        const a = d.armor || { type: '—', ac: '—', resistance: '—', durability: '—' };
        const eq = d.equipment || [];
        const con = d.consumables || [];
        const sk = d.skills || [];
        const goals = d.goals || [];
        const statMap = { strength: 'Сила', agility: 'Ловкость', endurance: 'Телосложение', intelligence: 'Интеллект', wisdom: 'Мудрость', charisma: 'Харизма' };
        const sKeys = ['strength', 'agility', 'endurance', 'intelligence', 'wisdom', 'charisma'];
        let sHtml = sKeys.map(k => `<div class="stat-item"><span>${statMap[k]}</span><span>${s[k] ?? '—'}</span></div>`).join('');
        return `
            ${d.profession ? `<div style="display:flex;gap:0.5rem;margin-bottom:0.3rem;"><span class="char-class">${d.profession}</span>${d.role ? `<span class="char-role">${d.role}</span>` : ''}<span style="font-size:0.7rem;color:#8899aa;">Lv.${d.level || '—'}</span></div>` : ''}
            <div class="hp-ac"><span>❤️ <strong>${h.current}</strong> / ${h.max} HP</span><span>🛡️ <strong>${a.ac}</strong> AC · ${a.type}</span><span>Сопр. ${a.resistance} · Прочн. ${a.durability}</span></div>
            <div class="stats-grid">${sHtml}</div>
            ${d.backstory ? `<div class="info-block"><strong>📜 Предыстория</strong><div class="description-text">${d.backstory}</div></div>` : ''}
            <div class="info-block"><strong>📖 Описание</strong><div class="description-text">${d.description || '—'}</div></div>
            ${eq.length ? `<div class="info-block"><strong>⚒️ Снаряжение</strong><div class="list-tag">${eq.map(e => `<span>${e.name||e}</span>`).join('')}</div></div>` : ''}
            ${con.length ? `<div class="info-block"><strong>🧪 Расходники</strong><div class="list-tag">${con.map(c => `<span class="item-qty">${c.name||c} ${c.quantity ? '×'+c.quantity : ''}</span>`).join('')}</div></div>` : ''}
            ${sk.length ? `<div class="info-block"><strong>🎯 Навыки</strong><div class="list-tag">${sk.map(s => `<span>${s.name||s}</span>`).join('')}</div></div>` : ''}
            ${goals.length ? `<div class="info-block"><strong>🎯 Цели</strong><div class="list-tag">${goals.map(g => `<span class="goal-item">🎯 ${g}</span>`).join('')}</div></div>` : ''}
        `;
    }

    function buildFriendlyCardBody(d) {
        const s = d.stats || {};
        const a = d.armor || { ac: '—', resistance: '—', durability: '—' };
        const sk = d.skills || [];
        const diag = d.dialogue || {};
        return `
            <div class="hp-ac"><span>❤️ <strong>${d.health || '—'}</strong> HP</span><span>🛡️ <strong>${a.ac}</strong> AC</span><span>Сопр. ${a.resistance} · Прочн. ${a.durability}</span></div>
            ${Object.keys(s).length ? `<div class="stats-grid">${Object.entries(s).map(([k,v]) => `<div class="stat-item"><span>${k}</span><span>${v}</span></div>`).join('')}</div>` : ''}
            <div class="info-block"><strong>📖 Описание</strong><div class="description-text">${d.description || '—'}</div></div>
            ${d.motivation ? `<div class="info-block"><strong>🎯 Мотивация</strong><div class="description-text">${d.motivation}</div></div>` : ''}
            ${d.secrets?.length ? `<div class="info-block"><strong>🔍 Тайны</strong><div class="list-tag">${d.secrets.map(s => `<span>🔎 ${s}</span>`).join('')}</div></div>` : ''}
            ${sk.length ? `<div class="info-block"><strong>⚔️ Навыки</strong><div class="list-tag">${sk.map(s => `<span>${s.name||s}</span>`).join('')}</div></div>` : ''}
            ${Object.keys(diag).length ? `<div class="info-block"><strong>💬 Диалоги</strong><div class="list-tag">${Object.entries(diag).map(([k,v]) => `<span>${k}: ${v}</span>`).join('')}</div></div>` : ''}
        `;
    }

    function buildEnemyCardBody(d, fullMode) {
        const s = d.stats || {};
        const a = d.armor || { ac: '—', resistance: '—', durability: '—' };
        const sk = d.skills || [];
        const extra = fullMode ? buildDndEnemyExtra(d) : '';
        return `
            ${d.subtype ? `<div style="font-size:0.8rem;color:#8899aa;margin-bottom:0.3rem;">${d.subtype}</div>` : ''}
            ${extra}
            <div class="hp-ac"><span>❤️ <strong>${d.health || '—'}</strong> HP</span><span>🛡️ <strong>${a.ac}</strong> AC</span><span>Сопр. ${a.resistance} · Прочн. ${a.durability}</span></div>
            ${Object.keys(s).length ? `<div class="stats-grid">${Object.entries(s).map(([k,v]) => `<div class="stat-item"><span>${k}</span><span>${v}</span></div>`).join('')}</div>` : ''}
            <div class="info-block"><strong>📖 Описание</strong><div class="description-text">${d.description || '—'}</div></div>
            ${sk.length ? `<div class="info-block"><strong>⚔️ Навыки</strong><div class="list-tag">${sk.map(s => `<span>${s.name||s}${s.damage ? ' ('+s.damage+')' : ''}</span>`).join('')}</div></div>` : ''}
            ${d.weakness ? `<div class="info-block"><strong>⚠️ Слабость</strong><div class="list-tag"><span>${d.weakness}</span></div></div>` : ''}
            ${d.location ? `<div class="info-block"><strong>📍 Локация</strong><div class="description-text">${d.location}</div></div>` : ''}
            ${d.dialogue ? `<div class="info-block"><strong>💬 Диалоги</strong><div class="list-tag">${Object.entries(d.dialogue).map(([k,v]) => `<span>${k}: ${v}</span>`).join('')}</div></div>` : ''}
        `;
    }

    function buildEquipmentCardBody(d, type) {
        const tL = { weapon: '⚔️ оружие', armor: '🛡️ броня', artifact: '🔮 артефакт', tool: '🔧 инструмент' };
        let extra = '';
        if (type === 'weapon') extra = `${d.damage ? `<span><strong>Урон:</strong> ${d.damage}</span>` : ''}${d.bonus ? `<span><strong>Бонус:</strong> ${d.bonus}</span>` : ''}${d.range ? `<span><strong>Дальность:</strong> ${d.range}</span>` : ''}`;
        else if (type === 'armor') extra = `${d.ac ? `<span><strong>КБ:</strong> ${d.ac}</span>` : ''}${d.resistance ? `<span><strong>Сопр.:</strong> ${d.resistance}</span>` : ''}${d.durability ? `<span><strong>Прочн.:</strong> ${d.durability}</span>` : ''}`;
        else extra = `${d.bonus ? `<span><strong>Бонус:</strong> ${d.bonus}</span>` : ''}`;
        return `
            <div class="info-block"><strong>📖 Описание</strong><div class="description-text">${d.description || '—'}</div></div>
            ${extra ? `<div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin:0.3rem 0;font-size:0.85rem;background:#1f262e;padding:0.3rem 0.7rem;border-radius:16px;">${extra}${d.weight ? `<span><strong>Вес:</strong> ${d.weight}</span>` : ''}</div>` : ''}
        `;
    }

    function buildConsumableCardBody(d) {
        return `
            <div class="info-block"><strong>📖 Описание</strong><div class="description-text">${d.description || '—'}</div></div>
            <div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin:0.3rem 0;font-size:0.85rem;background:#1f262e;padding:0.3rem 0.7rem;border-radius:16px;">
                ${d.effect ? `<span><strong>Эффект:</strong> ${d.effect}</span>` : ''}
                ${d.rarity ? `<span><strong>Редкость:</strong> ${d.rarity}</span>` : ''}
                ${d.weight ? `<span><strong>Вес:</strong> ${d.weight}</span>` : ''}
            </div>
        `;
    }

    function buildSkillCardBody(d) {
        return `
            <div class="info-block"><strong>📖 Описание</strong><div class="description-text">${d.description || '—'}</div></div>
            ${d.effect ? `<div style="background:#1f262e;padding:0.3rem 0.7rem;border-radius:16px;margin-top:0.3rem;font-size:0.85rem;"><strong>Эффект:</strong> ${d.effect}</div>` : ''}
            ${d.damage ? `<div style="background:#1f262e;padding:0.3rem 0.7rem;border-radius:16px;margin-top:0.3rem;font-size:0.85rem;"><strong>Урон:</strong> ${d.damage}</div>` : ''}
            ${d.check ? `<div style="background:#1f262e;padding:0.3rem 0.7rem;border-radius:16px;margin-top:0.3rem;font-size:0.85rem;"><strong>Проверка:</strong> ${d.check}</div>` : ''}
        `;
    }

    function buildLocationCardBody(d) {
        const clues = d.clues || [];
        const npcs = d.npcs || [];
        const loot = d.loot || [];
        return `
            <div class="info-block"><strong>📖 Описание</strong><div class="description-text">${d.description || '—'}</div></div>
            ${d.atmosphere ? `<div class="info-block"><strong>🌫️ Атмосфера</strong><div class="description-text">${d.atmosphere}</div></div>` : ''}
            ${npcs.length ? `<div class="info-block"><strong>👥 NPC</strong><div class="list-tag">${npcs.map(n => `<span>${n}</span>`).join('')}</div></div>` : ''}
            ${clues.length ? `<div class="info-block"><strong>🔍 Улики</strong><div class="list-tag">${clues.map(c => `<span>🔎 ${c}</span>`).join('')}</div></div>` : ''}
            ${loot.length ? `<div class="info-block"><strong>🎁 Лут</strong><div class="list-tag">${loot.map(l => `<span>${l.name} ${l.chance ? '('+l.chance+')' : ''}${l.quantity ? ' ×'+l.quantity : ''}</span>`).join('')}</div></div>` : ''}
        `;
    }

    function buildStoryCardBody(d) {
        const v = d.villain || {};
        const endings = d.endings || {};
        return `
            <div class="info-block"><strong>📜 Сводка</strong><div class="description-text">${d.summary || d.plot || '—'}</div></div>
            <div class="info-block"><strong>🕵️ Истинная причина</strong><div class="description-text">${d.true_cause || '—'}</div></div>
            <div class="info-block"><strong>👤 Злодей</strong><div style="background:#1f262e;border-radius:16px;padding:0.3rem 0.7rem;margin-top:4px;"><div><strong>Имя:</strong> ${v.name || '—'}</div><div><strong>Мотивация:</strong> ${v.motivation || '—'}</div>${v.secrets?.length ? `<div><strong>Тайны:</strong> ${v.secrets.join(', ')}</div>` : ''}</div></div>
            <div class="info-block"><strong>🏁 Концовки</strong><div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:4px;">${Object.entries(endings).map(([k,v]) => `<span style="background:#2a3a3a;padding:0.2rem 0.7rem;border-radius:30px;font-size:0.8rem;border:1px solid #4a6a5a;">${k}: ${v}</span>`).join('')}</div></div>
            ${d.moral ? `<div class="info-block"><strong>💡 Мораль</strong><div class="description-text">${d.moral}</div></div>` : ''}
        `;
    }

    function buildRewardCardBody(d) {
        const paths = d.paths || [];
        let h = '';
        paths.forEach(p => {
            h += `<div class="info-block" style="margin-top:0.5rem;background:#1f262e;border-radius:16px;padding:0.5rem 0.7rem;"><strong>${p.name || 'Путь'}</strong><div class="description-text">${p.description || '—'}</div>${p.rewards?.length ? `<div><strong>✅ Награды:</strong> ${p.rewards.join(', ')}</div>` : ''}${p.penalties?.length ? `<div><strong>❌ Штрафы:</strong> ${p.penalties.join(', ')}</div>` : ''}</div>`;
        });
        return h || '<div class="info-block">Нет данных о наградах</div>';
    }

    // ==============================
    // 10. CARD ACTIONS (delete, edit)
    // ==============================
    function attachCardHandlers() {
        container.querySelectorAll('button[data-action^="delete-card-"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.action.replace('delete-card-', '');
                deleteCard(id);
            });
        });
        container.querySelectorAll('button[data-action^="edit-card-"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.action.replace('edit-card-', '');
                editCard(id);
            });
        });
    }

    function deleteCard(cardId) {
        if (!confirm('Удалить эту карточку?')) return;
        db.collection('cards').doc(cardId).delete()
            .then(() => showToast('🗑️ Карточка удалена'))
            .catch(err => showToast('❌ Ошибка: ' + err.message, true));
    }

    function editCard(cardId) {
        const card = [...currentCards, ...currentCommonCards].find(c => c.id === cardId);
        if (!card) return;
        openCardModal(card);
    }

    // ==============================
    // 11. CARD MODAL (create/edit)
    // ==============================
    function openCardModal(card) {
        const isEdit = !!card;
        editingCardId = isEdit ? card.id : null;
        $('modalTitle').textContent = isEdit ? '✏️ Редактировать карточку' : '➕ Новая карточка';

        if (isEdit) {
            const data = card.data || {};
            $('cardTypeSelect').value = card.type || 'player';
            $('cardName').value = data.name || card.name || '';
            $('cardDescription').value = data.description || '';
            $('cardIsCommon').checked = !!card.isCommon;
            // Disable type change on edit
            $('cardTypeSelect').disabled = true;
        } else {
            $('cardTypeSelect').value = 'player';
            $('cardName').value = '';
            $('cardDescription').value = '';
            $('cardIsCommon').checked = false;
            $('cardTypeSelect').disabled = false;
        }
        renderCardExtraFields($('cardTypeSelect').value, isEdit ? card.data : null);
        $('cardModal').style.display = 'flex';
    }

    $('addCardBtn').addEventListener('click', () => openCardModal(null));
    $('modalCloseBtn').addEventListener('click', () => { $('cardModal').style.display = 'none';
        $('cardTypeSelect').disabled = false; });
    $('modalCancelBtn').addEventListener('click', () => { $('cardModal').style.display = 'none';
        $('cardTypeSelect').disabled = false; });

    $('cardTypeSelect').addEventListener('change', function() {
        renderCardExtraFields(this.value, null);
    });

    function renderCardExtraFields(type, data) {
        const el = $('cardExtraFields');
        const d = data || getDefaultCardData(type);
        const fullMode = isFullMode();
        let html = '';

        switch (type) {
            case 'player':
                if (fullMode) {
                    html = `
                        <div class="dnd-editor-hint">🐉 Полные правила D&D 5e — заполните поля ниже</div>
                        <div class="form-row">
                            <div class="form-group"><label>🎭 Раса</label><input type="text" id="cf_race" class="input" value="${esc(d.race||'')}" placeholder="Человек, Эльф..."></div>
                            <div class="form-group"><label>⚔️ Класс</label><input type="text" id="cf_class" class="input" value="${esc(d.class||'')}" placeholder="Воин, Маг..."></div>
                            <div class="form-group"><label>📖 Архетип</label><input type="text" id="cf_subclass" class="input" value="${esc(d.subclass||'')}"></div>
                        </div>
                        <div class="form-row">
                            <div class="form-group"><label>📖 Предыстория</label><input type="text" id="cf_background" class="input" value="${esc(d.background||'')}"></div>
                            <div class="form-group"><label>⚖️ Мировоззрение</label><input type="text" id="cf_alignment" class="input" value="${esc(d.alignment||'')}" placeholder="Нейтральный добрый"></div>
                            <div class="form-group"><label>📊 XP</label><input type="text" id="cf_xp" class="input" value="${esc(d.xp||'')}"></div>
                        </div>
                        <div class="form-row">
                            <div class="form-group"><label>Уровень</label><input type="number" id="cf_level" class="input" value="${d.level||1}" oninput="document.getElementById('cf_prof_hint').textContent='+'+calcProfBonus(this.value)"></div>
                            <div class="form-group"><label>❤️ Макс. HP</label><input type="number" id="cf_hp_max" class="input" value="${(d.health&&d.health.max)||10}"></div>
                            <div class="form-group"><label>🏃‍♂️ Скорость</label><input type="text" id="cf_speed" class="input" value="${esc(d.speed||'30')}"></div>
                        </div>
                        <div class="form-row">
                            <div class="form-group"><label>🎲 Кости HP</label><input type="text" id="cf_hitDice" class="input" value="${esc(d.hitDice||'')}" placeholder="d10"></div>
                            <div class="form-group"><label>🛡️ КБ</label><input type="number" id="cf_ac" class="input" value="${(d.armor&&d.armor.ac)||10}"></div>
                        </div>
                        <div class="form-group"><label>Статы (через запятую: Сила 15, Ловкость 14...)</label><input type="text" id="cf_stats" class="input" value="${formatStats(d.stats)}" placeholder="Сила 15, Ловкость 14, Телосложение 13, Интеллект 12, Мудрость 10, Харизма 8"></div>
                        <div class="dnd-editor-hint">💡 Модификаторы рассчитываются автоматически: (стат - 10) / 2, Б.М. = ceil(уровень/4) + 1</div>
                        <div class="form-group"><label>🛡️ Спасброски (владение)</label><div class="checkbox-group" id="cf_saveProfs"></div></div>
                        <div class="form-group"><label>🎯 Навыки (владение)</label><div class="skills-checkbox-grid" id="cf_skillProfs"></div></div>
                        <div class="form-group"><label>🔮 Заклинательная способность</label><select id="cf_spellAbility" class="input"><option value="">— Нет заклинаний —</option><option value="intelligence" ${d.spellcastingAbility==='intelligence'?'selected':''}>Интеллект</option><option value="wisdom" ${d.spellcastingAbility==='wisdom'?'selected':''}>Мудрость</option><option value="charisma" ${d.spellcastingAbility==='charisma'?'selected':''}>Харизма</option></select></div>
                        <div class="form-group"><label>Особенности/черты (каждая с новой строки — название | описание)</label><textarea id="cf_features" class="input" rows="2">${formatFeatures(d.features)}</textarea></div>
                    `;
                    // Save/Skill checkboxes will be populated after render
                    setTimeout(() => populateDndCheckboxes(d), 0);
                } else {
                    html = `
                    <div class="form-row"><div class="form-group"><label>Профессия</label><input type="text" id="cf_profession" class="input" value="${esc(d.profession||'')}"></div>
                    <div class="form-group"><label>Роль</label><input type="text" id="cf_role" class="input" value="${esc(d.role||'')}"></div>
                    <div class="form-group"><label>Уровень</label><input type="number" id="cf_level" class="input" value="${d.level||1}"></div></div>
                    <div class="form-row"><div class="form-group"><label>❤️ HP макс</label><input type="number" id="cf_hp_max" class="input" value="${(d.health&&d.health.max)||10}"></div>
                    <div class="form-group"><label>❤️ HP тек.</label><input type="number" id="cf_hp_cur" class="input" value="${(d.health&&d.health.current)||10}"></div>
                    <div class="form-group"><label>🛡️ КБ</label><input type="number" id="cf_ac" class="input" value="${(d.armor&&d.armor.ac)||10}"></div></div>
                    <div class="form-group"><label>Статы (через запятую: Сила 5, Ловкость 3...)</label><input type="text" id="cf_stats" class="input" value="${formatStats(d.stats)}"></div>
                    <div class="form-group"><label>Снаряжение (через запятую)</label><input type="text" id="cf_equipment" class="input" value="${formatArray(d.equipment)}"></div>
                    <div class="form-group"><label>Цели (каждая с новой строки)</label><textarea id="cf_goals" class="input" rows="2">${formatArrayMultiline(d.goals)}</textarea></div>
                `;
                }
                break;
            case 'friendly':
                html = `
                    <div class="form-group"><label>Роль</label><input type="text" id="cf_role" class="input" value="${esc(d.role||'')}"></div>
                    <div class="form-row"><div class="form-group"><label>❤️ HP</label><input type="number" id="cf_hp" class="input" value="${d.health||10}"></div>
                    <div class="form-group"><label>🛡️ КБ</label><input type="number" id="cf_ac" class="input" value="${(d.armor&&d.armor.ac)||10}"></div></div>
                    <div class="form-group"><label>Мотивация</label><input type="text" id="cf_motivation" class="input" value="${esc(d.motivation||'')}"></div>
                `;
                break;
            case 'enemy':
                if (fullMode) {
                    html = `
                        <div class="dnd-editor-hint">🐉 Полные правила D&D 5e</div>
                        <div class="form-group"><label>Тип врага</label><input type="text" id="cf_subtype" class="input" value="${esc(d.subtype||'')}"></div>
                        <div class="form-row">
                            <div class="form-group"><label>❤️ HP</label><input type="number" id="cf_hp" class="input" value="${d.health||10}"></div>
                            <div class="form-group"><label>🛡️ КБ</label><input type="number" id="cf_ac" class="input" value="${(d.armor&&d.armor.ac)||10}"></div>
                            <div class="form-group"><label>⚠️ CR</label><input type="text" id="cf_cr" class="input" value="${esc(d.challengeRating||'')}"></div>
                            <div class="form-group"><label>📊 XP</label><input type="text" id="cf_xp" class="input" value="${esc(d.xp||'')}"></div>
                        </div>
                        <div class="form-group"><label>🔰 Сопротивления (через запятую)</label><input type="text" id="cf_resistances" class="input" value="${formatArraySimple(d.resistances)}" placeholder="огонь, холод"></div>
                        <div class="form-group"><label>🛡️ Иммунитеты (через запятую)</label><input type="text" id="cf_immunities" class="input" value="${formatArraySimple(d.immunities)}" placeholder="яд, некротический"></div>
                        <div class="form-group"><label>🧊 Недейств. эффекты (через запятую)</label><input type="text" id="cf_condImmunities" class="input" value="${formatArraySimple(d.conditionImmunities)}" placeholder="очарование, испуг"></div>
                        <div class="form-row">
                            <div class="form-group"><label>👁️ Чувства</label><input type="text" id="cf_senses" class="input" value="${esc(d.senses||'')}" placeholder="тёмное зрение 60 фт"></div>
                            <div class="form-group"><label>🗣️ Языки</label><input type="text" id="cf_languages" class="input" value="${esc(d.languages||'')}"></div>
                        </div>
                        <div class="form-group"><label>👑 Легендарных действий за ход</label><input type="number" id="cf_legendary" class="input" value="${d.legendaryActions||0}"></div>
                        <div class="form-group"><label>Слабость</label><input type="text" id="cf_weakness" class="input" value="${esc(d.weakness||'')}"></div>
                        <div class="form-group"><label>Локация</label><input type="text" id="cf_location" class="input" value="${esc(d.location||'')}"></div>
                    `;
                } else {
                    html = `
                    <div class="form-group"><label>Тип врага</label><input type="text" id="cf_subtype" class="input" value="${esc(d.subtype||'')}"></div>
                    <div class="form-row"><div class="form-group"><label>❤️ HP</label><input type="number" id="cf_hp" class="input" value="${d.health||10}"></div>
                    <div class="form-group"><label>🛡️ КБ</label><input type="number" id="cf_ac" class="input" value="${(d.armor&&d.armor.ac)||10}"></div></div>
                    <div class="form-group"><label>Слабость</label><input type="text" id="cf_weakness" class="input" value="${esc(d.weakness||'')}"></div>
                    <div class="form-group"><label>Локация</label><input type="text" id="cf_location" class="input" value="${esc(d.location||'')}"></div>
                `;
                }
                break;
                break;
            case 'weapon':
                html = `
                    <div class="form-row"><div class="form-group"><label>⚔️ Урон</label><input type="text" id="cf_damage" class="input" value="${esc(d.damage||'')}"></div>
                    <div class="form-group"><label>📏 Дальность</label><input type="text" id="cf_range" class="input" value="${esc(d.range||'')}"></div>
                    <div class="form-group"><label>⚖️ Вес</label><input type="text" id="cf_weight" class="input" value="${esc(d.weight||'')}"></div></div>
                `;
                break;
            case 'armor':
                html = `
                    <div class="form-row"><div class="form-group"><label>🛡️ КБ</label><input type="text" id="cf_ac" class="input" value="${esc(d.ac||'')}"></div>
                    <div class="form-group"><label>Сопротивление</label><input type="text" id="cf_resistance" class="input" value="${esc(d.resistance||'')}"></div>
                    <div class="form-group"><label>Прочность</label><input type="text" id="cf_durability" class="input" value="${esc(d.durability||'')}"></div>
                    <div class="form-group"><label>⚖️ Вес</label><input type="text" id="cf_weight" class="input" value="${esc(d.weight||'')}"></div></div>
                `;
                break;
            case 'artifact':
            case 'tool':
                html = `
                    <div class="form-row"><div class="form-group"><label>🔮 Бонус</label><input type="text" id="cf_bonus" class="input" value="${esc(d.bonus||'')}"></div>
                    <div class="form-group"><label>⚖️ Вес</label><input type="text" id="cf_weight" class="input" value="${esc(d.weight||'')}"></div></div>
                `;
                break;
            case 'consumable':
                html = `
                    <div class="form-row"><div class="form-group"><label>Тип</label><input type="text" id="cf_ctype" class="input" value="${esc(d.type||'')}"></div>
                    <div class="form-group"><label>Эффект</label><input type="text" id="cf_effect" class="input" value="${esc(d.effect||'')}"></div>
                    <div class="form-group"><label>Редкость</label><input type="text" id="cf_rarity" class="input" value="${esc(d.rarity||'')}"></div>
                    <div class="form-group"><label>⚖️ Вес</label><input type="text" id="cf_weight" class="input" value="${esc(d.weight||'')}"></div></div>
                `;
                break;
            case 'skill':
                html = `
                    <div class="form-row"><div class="form-group"><label>Тип навыка</label><input type="text" id="cf_skilltype" class="input" value="${esc(d.type||'')}"></div>
                    <div class="form-group"><label>Перезарядка</label><input type="text" id="cf_cooldown" class="input" value="${esc(d.cooldown||'')}"></div></div>
                    <div class="form-row"><div class="form-group"><label>Эффект</label><input type="text" id="cf_effect" class="input" value="${esc(d.effect||'')}"></div>
                    <div class="form-group"><label>⚔️ Урон</label><input type="text" id="cf_damage" class="input" value="${esc(d.damage||'')}"></div>
                    <div class="form-group"><label>📋 Проверка</label><input type="text" id="cf_check" class="input" value="${esc(d.check||'')}"></div></div>
                `;
                break;
            case 'location':
                html = `<div class="form-group"><label>🌫️ Атмосфера</label><input type="text" id="cf_atmosphere" class="input" value="${esc(d.atmosphere||'')}"></div>`;
                break;
            case 'story':
                html = `
                    <div class="form-group"><label>📜 Сводка</label><textarea id="cf_summary" class="input" rows="3">${esc(d.summary||d.plot||'')}</textarea></div>
                    <div class="form-group"><label>🕵️ Истинная причина</label><input type="text" id="cf_truecause" class="input" value="${esc(d.true_cause||'')}"></div>
                `;
                break;
            case 'reward':
                html = `<div class="form-group"><label>Описание наград</label><textarea id="cf_rewarddesc" class="input" rows="3">${esc(d.description||'')}</textarea></div>`;
                break;
        }
        el.innerHTML = html;
    }

    function esc(s) { return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    function formatArraySimple(arr) {
        return Array.isArray(arr) ? arr.join(', ') : '';
    }

    function formatFeatures(features) {
        if (!Array.isArray(features)) return '';
        return features.map(f => typeof f === 'string' ? f : (f.name || '') + ' | ' + (f.description || '')).join('\n');
    }

    function populateDndCheckboxes(d) {
        const saveContainer = document.getElementById('cf_saveProfs');
        if (saveContainer) {
            saveContainer.innerHTML = SAVE_ABILITIES.map(k =>
                `<label class="checkbox-label"><input type="checkbox" value="${k}" ${(d.saveProficiencies||[]).includes(k)?'checked':''}>${SAVE_LABELS[k]}</label>`
            ).join('');
        }
        const skillContainer = document.getElementById('cf_skillProfs');
        if (skillContainer) {
            skillContainer.innerHTML = Object.entries(SKILLS_5E).map(([k, label]) =>
                `<label class="checkbox-label"><input type="checkbox" value="${k}" ${(d.skillProficiencies||[]).includes(k)?'checked':''}>${label}</label>`
            ).join('');
        }
    }

    function collectCheckboxValues(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return [];
        return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
    }

    function collectFeatures(str) {
        return str.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
            const parts = line.split('|').map(s => s.trim());
            if (parts.length > 1) return { name: parts[0], description: parts.slice(1).join(' | ') };
            return { name: parts[0], description: '' };
        });
    }

    function formatStats(stats) {
        if (!stats) return '';
        return Object.entries(stats).map(([k, v]) => {
            const map = { strength: 'Сила', agility: 'Ловкость', endurance: 'Телосложение', intelligence: 'Интеллект', wisdom: 'Мудрость', charisma: 'Харизма' };
            return `${map[k]||k} ${v}`;
        }).join(', ');
    }

    function formatArray(arr) {
        if (!arr || !arr.length) return '';
        return arr.map(i => typeof i === 'string' ? i : i.name || '').join(', ');
    }

    function formatArrayMultiline(arr) {
        if (!arr || !arr.length) return '';
        return arr.join('\n');
    }

    function parseStats(str) {
        const map = { сила: 'strength', ловкость: 'agility', телосложение: 'endurance', интеллект: 'intelligence', мудрость: 'wisdom', харизма: 'charisma' };
        const result = {};
        str.split(',').forEach(part => {
            const m = part.trim().match(/^([а-яёa-z]+)\s*[:\-]?\s*(\d+)$/i);
            if (m) {
                const key = map[m[1].toLowerCase()] || m[1].toLowerCase();
                result[key] = parseInt(m[2]);
            }
        });
        return result;
    }

    function parseArray(str) {
        return str.split(',').map(s => s.trim()).filter(Boolean);
    }

    function parseArrayMultiline(str) {
        return str.split('\n').map(s => s.trim()).filter(Boolean);
    }

    function collectCardDataFromForm(type) {
        const g = id => document.getElementById(id);
        const v = id => (g(id) || {}).value || '';
        const num = (id, def) => {
            const el = g(id);
            return el ? parseInt(el.value) || def : def;
        };
        const data = { name: v('cardName'), description: v('cardDescription') };
        const fullMode = isFullMode();

        switch (type) {
            case 'player':
                if (fullMode) {
                    data.race = v('cf_race');
                    data.class = v('cf_class');
                    data.subclass = v('cf_subclass');
                    data.background = v('cf_background');
                    data.alignment = v('cf_alignment');
                    data.xp = v('cf_xp');
                    data.level = num('cf_level', 1);
                    data.health = { max: num('cf_hp_max', 10), current: num('cf_hp_max', 10) };
                    data.armor = { type: '', ac: num('cf_ac', 10), resistance: 0, durability: 0 };
                    data.speed = v('cf_speed') || '30';
                    data.hitDice = v('cf_hitDice');
                    data.stats = parseStats(v('cf_stats'));
                    data.saveProficiencies = collectCheckboxValues('cf_saveProfs');
                    data.skillProficiencies = collectCheckboxValues('cf_skillProfs');
                    data.spellcastingAbility = v('cf_spellAbility') || '';
                    data.features = collectFeatures(v('cf_features'));
                    data.equipment = [];
                    data.consumables = [];
                    data.skills = [];
                    data.goals = [];
                } else {
                    data.profession = v('cf_profession');
                    data.role = v('cf_role');
                    data.level = num('cf_level', 1);
                    data.health = { max: num('cf_hp_max', 10), current: num('cf_hp_cur', 10) };
                    data.armor = { type: '', ac: num('cf_ac', 10), resistance: 0, durability: 0 };
                    data.stats = parseStats(v('cf_stats'));
                    data.equipment = parseArray(v('cf_equipment')).map(n => ({ name: n }));
                    data.consumables = [];
                    data.skills = [];
                    data.goals = parseArrayMultiline(v('cf_goals'));
                }
                break;
            case 'friendly':
                data.role = v('cf_role');
                data.health = num('cf_hp', 10);
                data.armor = { ac: num('cf_ac', 10), resistance: 0, durability: 0 };
                data.motivation = v('cf_motivation');
                data.stats = {};
                data.secrets = [];
                data.skills = [];
                data.dialogue = {};
                break;
            case 'enemy':
                if (fullMode) {
                    data.subtype = v('cf_subtype');
                    data.health = num('cf_hp', 10);
                    data.armor = { ac: num('cf_ac', 10), resistance: 0, durability: 0 };
                    data.challengeRating = v('cf_cr');
                    data.xp = v('cf_xp');
                    data.resistances = parseArray(v('cf_resistances'));
                    data.immunities = parseArray(v('cf_immunities'));
                    data.conditionImmunities = parseArray(v('cf_condImmunities'));
                    data.senses = v('cf_senses');
                    data.languages = v('cf_languages');
                    data.legendaryActions = num('cf_legendary', 0);
                    data.weakness = v('cf_weakness');
                    data.location = v('cf_location');
                } else {
                    data.subtype = v('cf_subtype');
                    data.health = num('cf_hp', 10);
                    data.armor = { ac: num('cf_ac', 10), resistance: 0, durability: 0 };
                    data.weakness = v('cf_weakness');
                    data.location = v('cf_location');
                }
                data.stats = {};
                data.skills = [];
                data.dialogue = {};
                break;
            case 'weapon':
                data.damage = v('cf_damage');
                data.range = v('cf_range');
                data.weight = v('cf_weight');
                break;
            case 'armor':
                data.ac = v('cf_ac');
                data.resistance = v('cf_resistance');
                data.durability = v('cf_durability');
                data.weight = v('cf_weight');
                break;
            case 'artifact':
            case 'tool':
                data.bonus = v('cf_bonus');
                data.weight = v('cf_weight');
                break;
            case 'consumable':
                data.type = v('cf_ctype');
                data.effect = v('cf_effect');
                data.rarity = v('cf_rarity');
                data.weight = v('cf_weight');
                break;
            case 'skill':
                data.type = v('cf_skilltype');
                data.cooldown = v('cf_cooldown');
                data.effect = v('cf_effect');
                data.damage = v('cf_damage');
                data.check = v('cf_check');
                break;
            case 'location':
                data.atmosphere = v('cf_atmosphere');
                data.clues = [];
                data.npcs = [];
                data.loot = [];
                break;
            case 'story':
                data.summary = v('cf_summary');
                data.true_cause = v('cf_truecause');
                data.villain = { name: '', motivation: '', secrets: [] };
                data.endings = {};
                data.moral = '';
                break;
            case 'reward':
                data.paths = [{ name: 'Путь', description: v('cf_rewarddesc'), rewards: [], penalties: [] }];
                break;
        }
        return data;
    }

    $('modalSaveBtn').addEventListener('click', () => {
        if (!currentUser || !currentGame && !editingCardId) {
            showToast('❌ Нет активной игры', true);
            return;
        }
        const type = $('cardTypeSelect').value;
        const name = $('cardName').value.trim();
        if (!name) { showToast('❌ Введите название карточки', true); return; }
        const data = collectCardDataFromForm(type);
        data.name = name;
        const isCommon = $('cardIsCommon').checked;

        const cardData = {
            type,
            name,
            data,
            isCommon,
            ownerId: currentUser.uid,
        };

        if (editingCardId) {
            // Update existing card
            db.collection('cards').doc(editingCardId).update({
                ...cardData,
                data: data
            }).then(() => {
                $('cardModal').style.display = 'none';
                $('cardTypeSelect').disabled = false;
                showToast('✅ Карточка обновлена');
            }).catch(err => showToast('❌ Ошибка: ' + err.message, true));
        } else {
            // New card
            if (!currentGame) { showToast('❌ Нет активной игры', true); return; }
            cardData.gameId = currentGame.id;
            cardData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            db.collection('cards').add(cardData).then(() => {
                $('cardModal').style.display = 'none';
                showToast('✅ Карточка создана');
            }).catch(err => showToast('❌ Ошибка: ' + err.message, true));
        }
    });

    // ==============================
    // 12. FILTER
    // ==============================
    filterBar.addEventListener('click', function(e) {
        const btn = e.target.closest('.filter-btn');
        if (!btn) return;
        filterBar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderCards();
    });

    // ==============================
    // 13. EXPORT GAME
    // ==============================
    $('exportGameBtn').addEventListener('click', () => {
        if (!currentGame) return;
        const exportData = {
            game: { name: currentGame.name, setting: currentGame.setting, description: currentGame.description },
            cards: currentCards.map(c => ({ type: c.type, data: c.data, isCommon: c.isCommon }))
        };
        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `game_${currentGame.name}_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('💾 Игра экспортирована');
    });

    $('printGameBtn').addEventListener('click', () => window.print());

    // ==============================
    // 14. INIT
    // ==============================
    // Check if firebaseConfig exists
    if (typeof firebaseConfig === 'undefined') {
        document.body.innerHTML = `
            <div class="app" style="padding:2rem;max-width:600px;margin:0 auto;">
                <h2>⚔️ D&D Конструктор</h2>
                <div style="background:#2a2a3a;border-radius:16px;padding:1.5rem;margin-top:1rem;border:1px solid #5a5a7a;">
                    <h3>🔧 Настройка Firebase</h3>
                    <p>Создайте файл <code>firebase-config.js</code> в корне проекта:</p>
                    <pre style="background:#1a1a2a;padding:1rem;border-radius:8px;margin:1rem 0;font-size:0.8rem;overflow-x:auto;">
// firebase-config.js
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
                    </pre>
                    <ol style="margin-left:1.2rem;line-height:1.8;">
                        <li>Зайдите на <a href="https://console.firebase.google.com" target="_blank" style="color:#b48b5a;">Firebase Console</a></li>
                        <li>Создайте проект (или выберите существующий)</li>
                        <li>В настройках проекта → <strong>Web-приложение</strong> → скопируйте config</li>
                        <li>Создайте <strong>Firestore Database</strong> (начните в тестовом режиме)</li>
                        <li>Включите <strong>Authentication</strong> → Sign-in method → <strong>Email/Password</strong></li>
                        <li>Вставьте config в <code>firebase-config.js</code></li>
                    </ol>
                </div>
            </div>
        `;
        return;
    }

    // Create Firestore indexes note
    console.log('D&D Конструктор запущен. Убедитесь, что в Firestore созданы индексы для:');
    console.log('- cards: gameId ASC');
    console.log('- cards: isCommon ASC');
    console.log('- games: ownerId ASC, createdAt DESC');
})();
