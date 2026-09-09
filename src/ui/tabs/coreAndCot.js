// ────────────────────────────────────────────────────────────────────────────
// Presets & COT — engine choice, chain-of-thought, thinking effort.
// ────────────────────────────────────────────────────────────────────────────

import { extension_settings, saveSettingsDebounced, Popup, POPUP_TYPE } from "../../st.js";
import { extensionName } from "../../core/constants.js";
import { localProfile, currentTab } from "../../core/state.js";
import { lockedStyleIdFor, isV7Engine, isV10Engine } from "../../core/engines.js";
import { saveProfileToMemory, saveProfileDebounced } from "../../core/profile.js";
import { fireRefreshHook, REFRESH } from "../../core/refreshHooks.js";
import { hardcodedLogic } from "../../../data/database.js";
import { renderDevMode } from "../devmode.js";
import { meguminCotForMode } from "../../../data/cot/index.js";
import { buildStoryConfigSection } from "../../features/storyconfig/ui.js";
import { countActiveConfigFields } from "../../features/storyconfig/config.js";

// ─────────────────────────────────────────────────────────────────────────────
// Enhanced Dialogue — the switch drawn inside an engine card.
//
// It lives on the card rather than in the tab's own toggle strip because it
// belongs to the engine: it replaces that engine's <dialogue> section and means
// nothing for any other generation. V10 only, because no other generation writes
// that tag and the switch would be inert.
//
// Two grids draw engine cards — the official list and the custom clones — and a
// Dev Mode clone of a V10 engine is still flagged isV10, so the switch has to
// appear on both. Written once here rather than twice inline: the first version
// of this was in the official card only, and the feature disappeared the moment
// anybody cloned an engine to edit it.
// ─────────────────────────────────────────────────────────────────────────────

function enhancedDialogueOn(m) {
    return Boolean(m && localProfile.enhancedDialogue && localProfile.enhancedDialogue[m.id]);
}

function enhancedDialogueMarkup(m, isLocked) {
    if (!isV10Engine(m) || isLocked) return "";
    const on = enhancedDialogueOn(m);
    return `
        <div class="ecard-opt ${on ? "on" : ""}" title="Swap this engine's dialogue rules for the stricter, prescriptive set: named categories, orthographic cues for emotion, and an explicit ban list. For models that read the shipped section as a suggestion.">
            <div class="ecard-opt-text">
                <span class="ecard-opt-label"><i class="fa-solid fa-comment-dots"></i> Enhanced 对话</span>
                <span class="ecard-opt-state">${on ? "开" : "关"}</span>
            </div>
            <div class="ecard-opt-switch"></div>
        </div>`;
}

function wireEnhancedDialogue(card, m, rerender) {
    card.find(".ecard-opt").on("click", function (ev) {
        // Without this the click also selects the engine. Flipping a setting and
        // switching engine are separate intentions and the card must not conflate
        // them — the switch sits inside the card's own click target.
        ev.stopPropagation();
        if (!localProfile.enhancedDialogue) localProfile.enhancedDialogue = {};
        // Deleted rather than set false, so the map only ever holds engines that
        // are actually on and an untouched profile stays empty.
        if (localProfile.enhancedDialogue[m.id]) delete localProfile.enhancedDialogue[m.id];
        else localProfile.enhancedDialogue[m.id] = true;
        saveProfileToMemory();
        // The counter reads the engine's prompt through buildBaseDict, and the
        // two dialogue sections are different lengths.
        fireRefreshHook(REFRESH.TOKEN_COUNT);
        if (typeof rerender === "function") rerender();
    });
}

export function renderCoreAndCot(c) {
    // Preserve active sub-tab and filter before wiping the container
    let activeSubTab = c.find('.ws-nav-btn.active').attr('data-target') || 'sec-official';
    let activeFilter = c.find('.wstyle-filter-pill.active').attr('data-filter') || 'all';

    c.empty();
    const root = $(`<div style="display: flex; flex-direction: column; height: 100%;"></div>`);

    const descriptions = {
        "balance": "最初的秘方。NPC 自然反应——不舔、不无端敌意。",
        "balance Test": "改进版平衡模式，目标是更少 token、更多创意。",
        "cinematic": "好莱坞式叙事。戏剧节拍与更高张力。",
        "dark": "更严酷的平衡。世界冷酷，后果更重。",
        "v6-anime-director": "进阶电影分镜与节奏。模拟高预算动画导演手法。",
        "v6-dream-team": "终极六人专家编剧室。叙事一致性与真实感极高。",
        "v6-dream-team-lite": "梦之队精简版。生成更快，token 开销更低。",
        "v7-core": "V7 Core 引擎。电影节奏、真实摩擦与不停运转的世界之间的最佳平衡。",
        "v7-reality": "V7 Reality 引擎。接地气的无情模拟，零叙事保护。",
        "v7-gentle": "V7 Gentle 引擎。更柔软、更亲密的叙事流。",
        "v7.5": "Kismet 引擎。专注于不可逃避的叙事动量，如命运的隐形作者推动故事。",
        "v8-m": "擅长复杂人类心理、真实带瑕疵的对话，以及自主、多层的剧情编排。",
        "v8-lite": "Obsidian 的精简高效版。保留心理、对话与动量核心规则，token 占用更轻。",
        "v8-fusion": "Megumin Suite 的巅峰之作。融合 V8 Obsidian 深层心理与 V6 梦之队专家编剧室框架。",
        "v10-core": "说书人。Ukiyo 更松弛——有性情的讲述者，编织世界与其历史，追随场景里最鲜活的东西。略牺牲打磨换取发明：文笔会游荡、追一个意象、偶尔用力过猛。适合要氛围、动量、被「讲」出来而非「编排」出来的世界。两个 V10 互不降级——各跑几场，留下听起来像你想读的那个。",
        "v10-shura": "写作者。Shura 更严格——无注水、无 AI 腔、没有为了控场而存在的句子。每个角色都是自己故事的主角，按自己的价值观行动，在自己眼中都不是反派；叙述不会站队对错。适合读起来像书的文笔，以及由角色自己推动的故事。两个 V10 互不降级——各跑几场，留下听起来像你想读的那个。",
        "v10-core-cw": "Ukiyo，且叙述者也写 {{user}}。它会读你的写法——用词、节奏、行动胆量——并用那种声音扮演你的角色。你自己写的一切都是正史，永不被覆盖或纠正。你的历史仍属于你；共享的只有「演出」。",
        "v10-shura-cw": "带共同作者的 Shura：每个角色都是主角，{{user}} 也一样，叙述者用你的声音写他们全部。你一接手就立刻让位，且从不编造你的过去。适合放手观看的电影式游玩——看故事，而不是驾驭每一拍。",
        "v9-core": "最终定稿的 Megumin V9 预设。V9 Mirage 是叙事模拟的巅峰：超真实心理、强烈氛围落地与动态世界后果。强烈推荐。",
        "v9-lite": "实验性 beta 引擎，叙事流更风格化。有趣到值得收录，给想要另一种节奏的人。注意：不支持自定义文风，自带文风。",
        "v9-director": "独特的 beta 混合体：融合 V8 Fusion 的专家编剧室机制与 V9 Xin 的原始心理深度。高度实验性。注意：不支持自定义文风，自带文风。",
        "v9-immersion": "V9 Mirage 的精简轻量版。保留 Mirage 核心哲学与残酷真实感，上下文占用更小。若模型吃得消，仍推荐完整 Mirage。"
    };

    const activeEng = hardcodedLogic.modes.find(m => m.id === localProfile.mode);
    const activeLabel = activeEng ? activeEng.label : localProfile.mode;

    let v4Count = 0, v5Count = 0, v6Count = 0, v7Count = 0, v8Count = 0, v9Count = 0, v10Count = 0;
    hardcodedLogic.modes.forEach(m => {
        if (m.label.includes("V4")) v4Count++;
        else if (m.label.includes("V5")) v5Count++;
        else if (m.id.includes("v6")) v6Count++;
        else if (m.id.includes("v7")) v7Count++;
        else if (m.id.includes("v8")) v8Count++;
        else if (m.id.includes("v10")) v10Count++;
        else if (m.id.includes("v9")) v9Count++;
    });
    const totalCount = hardcodedLogic.modes.length;
    const customCount = (extension_settings[extensionName].customModes || []).length;

    // ── UNIFIED HEADER ──
    root.append(`
        <div class="wstyle-header">
            <div class="wstyle-header-left">
                <div class="wstyle-header-icon" style="background: linear-gradient(135deg, #f59e0b, #a855f7);">
                    <i class="fa-solid fa-server"></i>
                </div>
                <div>
                    <h2>预设与思维链</h2>
                    <p>选择核心预设与思维链。</p>
                </div>
            </div>
            <div class="wstyle-active-badge">
                <i class="fa-solid fa-circle-check"></i>
                ${activeLabel}
            </div>
        </div>
    `);

    // ── TWO COLUMN LAYOUT ──
    const layout = $(`<div class="ws-layout"></div>`);
    const sidebar = $(`<div class="ws-sidebar"></div>`);
    const mainArea = $(`<div class="ws-main"></div>`);

    // --- BUILD SIDEBAR ---
    sidebar.append(`<div class="ws-sidebar-title">配置</div>`);
    
    const btnOfficial = $(`<button class="ws-nav-btn active" data-target="sec-official"><span style="display:flex; align-items:center; gap:10px;"><i class="fa-solid fa-server"></i> Official 引擎</span> <span class="ws-badge">${totalCount}</span></button>`);
    const btnCustom = $(`<button class="ws-nav-btn" data-target="sec-custom"><span style="display:flex; align-items:center; gap:10px;"><i class="fa-solid fa-microchip"></i> Custom 引擎</span> <span class="ws-badge">${customCount}</span></button>`);
    
    sidebar.append(btnOfficial).append(btnCustom);
    sidebar.append(`<div style="height: 1px; background: var(--border-color); margin: 8px 0;"></div>`);
    
    const cfgCount = countActiveConfigFields(localProfile.storyConfig);
    const btnConfig = $(`<button class="ws-nav-btn" data-target="sec-config"><span style="display:flex; align-items:center; gap:10px;"><i class="fa-solid fa-sliders" style="color: var(--gold);"></i> Story Config</span> <span style="display:flex; align-items:center; gap:6px;"><span class="ws-new-pill">✨ New</span>${cfgCount > 0 ? `<span class="ws-badge">${cfgCount}</span>` : ''}</span></button>`);
    sidebar.append(btnConfig);

    const btnCot = $(`<button class="ws-nav-btn" data-target="sec-cot"><span style="display:flex; align-items:center; gap:10px; color: ${localProfile.cotEnabled ? 'var(--text-main)' : 'var(--text-muted)'};"><i class="fa-solid fa-brain" style="color: ${localProfile.cotEnabled ? '#a855f7' : ''};"></i> Reasoning (CoT)</span> <span style="font-size: 0.6rem; font-weight: bold; color: ${localProfile.cotEnabled ? '#10b981' : '#ef4444'};">${localProfile.cotEnabled ? 'ON' : 'OFF'}</span></button>`);
    sidebar.append(btnCot);

    layout.append(sidebar);

    // --- BUILD MAIN CONTENT SECTIONS ---
    const secOfficial = $(`<div class="ws-section" id="sec-official"></div>`);
    const secCustom = $(`<div class="ws-section" id="sec-custom" style="display:none;"></div>`);
    const secCot = $(`<div class="ws-section" id="sec-cot" style="display:none;"></div>`);
    const secConfig = buildStoryConfigSection().hide();

    // ==========================================
    // ── A. OFFICIAL ENGINES ──
    // ==========================================
    secOfficial.append(`<h3 style="margin-top: 0; color: var(--gold); font-size: 1.1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;"><i class="fa-solid fa-server"></i> Official Megumin 引擎</h3>`);
    secOfficial.append(`
        <div class="mtab-callout gold" style="margin-bottom: 20px;">
            <i class="fa-solid fa-lightbulb"></i>
            <span><strong>Pro Tip:</strong> The Engine defines the "laws of physics" and pacing of your story. The Reasoning acts as the AI's internal scratchpad. For the best experience, match V9 Mirage with CoT V9 Mirage.</span>
        </div>
    `);

    const filterBar = $(`
        <div class="wstyle-filters" style="margin-bottom: 20px;">
            <button class="wstyle-filter-pill ${activeFilter === 'all' ? 'active' : ''}" data-filter="all">All <span class="pill-count">${totalCount}</span></button>
            <button class="wstyle-filter-pill ${activeFilter === 'V4' ? 'active' : ''}" data-filter="V4">V4 <span class="pill-count">${v4Count}</span></button>
            <button class="wstyle-filter-pill ${activeFilter === 'V5' ? 'active' : ''}" data-filter="V5">V5 <span class="pill-count">${v5Count}</span></button>
            <button class="wstyle-filter-pill ${activeFilter === 'V6' ? 'active' : ''}" data-filter="V6"><i class="fa-solid fa-lock" style="font-size:0.6rem;"></i> V6 <span class="pill-count">${v6Count}</span></button>
            <button class="wstyle-filter-pill ${activeFilter === 'V7' ? 'active' : ''}" data-filter="V7">V7 <span class="pill-count">${v7Count}</span></button>
            <button class="wstyle-filter-pill ${activeFilter === 'V8' ? 'active' : ''}" data-filter="V8">V8 <span class="pill-count">${v8Count}</span></button>
            <button class="wstyle-filter-pill ${activeFilter === 'V9' ? 'active' : ''}" data-filter="V9">V9 <span class="pill-count">${v9Count}</span></button>
            <button class="wstyle-filter-pill ${activeFilter === 'V10' ? 'active' : ''}" data-filter="V10">V10 <span class="pill-count">${v10Count}</span></button>
        </div>
    `);
    secOfficial.append(filterBar);

    const coreGrid = $(`<div class="mtab-card-grid" style="margin-bottom: 20px;"></div>`);
    const v6Empty = $(`<div id="v6-empty-msg" style="display:none;"><div class="mtab-locked-state"><i class="fa-solid fa-hammer" style="color: var(--border-color);"></i><h3>V6 Engines are in the forge.</h3><p>Stay tuned for the next update! Later this week.</p></div></div>`);

    hardcodedLogic.modes.forEach(m => {
        let version = "all";
        if (m.label.includes("V4")) version = "V4";
        else if (m.label.includes("V5")) version = "V5";
        else if (m.id.includes("v6")) version = "V6";
        else if (m.id.includes("v7")) version = "V7";
        else if (m.id.includes("v8")) version = "V8";
        // Before the v9 test purely so the two lists stay in the same order.
        else if (m.id.includes("v10")) version = "V10";
        else if (m.id.includes("v9")) version = "V9";

        const isLocked = m.locked === true;
        const isSel = localProfile.mode === m.id;

        let badges = '';
        if (m.recommended) badges += `<span class="ecard-badge rec"><i class="fa-solid fa-star"></i> Recommended</span>`;
        if (m.isNew && !isLocked) badges += `<span class="ecard-badge new">New</span>`;
        if (isLocked) badges += `<span class="ecard-badge locked"><i class="fa-solid fa-lock"></i> Coming Soon</span>`;

        const card = $(`
            <div class="mtab-eng-card ${isSel ? 'active' : ''} ${isLocked ? 'locked-card' : ''}" data-version="${version}" style="${(activeFilter !== 'all' && activeFilter !== version) ? 'display:none;' : ''}">
                <div class="ecard-accent"></div>
                <div class="ecard-body">
                    <div class="ecard-title">
                        <span>${m.label}</span>
                        ${isSel ? `<span class="ecard-badge" style="background:rgba(16,185,129,0.15);color:#10b981;"><i class="fa-solid fa-check"></i> Active</span>` : ''}
                    </div>
                    <p class="ecard-desc">${descriptions[m.id] || ""}</p>
                    ${badges ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">${badges}</div>` : ''}
                    ${enhancedDialogueMarkup(m, isLocked)}
                </div>
            </div>
        `);

        wireEnhancedDialogue(card, m, () => renderCoreAndCot(c));

        if (!isLocked) {
            card.on("click", () => {
                localProfile.mode = m.id;

                // Same mapping the Writing Style tab uses when it finds a locked
                // engine with no style set. One list, so the two cannot disagree.
                const lockedStyle = lockedStyleIdFor(m);
                if (lockedStyle) {
                    localProfile.activeStyleId = lockedStyle;
                    const ds = hardcodedLogic.directStyles.find(x => x.id === lockedStyle);
                    if (ds) localProfile.aiRule = ds.rule;
                }

                const currentLang = (localProfile.model && localProfile.model.includes("-")) ? localProfile.model.split('-').pop() : "english";
                // The engine→CoT mapping lives in data/cot/index.js now, so Dev
                // Mode can fill a clone's reasoning script from the same source.
                const targetCot = meguminCotForMode(m.id, currentLang);
                if (targetCot) localProfile.model = targetCot;
                saveProfileToMemory();
                renderCoreAndCot(c);
            });
        }
        coreGrid.append(card);
    });

    secOfficial.append(coreGrid);
    secOfficial.append(v6Empty);
    if (activeFilter === "V6") v6Empty.show();

    filterBar.find('.wstyle-filter-pill').on('click', function () {
        filterBar.find('.wstyle-filter-pill').removeClass('active');
        $(this).addClass('active');
        const filter = $(this).attr('data-filter');
        if (filter === "all") {
            coreGrid.find('.mtab-eng-card').show(); v6Empty.hide();
        } else {
            coreGrid.find('.mtab-eng-card').each(function () {
                if ($(this).attr('data-version') === filter) $(this).show(); else $(this).hide();
            });
            if (filter === "V6") v6Empty.show(); else v6Empty.hide();
        }
    });

    const activeEngineForToggles = [...hardcodedLogic.modes, ...(extension_settings[extensionName].customModes || [])].find(m => m.id === localProfile.mode);
    const isV7ForToggles = isV7Engine(activeEngineForToggles);
    if (isV7ForToggles) {
        secOfficial.append(`<div class="wstyle-section-head blue" style="margin-top: 15px;"><i class="fa-solid fa-layer-group"></i> V7 模块（关闭即禁用）</div>`);
        const v7ToggleList = $(`<div class="mtab-card-list"></div>`);
        const v7Toggles = [
            { id: "v7_ooc", label: "OOC 协议", desc: "允许角色外指令。" },
            { id: "v7_pcsolo", label: "PC 独处身体描写", desc: "无人观察时对 PC 的叙述。" },
            { id: "v7_intro", label: "介绍协议", desc: "新 NPC 如何进入故事。" },
            { id: "v7_culture", label: "文化锚定", desc: "现实世界整合与引用。" },
            { id: "v7_scene", label: "场景调度", desc: "焦点切换与人群管理。" }
        ];

        v7Toggles.forEach(tog => {
            if (localProfile.toggles[tog.id] === undefined) localProfile.toggles[tog.id] = true;
            const isOn = localProfile.toggles[tog.id];

            const tCard = $(`
                <div class="mtab-toggle-row ${isOn ? 'active' : ''}" style="cursor: pointer;">
                    <div class="toggle-info">
                        <div class="toggle-label">${tog.label}</div>
                        <div class="toggle-desc">${tog.desc}</div>
                    </div>
                    <div class="ps-switch"></div>
                </div>
            `);
            tCard.on("click", () => { localProfile.toggles[tog.id] = !localProfile.toggles[tog.id]; saveProfileToMemory(); renderCoreAndCot(c); });
            v7ToggleList.append(tCard);
        });
        secOfficial.append(v7ToggleList);
    }

    // ==========================================
    // ── B. CUSTOM ENGINES ──
    // ==========================================
    secCustom.append(`<h3 style="margin-top: 0; color: #10b981; font-size: 1.1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;"><i class="fa-solid fa-microchip"></i> Your Custom 引擎</h3>`);
    const customModes = extension_settings[extensionName].customModes || [];

    if (customModes.length === 0) {
        secCustom.append(`<div style="padding: 30px; text-align: center; color: var(--text-muted); border: 1px dashed var(--border-color); border-radius: 14px;">No custom engines yet. Go to Dev Mode to create or import one!</div>`);
    } else {
        const customGrid = $(`<div class="mtab-card-grid"></div>`);
        customModes.forEach(m => {
            const isSel = localProfile.mode === m.id;
            const card = $(`
                <div class="mtab-eng-card ${isSel ? 'active' : ''}">
                    <div class="ecard-accent"></div>
                    <div class="ecard-body">
                        <div class="ecard-title">
                            <span>${m.label}</span>
                            <button class="ps-modern-btn secondary btn-quick-edit" style="padding:4px 10px;font-size:0.7rem;color:var(--gold);border-color:rgba(245,158,11,0.3);background:transparent;">
                                <i class="fa-solid fa-pen"></i> Edit
                            </button>
                        </div>
                        <p class="ecard-desc">自定义引擎流程</p>
                        ${enhancedDialogueMarkup(m, false)}
                    </div>
                </div>
            `);
            card.on("click", (e) => {
                if ($(e.target).closest('.btn-quick-edit').length) return;
                if ($(e.target).closest('.ecard-opt').length) return;
                localProfile.mode = m.id; saveProfileToMemory(); renderCoreAndCot(c);
            });
            wireEnhancedDialogue(card, m, () => renderCoreAndCot(c));
            card.find(".btn-quick-edit").on("click", () => renderDevMode("editor", m.id, null, "tab"));
            customGrid.append(card);
        });
        secCustom.append(customGrid);
    }

    // ==========================================
    // ── C. CHAIN OF THOUGHT (REASONING) ──
    // ==========================================
    secCot.append(`<h3 style="margin-top: 0; color: #a855f7; font-size: 1.1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;"><i class="fa-solid fa-brain"></i> Chain of Thought (Reasoning)</h3>`);

    if (localProfile.cotEnabled === undefined) localProfile.cotEnabled = true;

    const cotToggle = $(`
        <div class="mtab-toggle-row ${localProfile.cotEnabled ? 'active' : ''}" style="margin-bottom: 20px; border-color: ${localProfile.cotEnabled ? '#a855f7' : 'var(--border-color)'}; cursor: pointer;">
            <div class="toggle-info">
                <div class="toggle-label" style="color: ${localProfile.cotEnabled ? '#a855f7' : 'var(--text-main)'};"><i class="fa-solid fa-power-off"></i> Enable Chain of Thought</div>
                <div class="toggle-desc">Toggle the entire AI reasoning system. When off, the AI generates responses directly.</div>
            </div>
            <div class="ps-switch" style="${localProfile.cotEnabled ? 'background:#a855f7;' : ''}"></div>
        </div>
    `);
    cotToggle.on("click", function() {
        localProfile.cotEnabled = !localProfile.cotEnabled;
        saveProfileToMemory();
        renderCoreAndCot(c);
    });
    secCot.append(cotToggle);

    if (localProfile.cotEnabled) {
        if (activeEng && activeEng.cot && activeEng.cot.trim() !== "") {
            secCot.append(`
                <div class="mtab-callout green" style="margin-bottom:20px;">
                    <i class="fa-solid fa-shield-halved"></i>
                    <span><strong>自定义引擎逻辑已激活</strong> — 此引擎自带 [[COT]] 与 [[prefill]]。下方选择会被引擎代码覆盖。</span>
                </div>
            `);
        }

        const migrationMap = {
            "cot-english": "cot-v1-english", "cot-arabic": "cot-v1-arabic", "cot-spanish": "cot-v1-spanish", "cot-french": "cot-v1-french",
            "cot-zh": "cot-v1-zh", "cot-ru": "cot-v1-ru", "cot-jp": "cot-v1-jp", "cot-pt": "cot-v1-pt", "cot-english-test": "cot-v2-english"
        };
        if (migrationMap[localProfile.model]) { localProfile.model = migrationMap[localProfile.model]; saveProfileToMemory(); }

        if (localProfile.model === "cot-off") {
            localProfile.cotEnabled = false;
            localProfile.model = "cot-v7.5-english";
            saveProfileToMemory();
        }

        let currentType = "off", currentLang = "english";
        // The two specific V10 sets are tested before the general one, exactly as
        // v9-lite and v9-director are below: "cot-v10-shura-english" starts with
        // "cot-v10-" too, so a bare test would swallow it.
        // Longest prefix first: "cot-v10-shura-cap-" also starts with
        // "cot-v10-shura-", so the capped ids have to be tested ahead of the plain
        // ones or every cap reads back as its uncapped sibling.
        if (localProfile.model && localProfile.model.startsWith("cot-v10-ukiyo-cap-")) { currentType = "v10-ukiyo-cap"; currentLang = "english"; }
        else if (localProfile.model && localProfile.model.startsWith("cot-v10-shura-cap-")) { currentType = "v10-shura-cap"; currentLang = "english"; }
        else if (localProfile.model && localProfile.model.startsWith("cot-v10-ukiyo-")) { currentType = "v10-ukiyo"; currentLang = "english"; }
        else if (localProfile.model && localProfile.model.startsWith("cot-v10-shura-")) { currentType = "v10-shura"; currentLang = "english"; }
        else if (localProfile.model && localProfile.model.startsWith("cot-v1-")) { currentType = "v1"; currentLang = localProfile.model.replace("cot-v1-", ""); }
        else if (localProfile.model && localProfile.model.startsWith("cot-v2-")) { currentType = "v2"; currentLang = localProfile.model.replace("cot-v2-", ""); }
        else if (localProfile.model && localProfile.model.startsWith("cot-v6-lite-")) { currentType = "v6-lite"; currentLang = localProfile.model.replace("cot-v6-lite-", ""); }
        else if (localProfile.model && localProfile.model.startsWith("cot-v6-")) { currentType = "v6"; currentLang = localProfile.model.replace("cot-v6-", ""); }
        else if (localProfile.model && localProfile.model.startsWith("cot-v7.5-")) { currentType = "v7.5"; currentLang = localProfile.model.replace("cot-v7.5-", ""); }
        else if (localProfile.model && localProfile.model.startsWith("cot-v7-lite-")) { currentType = "v7-lite"; currentLang = localProfile.model.replace("cot-v7-lite-", ""); }
        else if (localProfile.model && localProfile.model.startsWith("cot-v7-")) { currentType = "v7"; currentLang = localProfile.model.replace("cot-v7-", ""); }
        else if (localProfile.model && localProfile.model.startsWith("cot-v8-fusion-")) { currentType = "v8-fusion"; currentLang = localProfile.model.replace("cot-v8-fusion-", ""); }
        else if (localProfile.model && localProfile.model.startsWith("cot-v8-")) { currentType = "v8"; currentLang = localProfile.model.replace("cot-v8-", ""); }
        else if (localProfile.model && localProfile.model.startsWith("cot-v9-lite-")) { currentType = "v9-lite"; currentLang = localProfile.model.replace("cot-v9-lite-", ""); }
        else if (localProfile.model && localProfile.model.startsWith("cot-v9-director-")) { currentType = "v9-director"; currentLang = localProfile.model.replace("cot-v9-director-", ""); }
        else if (localProfile.model && localProfile.model.startsWith("cot-v9-immersion-")) { currentType = "v9-immersion"; currentLang = localProfile.model.replace("cot-v9-immersion-", ""); }
        else if (localProfile.model && localProfile.model.startsWith("cot-v9-hybrid-")) { currentType = "v9-hybrid"; currentLang = localProfile.model.replace("cot-v9-hybrid-", ""); }
        else if (localProfile.model && localProfile.model.startsWith("cot-v9-")) { currentType = "v9"; currentLang = localProfile.model.replace("cot-v9-", ""); }

        let allowedCotTypes = null; 
        if (localProfile.mode.includes("v10")) allowedCotTypes = ["v10-ukiyo", "v10-ukiyo-cap", "v10-shura", "v10-shura-cap"];
        else if (localProfile.mode.includes("v6")) allowedCotTypes = ["v6", "v6-lite"];
        else if (localProfile.mode === "v7.5") allowedCotTypes = ["v7.5"];
        else if (localProfile.mode.includes("v7")) allowedCotTypes = ["v7", "v7-lite"];
        else if (localProfile.mode === "v8-fusion") allowedCotTypes = ["v8-fusion"]; 
        else if (localProfile.mode.includes("v8")) allowedCotTypes = ["v8"]; 
        else if (localProfile.mode.includes("v9")) allowedCotTypes = ["v9", "v9-lite", "v9-director", "v9-immersion", "v9-hybrid"];

        // Thinking Frameworks
        secCot.append(`<div class="wstyle-section-head purple"><i class="fa-solid fa-diagram-project"></i> 选择框架</div>`);
        const typeGrid = $(`<div class="mtab-card-grid" style="margin-bottom: 24px;"></div>`);
        const types = [
            { id: "v10-ukiyo", label: "思维链 V10 Ukiyo", desc: "为 Ukiyo 打造的长篇推理。像小说家动笔前自言自语——现在时、有点乱、从不是计划。无阶段、无清单、无审计。", isNew: true },
            { id: "v10-ukiyo-cap", label: "思维链 V10 Ukiyo — 思考上限", desc: "同样的写作者心智，但对思考阶段设硬上限。适合过度思考的模型。", isNew: true },
            { id: "v10-shura", label: "思维链 V10 Shura", desc: "七条规则带入写作本身，而非事先计划。为 V10 Shura 打造，也是四者中最轻的。", isNew: true },
            { id: "v10-shura-cap", label: "思维链 V10 Shura — 思考上限", desc: "同样的七条规则，但对思考阶段设硬上限。适合过度思考的模型。", isNew: true },
            { id: "v1", label: "思维链 V1（经典）", desc: "最初的 8 步框架。侧重 NPC 内在情绪景观与可观察行动的对照。" },
            { id: "v2", label: "思维链 V2（新）", desc: "新的实验框架。更严的现实检查、信息审计、更好的 NPC 与钩子生成。" },
            { id: "v6", label: "思维链 V6（梦之队）", desc: "专为 V6 引擎设计的完整 4 阶段序列。专门验证与建模。" },
            { id: "v6-lite", label: "思维链 V6（精简）", desc: "精简 3 阶段序列。在保持叙事规则的同时降低 token 开销。" },
            { id: "v7", label: "思维链 V7", desc: "新的 V7 序列，含 5 阶段严格事实重建。"},
            { id: "v7-lite", label: "思维链 V7（精简）", desc: "面向 V7 的精简 5 阶段序列。" },
            { id: "v7.5", label: "思维链 V7.5 Kismet", desc: "聚焦故事引擎机制的新 V7.5 序列。" },
            { id: "v8", label: "思维链 V8", desc: "新的 V8 叙事处理序列。" },
            { id: "v8-fusion", label: "思维链 V8 Fusion", desc: "新的 V8 Fusion 叙事处理序列。" },
            { id: "v9", label: "思维链 V9 Mirage", desc: "主要且最均衡的推理序列，专为 V9 Mirage 引擎打造。现代角色扮演的金标准。", isNew: true },
            { id: "v9-director", label: "思维链 V9 Mirage Air", desc: "更轻的 CoT V9 Mirage 版本，输出不同。试试看喜不喜欢。", isNew: true },
            { id: "v9-immersion", label: "思维链 V9 Mirage Max", desc: "重度、最大思考序列。迫使 AI 在写下一个字前深深潜入感官与心理真实。", isNew: true },
            { id: "v9-hybrid", label: "思维链 V9 Kuromaku", desc: "专为搭配 V9 Kuromaku 引擎的多智能体推理序列。", isNew: true },
            { id: "v9-lite", label: "思维链 V9 Cui（精简）", desc: "高度精简、执行快速的推理序列，与 V9 Cui 引擎搭配以节省 token。", isNew: true }
        ];
        types.forEach(t => {
            const isSel = currentType === t.id;
            const isWarned = allowedCotTypes !== null && !allowedCotTypes.includes(t.id);
            
            let badges = '';
            if (isWarned) badges = `<span class="ecard-badge" style="background:rgba(245,158,11,0.15);color:#f59e0b;"><i class="fa-solid fa-triangle-exclamation"></i> May be Incompatible</span>`;
            else if (t.isNew) badges = `<span class="ecard-badge new">New</span>`;

            const card = $(`
                <div class="mtab-eng-card ${isSel ? 'active' : ''}">
                    <div class="ecard-accent"></div>
                    <div class="ecard-body">
                        <div class="ecard-title">
                            <span>${t.label}</span>
                            ${isSel ? `<span class="ecard-badge" style="background:rgba(168,85,247,0.15);color:#a855f7;"><i class="fa-solid fa-check"></i> Active</span>` : ''}
                        </div>
                        <p class="ecard-desc">${t.desc}</p>
                        ${badges ? `<div style="margin-top:4px;">${badges}</div>` : ''}
                    </div>
                </div>
            `);
            
            card.on("click", () => {
                if (t.id.startsWith("v10")) localProfile.model = `cot-${t.id}-english`;
                else if (t.id === "v7") localProfile.model = `cot-v7-english`;
                else if (t.id === "v7.5") localProfile.model = `cot-v7.5-english`;
                else if (t.id === "v7-lite") localProfile.model = `cot-v7-lite-english`;
                else if (t.id === "v8") localProfile.model = `cot-v8-english`;
                else if (t.id === "v8-fusion") localProfile.model = `cot-v8-fusion-english`;
                else if (t.id.startsWith("v9")) localProfile.model = `cot-${t.id}-english`;
                else localProfile.model = `cot-${t.id}-${currentLang}`;
                saveProfileToMemory(); renderCoreAndCot(c);
            }); 
            typeGrid.append(card);
        });
        secCot.append(typeGrid);

        // 思考力度
        if (!localProfile.thinkEffort) localProfile.thinkEffort = "unspecified";
        if (!localProfile.customThinkEffort) localProfile.customThinkEffort = "100";

        secCot.append(`<div class="wstyle-section-head purple"><i class="fa-solid fa-gauge-high"></i> 思考力度</div>`);
        const effortGrid = $(`<div class="mtab-card-grid" style="margin-bottom: 24px; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));"></div>`);
        const efforts = [
            { id: "100", label: "100 Words" },
            { id: "250", label: "250 Words" },
            { id: "450", label: "450 Words" },
            { id: "custom", label: "Custom" },
            { id: "unspecified", label: "Unspecified" }
        ];
        efforts.forEach(e => {
            const isSel = localProfile.thinkEffort === e.id;
            const card = $(`
                <div class="mtab-eng-card ${isSel ? 'active' : ''}" style="text-align:center;">
                    <div class="ecard-accent"></div>
                    <div class="ecard-body" style="padding:12px 10px; align-items:center;">
                        <span style="font-weight:700; font-size:0.85rem; color:${isSel ? '#a855f7' : 'var(--text-main)'};">${e.label}</span>
                    </div>
                </div>
            `);
            card.on("click", () => { localProfile.thinkEffort = e.id; saveProfileToMemory(); renderCoreAndCot(c); });
            effortGrid.append(card);
        });
        secCot.append(effortGrid);

        if (localProfile.thinkEffort === "custom") {
            const customBlock = $(`
                <div class="mtab-panel" style="margin-top:-14px; margin-bottom:24px;">
                    <div class="mtab-setting-row">
                        <div class="set-info"><div class="set-label">自定义字数</div></div>
                        <input type="number" id="ps_input_custom_effort" class="ps-modern-input" style="width: 150px;" value="${localProfile.customThinkEffort}" min="1" />
                    </div>
                </div>
            `);
            customBlock.find("#ps_input_custom_effort").on("change input", function () {
                localProfile.customThinkEffort = $(this).val(); saveProfileToMemory();
            });
            secCot.append(customBlock);
        }

        // Gemini Toggle
        if (localProfile.thinkingV2 === undefined) localProfile.thinkingV2 = false;
        const v2Card = $(`
            <div class="mtab-toggle-row ${localProfile.thinkingV2 ? 'active' : ''}" style="margin-bottom: 24px; cursor: pointer;">
                <div class="toggle-info">
                    <div class="toggle-label"><i class="fa-solid fa-sparkles" style="color:#a855f7;"></i> Gemini Thinking Override</div>
                    <div class="toggle-desc">仅对 Gemini 模型启用以注入特定 XML 标签。</div>
                </div>
                <div class="ps-switch"></div>
            </div>
        `);
        v2Card.on("click", function () { localProfile.thinkingV2 = !localProfile.thinkingV2; saveProfileToMemory(); renderCoreAndCot(c); });
        secCot.append(v2Card);

        // Language
        secCot.append(`<div class="wstyle-section-head gold"><i class="fa-solid fa-language"></i> 推理语言</div>`);
        const langGrid = $(`<div class="mtab-card-grid" style="margin-bottom: 20px; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));"></div>`);
        let langs = [
            { id: "english", label: "English" }, { id: "arabic", label: "Arabic (العربية)", rec: true }, { id: "spanish", label: "Spanish (Español)" },
            { id: "french", label: "French (Français)" }, { id: "zh", label: "Mandarin (中文)" }, { id: "ru", label: "Russian (Русский)" },
            { id: "jp", label: "Japanese (日本語)" }, { id: "pt", label: "Portuguese (Português)" }
        ];
        if (currentType.startsWith("v10") || currentType === "v7" || currentType === "v7-lite" || currentType === "v7.5" || currentType === "v8" || currentType === "v8-fusion" || currentType.startsWith("v9")) langs = [{ id: "english", label: "English" }];
        langs.forEach(l => {
            const isSel = currentLang === l.id;
            let badges = '';
            if (l.rec) badges = `<span class="ecard-badge rec"><i class="fa-solid fa-star"></i> Pro Tip</span>`;

            const card = $(`
                <div class="mtab-eng-card ${isSel ? 'active' : ''}">
                    <div class="ecard-accent"></div>
                    <div class="ecard-body" style="padding:12px 16px;">
                        <div class="ecard-title" style="font-size:0.88rem;">
                            <span>${l.label}</span>
                            ${isSel ? `<span class="ecard-badge" style="background:rgba(245,158,11,0.15);color:var(--gold);"><i class="fa-solid fa-check"></i></span>` : ''}
                        </div>
                        ${badges ? `<div style="margin-top:2px;">${badges}</div>` : ''}
                    </div>
                </div>
            `);
            card.on("click", () => { localProfile.model = `cot-${currentType}-${l.id}`; saveProfileToMemory(); renderCoreAndCot(c); });
            langGrid.append(card);
        }); 
        secCot.append(langGrid);
    }

    // --- ASSEMBLE ---
    mainArea.append(secOfficial).append(secCustom).append(secCot).append(secConfig);
    layout.append(mainArea);
    root.append(layout);
    c.append(root);

    // ── NAVIGATION LOGIC ──
    const navButtons = [btnOfficial, btnCustom, btnCot, btnConfig];
    const sections = [secOfficial, secCustom, secCot, secConfig];

    const switchSection = (targetId) => {
        navButtons.forEach(btn => {
            if (btn.attr('data-target') === targetId) btn.addClass('active');
            else btn.removeClass('active');
        });
        sections.forEach(sec => {
            if (sec.attr('id') === targetId) sec.show();
            else sec.hide();
        });
    };

    btnOfficial.on('click', () => switchSection('sec-official'));
    btnCustom.on('click', () => switchSection('sec-custom'));
    btnCot.on('click', () => switchSection('sec-cot'));
    btnConfig.on('click', () => switchSection('sec-config'));

    // Trigger initial state
    switchSection(activeSubTab);
}
