// ────────────────────────────────────────────────────────────────────────────
// The settings window's tab list and its dock.
//
// This is the one module that knows which renderer draws which tab, so it must
// import all of them. The renderers therefore must not import back: a tab that
// needs to redraw itself fires REFRESH.SWITCH_TAB instead, which is registered
// at the bottom of this file.
// ────────────────────────────────────────────────────────────────────────────

import { localProfile, currentTab, setCurrentTab } from "../core/state.js";
import { registerRefreshHook, REFRESH } from "../core/refreshHooks.js";
import { TAB_SYNC_KEYS, TABS_ALREADY_GLOBAL, meguminGlobalSyncMap, meguminIsTabSynced, applyTabKeysToAllProfiles } from "../core/sync.js";
import { saveSettingsDebounced } from "../st.js";
import { updateLiveTokenCount } from "../core/tokens.js";
import { renderCoreAndCot } from "./tabs/coreAndCot.js";
import { renderPersonality } from "./tabs/personality.js";
import { renderGlobalAndBlocks } from "./tabs/globalAndBlocks.js";
import { renderSidePanelTab } from "./tabs/sidePanelTab.js";
import { renderGlobalSettings, hasUnseenSettingsNotice } from "./tabs/globalSettings.js";
import { renderStoryConfig } from "../features/storyconfig/ui.js";
import { renderStoryPlanner } from "../features/storyplan/ui.js";
import { renderBanList } from "../features/banlist/ui.js";
import { renderImageGen } from "../features/imagegen/index.js";
import { renderNpcBank } from "../features/npc/ui.js";
import { renderMemoryCore } from "../features/memory/index.js";
import { renderBlocksTab } from "../features/blocks/ui.js";
import { t as zh } from "../i18n/index.js";

// `title` stays English — it keys TAB_SYNC_KEYS / TABS_ALREADY_GLOBAL.
// Dock labels go through zh().
export const tabsUI = [
    { title: "PRESETS & COT", sub: "选择核心预设与思维链，并设定故事的常驻规则。", icon: "fa-server", render: renderCoreAndCot },
    { title: "Persona", sub: "设定人格。", icon: "fa-user-astronaut", render: renderPersonality },
    { title: "Writing Style", sub: "选择故事叙述的文风。", icon: "fa-pen-nib", render: renderStoryConfig },
    { title: "Global Toggles & Add Ons", sub: "语言、代词，以及挂在故事上的玩法系统。", icon: "fa-earth-americas", render: renderGlobalAndBlocks },
    { title: "BLOCKS", sub: "主数据块包含什么、顺序如何、如何显示。", icon: "fa-cubes", render: renderBlocksTab },
    { title: "Story Director", sub: "引导叙事，塑造接下来发生的事。", icon: "fa-clapperboard", render: renderStoryPlanner },
    { title: "Dynamic Ban List", sub: "扫描并禁用 AI 的重复套话。", icon: "fa-ban", render: renderBanList },
    { title: "Image Generation", sub: "连接 ComfyUI，在角色扮演中自动生成场景图。", icon: "fa-image", render: renderImageGen },
    { title: "NPCs Bank", sub: "自动提取并追踪故事中的重要 NPC。", icon: "fa-address-book", render: renderNpcBank },
    { title: "Memory Core", sub: "高级三层上下文与历史管理。", icon: "fa-memory", render: renderMemoryCore },
    { title: "Side Panel", sub: "把追踪块从聊天中弹出到固定侧边栏。", icon: "fa-table-columns", render: renderSidePanelTab },
    { title: "Global Settings", sub: "扩展偏好与关于信息。", icon: "fa-gear", render: renderGlobalSettings }
];

export function switchTab(index) {
    $(".dock").show();
    $("#ps_btn_save_close").show();
    $("#btn_apply_tab_all").show(); // Show on all tabs
    // The toggle is per tab, so its label has to follow the tab.
    setTimeout(updateGlobalSyncButton, 0);

    $("#ps_btn_dev_mode").html(`<i class="fa-solid fa-code"></i> 开发`).css("color", "#a855f7");

    let isSameTab = (currentTab === index);
    const container = $("#ps_stage_content");
    let savedScroll = 0;
    if (isSameTab && container.length) {
        savedScroll = container.scrollTop() || 0;
    }

    setCurrentTab(index);
    const tab = tabsUI[index];

    // Generate Icons
    const dotsContainer = $("#ps_dynamic_dots");
    if (dotsContainer.children(".sidebar-step").length < tabsUI.length) {
        dotsContainer.empty();
        
        // Render all normal tabs
        for (let i = 0; i < tabsUI.length - 1; i++) {
            const tabDef = tabsUI[i];
            const label = zh(tabDef.title);
            dotsContainer.append(`<div class="dock-icon sidebar-step" id="dot_${i}" title="${label}">
                <i class="fa-solid ${tabDef.icon}"></i> <span>${label}</span>
            </div>`);
        }
        
        // Push the Global Settings gear to the absolute bottom of the dock
        dotsContainer.append(`<div style="flex-grow: 1;"></div>`); 
        const lastIdx = tabsUI.length - 1;
        const lastTab = tabsUI[lastIdx];
        const lastLabel = zh(lastTab.title);
        dotsContainer.append(`<div class="dock-icon sidebar-step" id="dot_${lastIdx}" title="${lastLabel}" style="margin-bottom: 15px; color: #a1a1aa; transition: 0.2s;">
            <i class="fa-solid ${lastTab.icon}"></i> <span>${lastLabel}</span>
        </div>`);
    }

    $(".dock-icon").removeClass("active");
    $(`#dot_${index}`).addClass("active");

    // Re-read every switch rather than only at build time: the dots are drawn once
    // and reused, so a notice spent this session has to be able to go out again.
    $(`#dot_${tabsUI.length - 1}`).toggleClass("has-notice", hasUnseenSettingsNotice());

    container.empty();
    container.off(".devDirty");

    tab.render(container);

    if (isSameTab) {
        container.scrollTop(savedScroll);
    } else {
        container.scrollTop(0);
    }

    updateLiveTokenCount();
}

export function toggleTabGlobalSync() {
    const title = (tabsUI[currentTab] || {}).title;
    if (!title) return;
    const label = zh(title);

    if (TABS_ALREADY_GLOBAL.includes(title)) {
        toastr.info(`「${label}」已全局存储——在每个角色上都相同。`, "Megumin Suite");
        return;
    }
    if (!TAB_SYNC_KEYS[title]) {
        toastr.info("此选项卡没有可同步的内容。", "Megumin Suite");
        return;
    }

    const map = meguminGlobalSyncMap();
    const next = !map[title];
    map[title] = next;
    saveSettingsDebounced();

    if (next) {
        const ok = applyTabKeysToAllProfiles(title);
        if (!ok) {
            map[title] = false;
            saveSettingsDebounced();
            toastr.warning("面板仍在显示上一聊天的设置。请重新打开后再试。", "Megumin Suite");
            updateGlobalSyncButton();
            return;
        }
        toastr.success(`「${label}」现已应用于每个角色。此处更改会自动同步。`, "Megumin Suite");
    } else {
        toastr.info(`「${label}」已恢复为按角色保存。`, "Megumin Suite");
    }

    updateGlobalSyncButton();
}

export function meguminPropagateTabIfSynced() {
    // Only while the settings window is open: a save from a background feature
    // (an NPC banking itself, a summary landing) is not an edit to a tab.
    if (!$("#btn_apply_tab_all").length) return;
    const title = (tabsUI[currentTab] || {}).title;
    if (!meguminIsTabSynced(title)) return;
    applyTabKeysToAllProfiles(title);
}

export function updateGlobalSyncButton() {
    const btn = $("#btn_apply_tab_all");
    if (!btn.length) return;

    const title = (tabsUI[currentTab] || {}).title;
    const label = zh(title);
    const alreadyGlobal = TABS_ALREADY_GLOBAL.includes(title);
    const syncable = Boolean(TAB_SYNC_KEYS[title]);
    const on = meguminIsTabSynced(title);

    if (alreadyGlobal || !syncable) {
        btn.html(`<i class="fa-solid fa-earth-americas"></i> 全局`)
            .attr("title", alreadyGlobal ? "此选项卡已全局存储。" : "此选项卡没有可同步的内容。")
            .css({ color: "var(--text-muted)", "border-color": "var(--border-color)", opacity: "0.55" });
        return;
    }

    btn.html(`<i class="fa-solid fa-earth-americas"></i> 全局：${on ? "开" : "关"}`)
        .attr("title", on
            ? `「${label}」选项卡的每次更改都会复制到所有角色。点击停止。`
            : `「${label}」选项卡的更改仅作用于当前角色。点击设为全局。`)
        .css({
            color: on ? "#10b981" : "var(--gold)",
            "border-color": on ? "rgba(16,185,129,0.45)" : "rgba(245,158,11,0.3)",
            opacity: "1"
        });
}

// ────────────────────────────────────────────────────────────────────────────
// Wiring.
// ────────────────────────────────────────────────────────────────────────────

// With no index: redraw whatever is on screen. With one: navigate to it.
registerRefreshHook(REFRESH.SWITCH_TAB, (index) =>
    switchTab(typeof index === "number" ? index : currentTab));
registerRefreshHook(REFRESH.TAB_PROPAGATE, () => meguminPropagateTabIfSynced());
