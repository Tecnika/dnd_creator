(function() {
    // ----- ЗАГРУЗКА JSON ПО УМОЛЧАНИЮ ИЗ ФАЙЛА -----
    let defaultData = null;
    let dataLoaded = false;
    let data = null;
    let currentFilter = 'all';

    // DOM ссылки
    const container = document.getElementById('cardContainer');
    const jsonArea = document.getElementById('jsonInputArea');
    const jsonTextarea = document.getElementById('jsonTextarea');
    const toast = document.getElementById('toast');
    const gameInfo = document.getElementById('gameInfo');
    const filterBar = document.getElementById('filterBar');

    // ----- Утилиты -----
    function showToast(msg, isError = false) {
        toast.textContent = msg;
        toast.className = 'toast' + (isError ? ' error' : '');
        toast.style.display = 'block';
        clearTimeout(toast._hideTimer);
        toast._hideTimer = setTimeout(() => { toast.style.display = 'none'; }, 3500);
    }

    function updateGameInfo() {
        if (data && data.game) {
            gameInfo.innerHTML =
                `🏔️ <strong>${data.game.name || 'Без названия'}</strong> · ${data.game.setting || '—'} v${data.game.version || '1.0'}`;
        } else {
            gameInfo.innerHTML = '🏔️ <strong>Игра</strong>';
        }
    }

    // ----- Сохранение в localStorage -----
    function saveToLocalStorage() {
        try {
            if (data) localStorage.setItem('dnd_gniloy_obrok_print_v4', JSON.stringify(data));
        } catch (e) { /* ignore */ }
    }

    function loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('dnd_gniloy_obrok_print_v4');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && typeof parsed === 'object' && 'characters' in parsed) {
                    data = parsed;
                    return true;
                }
            }
        } catch (e) { /* ignore */ }
        return false;
    }

    // Пытаемся загрузить json4.json
    function loadDefaultJson() {
        return fetch('json4.json')
            .then(response => {
                if (!response.ok) throw new Error('Файл json4.json не найден');
                return response.json();
            })
            .then(json => {
                defaultData = json;
                dataLoaded = true;
                console.log('✅ Загружен json4.json');
                return json;
            })
            .catch(err => {
                console.warn('⚠️ Не удалось загрузить json4.json:', err.message);
                defaultData = getFallbackData();
                dataLoaded = true;
                return defaultData;
            });
    }

    // Фолбэк-данные
    function getFallbackData() {
        return {
            "game": {
                "name": "Гнилой оброк",
                "version": "1.0",
                "setting": "Древняя Русь",
                "description": "Отряд стажеров расследует пропажу оброка"
            },
            "characters": {
                "player": [{
                    "id": "mikula",
                    "name": "Микула",
                    "profession": "Богатырь",
                    "role": "Танк",
                    "description": "Широкоплечий детина из рода кузнецов.",
                    "level": 1,
                    "stats": { "strength": 5, "agility": 2, "endurance": 4, "intelligence": 1, "wisdom": 2,
                        "charisma": 1 },
                    "health": { "max": 12, "current": 12 },
                    "armor": { "type": "Кольчуга", "ac": 16, "resistance": 2, "durability": 5 },
                    "equipment": [{ "id": "bulava", "name": "Булава", "type": "оружие" }],
                    "consumables": [{ "id": "health_potion", "name": "Зелье здоровья", "quantity": 2 }],
                    "skills": [{ "id": "plecho_bogatyrskoe", "name": "Плечо богатырское",
                        "description": "Вышибает дверь", "type": "active" }],
                    "goals": ["Найти оброк"]
                }]
            },
            "equipment": { "weapons": [], "armor": [], "artifacts": [], "tools": [] },
            "consumables": [],
            "skills": [],
            "locations": [],
            "story": { "summary": "Деревня перестала платить оброк." },
            "rewards": {}
        };
    }

    // ----- Вспомогательные функции для получения данных -----
    function getPlayerChars() { return data?.characters?.player || []; }

    function getFriendlyChars() { return data?.characters?.friendly || []; }

    function getEnemyChars() { return data?.characters?.enemies || []; }

    function getWeapons() { return data?.equipment?.weapons || []; }

    function getArmors() { return data?.equipment?.armor || []; }

    function getArtifacts() { return data?.equipment?.artifacts || []; }

    function getTools() { return data?.equipment?.tools || []; }

    function getConsumables() { return data?.consumables || []; }

    function getSkills() { return data?.skills || []; }

    function getLocations() { return data?.locations || []; }

    // ----- Рендеринг с фильтром -----
    function renderAll() {
        if (!container || !data) return;
        updateGameInfo();

        const cards = [];
        const filter = currentFilter;

        if (filter === 'all' || filter === 'player') {
            getPlayerChars().forEach((ch, idx) => {
                cards.push({ type: 'player', data: ch, index: idx });
            });
        }
        if (filter === 'all' || filter === 'friendly') {
            getFriendlyChars().forEach((ch, idx) => {
                cards.push({ type: 'friendly', data: ch, index: idx });
            });
        }
        if (filter === 'all' || filter === 'enemy') {
            getEnemyChars().forEach((ch, idx) => {
                cards.push({ type: 'enemy', data: ch, index: idx });
            });
        }
        if (filter === 'all' || filter === 'weapon') {
            getWeapons().forEach((eq, idx) => {
                cards.push({ type: 'weapon', data: eq, index: idx });
            });
        }
        if (filter === 'all' || filter === 'armor') {
            getArmors().forEach((eq, idx) => {
                cards.push({ type: 'armor', data: eq, index: idx });
            });
        }
        if (filter === 'all' || filter === 'artifact') {
            getArtifacts().forEach((eq, idx) => {
                cards.push({ type: 'artifact', data: eq, index: idx });
            });
        }
        if (filter === 'all' || filter === 'tool') {
            getTools().forEach((eq, idx) => {
                cards.push({ type: 'tool', data: eq, index: idx });
            });
        }
        if (filter === 'all' || filter === 'consumable') {
            getConsumables().forEach((c, idx) => {
                cards.push({ type: 'consumable', data: c, index: idx });
            });
        }
        if (filter === 'all' || filter === 'skill') {
            getSkills().forEach((s, idx) => {
                cards.push({ type: 'skill', data: s, index: idx });
            });
        }
        if (filter === 'all' || filter === 'location') {
            getLocations().forEach((loc, idx) => {
                cards.push({ type: 'location', data: loc, index: idx });
            });
        }
        if (filter === 'all' || filter === 'story') {
            if (data.story) {
                cards.push({ type: 'story', data: data.story, index: 0 });
            }
        }
        if (filter === 'all' || filter === 'reward') {
            if (data.rewards) {
                cards.push({ type: 'reward', data: data.rewards, index: 0 });
            }
        }

        if (cards.length === 0) {
            container.innerHTML =
                `<div class="empty-state">📭 Нет карточек для категории "${filter}". Загрузите JSON.</div>`;
            return;
        }

        let html = '';
        cards.forEach(item => {
            let cardHtml = '';
            switch (item.type) {
                case 'player':
                    cardHtml = buildPlayerCard(item.data, item.index);
                    break;
                case 'friendly':
                    cardHtml = buildFriendlyCard(item.data, item.index);
                    break;
                case 'enemy':
                    cardHtml = buildEnemyCard(item.data, item.index);
                    break;
                case 'weapon':
                case 'armor':
                case 'artifact':
                case 'tool':
                    cardHtml = buildEquipmentCard(item.data, item.type, item.index);
                    break;
                case 'consumable':
                    cardHtml = buildConsumableCard(item.data, item.index);
                    break;
                case 'skill':
                    cardHtml = buildSkillCard(item.data, item.index);
                    break;
                case 'location':
                    cardHtml = buildLocationCard(item.data, item.index);
                    break;
                case 'story':
                    cardHtml = buildStoryCard(item.data, item.index);
                    break;
                case 'reward':
                    cardHtml = buildRewardCard(item.data, item.index);
                    break;
            }
            html += cardHtml;
        });
        container.innerHTML = html;
        saveToLocalStorage();
    }

    // ----- Построение карточек с правильными классами для печати -----
    function buildPlayerCard(char, idx) {
        const stats = char.stats || {};
        const health = char.health || { max: '—', current: '—' };
        const armor = char.armor || { type: '—', ac: '—', resistance: '—', durability: '—' };
        const equipment = char.equipment || [];
        const consumables = char.consumables || [];
        const skills = char.skills || [];
        const goals = char.goals || [];

        const statMap = { 'strength': 'Сила', 'agility': 'Ловкость', 'endurance': 'Телосложение',
            'intelligence': 'Интеллект', 'wisdom': 'Мудрость', 'charisma': 'Харизма' };
        const statKeys = ['strength', 'agility', 'endurance', 'intelligence', 'wisdom', 'charisma'];
        let statsHtml = '';
        statKeys.forEach(key => {
            const val = stats[key] ?? '—';
            statsHtml += `<div class="stat-item"><span>${statMap[key]||key}</span><span>${val}</span></div>`;
        });

        return `
            <div class="character-card player-card">
                <div class="card-header">
                    <span class="char-name">${char.name || '—'}</span>
                    <span style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
                        <span class="char-class">${char.profession || '—'}</span>
                        ${char.role ? `<span class="char-role">${char.role}</span>` : ''}
                        <span style="font-size:0.7rem; color:#8899aa;">Lv.${char.level || '—'}</span>
                    </span>
                </div>
                <div class="hp-ac">
                    <span>❤️ <strong>${health.current||'—'}</strong> / ${health.max||'—'} HP</span>
                    <span>🛡️ <strong>${armor.ac||'—'}</strong> AC · ${armor.type||'—'}</span>
                    <span>Сопр. ${armor.resistance||'—'} · Прочн. ${armor.durability||'—'}</span>
                </div>
                <div class="stats-grid">${statsHtml}</div>
                ${char.backstory ? `<div class="info-block"><strong>📜 Предыстория</strong><div class="description-text">${char.backstory}</div></div>` : ''}
                <div class="info-block"><strong>📖 Описание</strong><div class="description-text">${char.description || '—'}</div></div>
                <div class="info-block"><strong>⚒️ Снаряжение</strong><div class="list-tag">${equipment.length ? equipment.map(e => `<span>${e.name||e}</span>`).join('') : '<span style="opacity:0.5;">—</span>'}</div></div>
                <div class="info-block"><strong>🧪 Расходники</strong><div class="list-tag">${consumables.length ? consumables.map(c => `<span class="item-qty">${c.name||c} ${c.quantity ? '×'+c.quantity : ''}</span>`).join('') : '<span style="opacity:0.5;">—</span>'}</div></div>
                <div class="info-block"><strong>🎯 Навыки</strong><div class="list-tag">${skills.length ? skills.map(s => `<span>${s.name||s}</span>`).join('') : '<span style="opacity:0.5;">—</span>'}</div></div>
                <div class="info-block"><strong>🎯 Цели</strong><div class="list-tag">${goals.length ? goals.map(g => `<span class="goal-item">🎯 ${g}</span>`).join('') : '<span style="opacity:0.5;">—</span>'}</div></div>
                <div class="card-footer no-print">
                    <button class="btn-small" data-action="delete-player" data-idx="${idx}">🗑️ Удалить</button>
                </div>
            </div>
        `;
    }

    function buildFriendlyCard(char, idx) {
        const stats = char.stats || {};
        const armor = char.armor || { ac: '—', resistance: '—', durability: '—' };
        const skills = char.skills || [];
        const dialog = char.dialogue || {};

        return `
            <div class="character-card npc-friendly-card">
                <div class="card-header">
                    <span class="char-name">${char.name || '—'}</span>
                    <span class="card-type-badge">🤝 ${char.role || 'друг'}</span>
                </div>
                <div class="hp-ac">
                    <span>❤️ <strong>${char.health || '—'}</strong> HP</span>
                    <span>🛡️ <strong>${armor.ac || '—'}</strong> AC</span>
                    <span>Сопр. ${armor.resistance || '—'} · Прочн. ${armor.durability || '—'}</span>
                </div>
                ${Object.keys(stats).length ? `<div class="stats-grid">${Object.entries(stats).map(([k,v]) => `<div class="stat-item"><span>${k}</span><span>${v}</span></div>`).join('')}</div>` : ''}
                <div class="info-block"><strong>📖 Описание</strong><div class="description-text">${char.description || '—'}</div></div>
                ${char.motivation ? `<div class="info-block"><strong>🎯 Мотивация</strong><div class="description-text">${char.motivation}</div></div>` : ''}
                ${char.secrets?.length ? `<div class="info-block"><strong>🔍 Тайны</strong><div class="list-tag">${char.secrets.map(s => `<span>🔎 ${s}</span>`).join('')}</div></div>` : ''}
                ${skills.length ? `<div class="info-block"><strong>⚔️ Навыки</strong><div class="list-tag">${skills.map(s => `<span>${s.name||s}</span>`).join('')}</div></div>` : ''}
                ${Object.keys(dialog).length ? `<div class="info-block"><strong>💬 Диалоги</strong><div class="list-tag">${Object.entries(dialog).map(([k,v]) => `<span>${k}: ${v}</span>`).join('')}</div></div>` : ''}
                <div class="card-footer no-print">
                    <button class="btn-small" data-action="delete-friendly" data-idx="${idx}">🗑️ Удалить</button>
                </div>
            </div>
        `;
    }

    function buildEnemyCard(char, idx) {
        const stats = char.stats || {};
        const armor = char.armor || { ac: '—', resistance: '—', durability: '—' };
        const skills = char.skills || [];

        return `
            <div class="character-card npc-enemy-card">
                <div class="card-header">
                    <span class="char-name">${char.name || '—'}</span>
                    <span class="card-type-badge">👹 ${char.type || 'враг'}</span>
                </div>
                ${char.subtype ? `<div style="font-size:0.8rem; color:#8899aa; margin-bottom:0.3rem;">${char.subtype}</div>` : ''}
                <div class="hp-ac">
                    <span>❤️ <strong>${char.health || '—'}</strong> HP</span>
                    <span>🛡️ <strong>${armor.ac || '—'}</strong> AC</span>
                    <span>Сопр. ${armor.resistance || '—'} · Прочн. ${armor.durability || '—'}</span>
                </div>
                ${Object.keys(stats).length ? `<div class="stats-grid">${Object.entries(stats).map(([k,v]) => `<div class="stat-item"><span>${k}</span><span>${v}</span></div>`).join('')}</div>` : ''}
                <div class="info-block"><strong>📖 Описание</strong><div class="description-text">${char.description || '—'}</div></div>
                ${skills.length ? `<div class="info-block"><strong>⚔️ Навыки</strong><div class="list-tag">${skills.map(s => `<span>${s.name||s}${s.damage ? ' ('+s.damage+')' : ''}</span>`).join('')}</div></div>` : ''}
                ${char.weakness ? `<div class="info-block"><strong>⚠️ Слабость</strong><div class="list-tag"><span>${char.weakness}</span></div></div>` : ''}
                ${char.location ? `<div class="info-block"><strong>📍 Локация</strong><div class="description-text">${char.location}</div></div>` : ''}
                ${char.dialogue ? `<div class="info-block"><strong>💬 Диалоги</strong><div class="list-tag">${Object.entries(char.dialogue).map(([k,v]) => `<span>${k}: ${v}</span>`).join('')}</div></div>` : ''}
                <div class="card-footer no-print">
                    <button class="btn-small" data-action="delete-enemy" data-idx="${idx}">🗑️ Удалить</button>
                </div>
            </div>
        `;
    }

    function buildEquipmentCard(eq, type, idx) {
        const typeLabels = {
            'weapon': '⚔️ оружие',
            'armor': '🛡️ броня',
            'artifact': '🔮 артефакт',
            'tool': '🔧 инструмент'
        };

        let extraFields = '';
        if (type === 'weapon') {
            extraFields = `
                        ${eq.damage ? `<span><strong>Урон:</strong> ${eq.damage}</span>` : ''}
                        ${eq.bonus ? `<span><strong>Бонус:</strong> ${eq.bonus}</span>` : ''}
                        ${eq.range ? `<span><strong>Дальность:</strong> ${eq.range}</span>` : ''}
                    `;
        } else if (type === 'armor') {
            extraFields = `
                        ${eq.ac ? `<span><strong>КБ:</strong> ${eq.ac}</span>` : ''}
                        ${eq.resistance ? `<span><strong>Сопротивление:</strong> ${eq.resistance}</span>` : ''}
                        ${eq.durability ? `<span><strong>Прочность:</strong> ${eq.durability}</span>` : ''}
                    `;
        } else {
            extraFields = `
                        ${eq.bonus ? `<span><strong>Бонус:</strong> ${eq.bonus}</span>` : ''}
                    `;
        }

        return `
            <div class="character-card equipment-card">
                <div class="card-header">
                    <span class="char-name">${eq.name || '—'}</span>
                    <span class="card-type-badge">${typeLabels[type] || type}</span>
                </div>
                <div class="info-block"><strong>📖 Описание</strong><div class="description-text">${eq.description || '—'}</div></div>
                <div style="display:flex; flex-wrap:wrap; gap:0.5rem; margin:0.3rem 0; font-size:0.85rem; background:#1f262e; padding:0.3rem 0.7rem; border-radius:16px;">
                    ${extraFields}
                    ${eq.weight ? `<span><strong>Вес:</strong> ${eq.weight}</span>` : ''}
                </div>
                <div class="card-footer no-print">
                    <button class="btn-small" data-action="delete-equipment" data-type="${type}" data-idx="${idx}">🗑️ Удалить</button>
                </div>
            </div>
        `;
    }

    function buildConsumableCard(c, idx) {
        return `
            <div class="character-card consumable-card">
                <div class="card-header">
                    <span class="char-name">${c.name || '—'}</span>
                    <span class="card-type-badge">🧪 ${c.type || 'расходник'}</span>
                </div>
                <div class="info-block"><strong>📖 Описание</strong><div class="description-text">${c.description || '—'}</div></div>
                <div style="display:flex; flex-wrap:wrap; gap:0.5rem; margin:0.3rem 0; font-size:0.85rem; background:#1f262e; padding:0.3rem 0.7rem; border-radius:16px;">
                    ${c.effect ? `<span><strong>Эффект:</strong> ${c.effect}</span>` : ''}
                    ${c.rarity ? `<span><strong>Редкость:</strong> ${c.rarity}</span>` : ''}
                    ${c.weight ? `<span><strong>Вес:</strong> ${c.weight}</span>` : ''}
                </div>
                <div class="card-footer no-print">
                    <button class="btn-small" data-action="delete-consumable" data-idx="${idx}">🗑️ Удалить</button>
                </div>
            </div>
        `;
    }

    function buildSkillCard(s, idx) {
        return `
            <div class="character-card skill-card">
                <div class="card-header">
                    <span class="char-name">${s.name || '—'}</span>
                    <span class="card-type-badge">🎯 ${s.type || 'навык'} ${s.cooldown !== undefined ? '🔄 '+s.cooldown : ''}</span>
                </div>
                <div class="info-block"><strong>📖 Описание</strong><div class="description-text">${s.description || '—'}</div></div>
                ${s.effect ? `<div style="background:#1f262e; padding:0.3rem 0.7rem; border-radius:16px; margin-top:0.3rem; font-size:0.85rem;"><strong>Эффект:</strong> ${s.effect}</div>` : ''}
                ${s.damage ? `<div style="background:#1f262e; padding:0.3rem 0.7rem; border-radius:16px; margin-top:0.3rem; font-size:0.85rem;"><strong>Урон:</strong> ${s.damage}</div>` : ''}
                ${s.check ? `<div style="background:#1f262e; padding:0.3rem 0.7rem; border-radius:16px; margin-top:0.3rem; font-size:0.85rem;"><strong>Проверка:</strong> ${s.check}</div>` : ''}
                <div class="card-footer no-print">
                    <button class="btn-small" data-action="delete-skill" data-idx="${idx}">🗑️ Удалить</button>
                </div>
            </div>
        `;
    }

    function buildLocationCard(loc, idx) {
        const clues = loc.clues || [];
        const npcs = loc.npcs || [];
        const loot = loc.loot || [];
        return `
            <div class="character-card location-card">
                <div class="card-header">
                    <span class="char-name">${loc.name || '—'}</span>
                    <span class="card-type-badge">🗺️ локация</span>
                </div>
                <div class="info-block"><strong>📖 Описание</strong><div class="description-text">${loc.description || '—'}</div></div>
                ${loc.atmosphere ? `<div class="info-block"><strong>🌫️ Атмосфера</strong><div class="description-text">${loc.atmosphere}</div></div>` : ''}
                ${npcs.length ? `<div class="info-block"><strong>👥 NPC</strong><div class="list-tag">${npcs.map(n => `<span>${n}</span>`).join('')}</div></div>` : ''}
                ${clues.length ? `<div class="info-block"><strong>🔍 Улики</strong><div class="list-tag">${clues.map(c => `<span>🔎 ${c}</span>`).join('')}</div></div>` : ''}
                ${loot.length ? `<div class="info-block"><strong>🎁 Лут</strong><div class="list-tag">${loot.map(l => `<span>${l.name} ${l.chance ? '('+l.chance+')' : ''}${l.quantity ? ' ×'+l.quantity : ''}</span>`).join('')}</div></div>` : ''}
                <div class="card-footer no-print">
                    <button class="btn-small" data-action="delete-location" data-idx="${idx}">🗑️ Удалить</button>
                </div>
            </div>
        `;
    }

    function buildStoryCard(story, idx) {
        const villain = story.villain || {};
        const endings = story.endings || {};
        return `
            <div class="character-card story-card">
                <div class="card-header">
                    <span class="char-name">📖 Сюжет</span>
                    <span class="card-type-badge">${data?.game?.name || 'история'}</span>
                </div>
                <div class="info-block"><strong>📜 Сводка</strong><div class="description-text">${story.summary || story.plot || '—'}</div></div>
                <div class="info-block"><strong>🕵️ Истинная причина</strong><div class="description-text">${story.true_cause || '—'}</div></div>
                <div class="info-block"><strong>👤 Злодей</strong>
                    <div style="background:#1f262e; border-radius:16px; padding:0.3rem 0.7rem; margin-top:4px;">
                        <div><strong>Имя:</strong> ${villain.name || '—'}</div>
                        <div><strong>Мотивация:</strong> ${villain.motivation || '—'}</div>
                        ${villain.secrets?.length ? `<div><strong>Тайны:</strong> ${villain.secrets.join(', ')}</div>` : ''}
                    </div>
                </div>
                <div class="info-block"><strong>🏁 Концовки</strong>
                    <div style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-top:4px;">
                        ${Object.entries(endings).map(([k,v]) => `<span style="background:#2a3a3a; padding:0.2rem 0.7rem; border-radius:30px; font-size:0.8rem; border:1px solid #4a6a5a;">${k}: ${v}</span>`).join('')}
                    </div>
                </div>
                ${story.moral ? `<div class="info-block"><strong>💡 Мораль</strong><div class="description-text">${story.moral}</div></div>` : ''}
                <div class="card-footer no-print">
                    <button class="btn-small" data-action="delete-story">🗑️ Удалить</button>
                </div>
            </div>
        `;
    }

    function buildRewardCard(rewards, idx) {
        const paths = ['combat_path', 'peace_path', 'secret_path'];
        let html = `
            <div class="character-card reward-card">
                <div class="card-header">
                    <span class="char-name">🏆 Награды</span>
                    <span class="card-type-badge">${data?.game?.name || 'игра'}</span>
                </div>
        `;
        paths.forEach(path => {
            const p = rewards[path];
            if (!p) return;
            html += `
                        <div class="info-block" style="margin-top:0.5rem; background:#1f262e; border-radius:16px; padding:0.5rem 0.7rem;">
                            <strong>${p.name || path.replace('_', ' ').toUpperCase()}</strong>
                            <div class="description-text" style="margin-top:0.2rem;">${p.description || '—'}</div>
                            ${p.rewards?.length ? `<div><strong>✅ Награды:</strong> ${p.rewards.join(', ')}</div>` : ''}
                            ${p.penalties?.length ? `<div><strong>❌ Штрафы:</strong> ${p.penalties.join(', ')}</div>` : ''}
                        </div>
                    `;
        });
        html += `
                        <div class="card-footer no-print">
                            <button class="btn-small" data-action="delete-reward">🗑️ Удалить</button>
                        </div>
                    </div>
                `;
        return html;
    }

    // ----- Удаление -----
    function deleteItem(type, idx, subType) {
        const map = {
            'player': { root: 'characters', key: 'player' },
            'friendly': { root: 'characters', key: 'friendly' },
            'enemy': { root: 'characters', key: 'enemies' },
            'consumable': { root: null, key: 'consumables' },
            'skill': { root: null, key: 'skills' },
            'location': { root: null, key: 'locations' }
        };

        if (type === 'equipment' && subType) {
            const eqMap = {
                'weapon': 'weapons',
                'armor': 'armor',
                'artifact': 'artifacts',
                'tool': 'tools'
            };
            const key = eqMap[subType];
            if (data.equipment && data.equipment[key] && idx >= 0 && idx < data.equipment[key].length) {
                data.equipment[key].splice(idx, 1);
                renderAll();
                showToast('🗑️ Удалено');
                return;
            }
        }

        if (type === 'story') {
            data.story = null;
            renderAll();
            showToast('🗑️ Сюжет удалён');
            return;
        }
        if (type === 'reward') {
            data.rewards = null;
            renderAll();
            showToast('🗑️ Награды удалены');
            return;
        }

        const mapItem = map[type];
        if (mapItem) {
            const root = mapItem.root;
            const key = mapItem.key;
            if (root && data[root] && data[root][key] && idx >= 0 && idx < data[root][key].length) {
                data[root][key].splice(idx, 1);
                renderAll();
                showToast('🗑️ Удалено');
                return;
            } else if (!root && data[key] && idx >= 0 && idx < data[key].length) {
                data[key].splice(idx, 1);
                renderAll();
                showToast('🗑️ Удалено');
                return;
            }
        }
    }

    // ----- Экспорт -----
    function exportJSON() {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gniloy_obrok_full_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('💾 JSON экспортирован');
    }

    // ----- Импорт -----
    function importFromText(text) {
        try {
            const parsed = JSON.parse(text);
            if (parsed && typeof parsed === 'object' && 'characters' in parsed) {
                data = parsed;
                renderAll();
                showToast('✅ Данные импортированы');
                jsonArea.classList.remove('active');
                return true;
            } else {
                showToast('❌ Неверный формат: требуется поле "characters"', true);
                return false;
            }
        } catch (e) {
            showToast('❌ Ошибка парсинга JSON: ' + e.message, true);
            return false;
        }
    }

    // ----- Инициализация -----
    function init() {
        const hasSaved = loadFromLocalStorage();
        if (hasSaved) {
            console.log('✅ Загружено из localStorage');
            renderAll();
            return;
        }

        loadDefaultJson().then(jsonData => {
            data = JSON.parse(JSON.stringify(jsonData));
            renderAll();
            console.log('✅ Загружены данные из json4.json');
        }).catch(() => {
            data = getFallbackData();
            renderAll();
            console.warn('⚠️ Использованы фолбэк-данные');
        });
    }

    // ----- Обработчики событий -----
    document.addEventListener('DOMContentLoaded', function() {
        init();

        filterBar.addEventListener('click', function(e) {
            const btn = e.target.closest('.filter-btn');
            if (!btn) return;
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderAll();
        });

        document.getElementById('exportBtn').addEventListener('click', exportJSON);
        document.getElementById('importBtn').addEventListener('click', () => {
            jsonArea.classList.toggle('active');
            if (jsonArea.classList.contains('active')) {
                jsonTextarea.value = '';
                jsonTextarea.focus();
            }
        });
        document.getElementById('cancelJsonBtn').addEventListener('click', () => {
            jsonArea.classList.remove('active');
        });
        document.getElementById('applyJsonBtn').addEventListener('click', () => {
            importFromText(jsonTextarea.value);
        });
        document.getElementById('fileInput').addEventListener('change', function(e) {
            const file = this.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(ev) {
                const content = ev.target.result;
                jsonTextarea.value = content;
                importFromText(content);
                document.getElementById('fileInput').value = '';
            };
            reader.onerror = function() {
                showToast('❌ Ошибка чтения файла', true);
            };
            reader.readAsText(file);
        });
        document.getElementById('printBtn').addEventListener('click', () => window.print());

        container.addEventListener('click', function(e) {
            const target = e.target.closest('button');
            if (!target) return;
            const action = target.dataset.action;
            const idx = parseInt(target.dataset.idx, 10);
            const type = target.dataset.type;

            if (action === 'delete-player') deleteItem('player', idx);
            else if (action === 'delete-friendly') deleteItem('friendly', idx);
            else if (action === 'delete-enemy') deleteItem('enemy', idx);
            else if (action === 'delete-equipment' && type) deleteItem('equipment', idx, type);
            else if (action === 'delete-consumable') deleteItem('consumable', idx);
            else if (action === 'delete-skill') deleteItem('skill', idx);
            else if (action === 'delete-location') deleteItem('location', idx);
            else if (action === 'delete-story') deleteItem('story');
            else if (action === 'delete-reward') deleteItem('reward');
        });

        jsonTextarea.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('applyJsonBtn').click();
            }
        });
    });

})();