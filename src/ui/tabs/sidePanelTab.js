// ────────────────────────────────────────────────────────────────────────────
// 侧边栏 — popping tracker blocks out of the chat.
// ────────────────────────────────────────────────────────────────────────────

import { localProfile } from "../../core/state.js";
import { extension_settings, saveSettingsDebounced } from "../../st.js";
import { meguminScheduleBlocksRefresh } from "../../features/blocks/chat.js";
import { saveProfileToMemory, saveProfileDebounced } from "../../core/profile.js";
import {
    getSidePanelSettings, applyInlineHidingChange, applyPositionChange, applyWidthChange,
    applyEnabledChange, applyModeChange, applyScaleChange, applySectionOrder,
    resetSectionLayout, getOrderedSections, getPresentBarSettings, applyPresentBarChange,
    refreshSidePanel, refreshPresentBar,
} from "../../sidepanel/panel.js";
import { SECTION_REGISTRY } from "../../sidepanel/sections.js";

export function renderSidePanelTab(c) {
    c.empty();
    const cfg = getSidePanelSettings();
    const pb = getPresentBarSettings();

    const enabledBadge = `<div id="megsp_header_badge" class="mtab-header-badge" style="background: ${cfg.enabled ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.06)'}; color: ${cfg.enabled ? '#f59e0b' : 'var(--text-muted)'}; border: 1px solid ${cfg.enabled ? 'rgba(245,158,11,0.25)' : 'var(--border-color)'};">
        <i class="fa-solid fa-${cfg.enabled ? 'circle-check' : 'circle-xmark'}" style="font-size:0.6rem;"></i> ${cfg.enabled ? '已启用' : '已禁用'}
    </div>`;

    const isDocked = cfg.mode !== "floating";
    const sectionRows = getOrderedSections(cfg).map((def, i) => `
        <div class="mtab-toggle-row meg-sp-section-toggle ${cfg.sections[def.id]?.visible !== false ? 'active' : ''}" data-section="${def.id}">
            <div class="toggle-info">
                <div class="toggle-label"><span class="meg-sp-order-num">${i + 1}</span><i class="fa-solid ${def.icon}" style="color: var(--gold);"></i> ${def.title}</div>
            </div>
            <div class="ps-switch"></div>
        </div>
    `).join("");

    c.append(`
        <div class="mtab-header">
            <div class="mtab-header-left">
                <div class="mtab-header-icon" style="background: linear-gradient(135deg, #f59e0b, #b45309);">
                     <i class="fa-solid fa-table-columns"></i>
                </div>
                <div>
                    <h2>侧边栏</h2>
                    <p>可停靠 / 可浮动的追踪面板。浮动时可拖拽标题栏，从边缘调整大小，可重排分区。AI 回复时自动更新。</p>
                </div>
            </div>
            ${enabledBadge}
        </div>

        <div class="mtab-callout red" style="margin-bottom: 16px;">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <span><strong>已停用。</strong> Blocks do this better &mdash; a nicer card, far more
            you can change about it, and it keeps up with new blocks as they land. And frankly,
            Kazuma doesn't like the side panel.
            <br><br>So it is no longer being developed and has not kept up: newer blocks, custom
            blocks and the stat blocks may not appear in it, or may appear wrong. It still works for
            what it already knew about, and everything it shows is drawn in the chat card
            regardless.</span>
        </div>

        <div class="mtab-toggle-row ${cfg.enabled ? 'active' : ''}" id="megsp_enabled_row" style="margin-bottom: 20px;">
            <div class="toggle-info">
                <div class="toggle-label"><i class="fa-solid fa-table-columns" style="color:var(--gold);"></i> 启用侧边栏</div>
                <div class="toggle-desc">将面板挂载到页面。关闭后，追踪块仍按往常内联显示在聊天中。</div>
            </div>
            <div class="ps-switch"></div>
        </div>

        <div id="megsp_main_content" style="display: ${cfg.enabled ? 'block' : 'none'};">
            <div class="meg-sp-group-head"><i class="fa-solid fa-window-maximize"></i> 面板</div>

            <div class="meg-sp-settings-row">
                <div>
                    <div class="label">模式</div>
                    <div class="desc">「停靠」将面板固定到屏幕边缘；「浮动」变为可拖拽、可调整大小的窗口。</div>
                </div>
                <div class="control">
                    <select id="megsp_mode" class="ps-modern-input" style="min-width: 140px;">
                        <option value="docked" ${isDocked ? "selected" : ""}>停靠</option>
                        <option value="floating" ${!isDocked ? "selected" : ""}>浮动</option>
                    </select>
                </div>
            </div>

            <div class="meg-sp-settings-row" id="megsp_position_row" style="${isDocked ? "" : "display:none;"}">
                <div>
                    <div class="label">停靠边缘</div>
                    <div class="desc">面板锚定到屏幕的哪一侧。</div>
                </div>
                <div class="control">
                    <select id="megsp_position" class="ps-modern-input" style="min-width: 140px;">
                        <option value="right" ${cfg.position === "right" ? "selected" : ""}>右侧</option>
                        <option value="left" ${cfg.position === "left" ? "selected" : ""}>左侧</option>
                    </select>
                </div>
            </div>

            <div class="meg-sp-settings-row" id="megsp_width_row" style="${isDocked ? "" : "display:none;"}">
                <div>
                    <div class="label">停靠宽度</div>
                    <div class="desc">也可拖拽面板内侧边缘调整大小。移动端限制为视口的 94%。</div>
                </div>
                <div class="control">
                    <input id="megsp_width" type="number" min="320" max="1100" step="10" value="${cfg.width || 620}" class="ps-modern-input" style="width: 110px;" />
                    <span style="color: var(--text-muted); font-size: 12px;">px</span>
                </div>
            </div>

            <div class="meg-sp-settings-row">
                <div>
                    <div class="label">界面缩放</div>
                    <div class="desc">缩放整个面板——文字、卡片、头像等全部内容。</div>
                </div>
                <div class="control">
                    <input id="megsp_scale" type="range" min="0.8" max="1.4" step="0.05" value="${cfg.scale || 1}" style="width: 140px;" />
                    <span id="megsp_scale_val" style="color: var(--text-muted); font-size: 12px; min-width: 42px; text-align: right;">${Math.round((cfg.scale || 1) * 100)}%</span>
                </div>
            </div>

            <div class="meg-sp-settings-row">
                <div>
                    <div class="label">重置浮动位置</div>
                    <div class="desc">将丢失的浮动面板拉回屏幕默认位置与大小。</div>
                </div>
                <div class="control"><button id="megsp_float_reset" class="ps-modern-btn secondary"><i class="fa-solid fa-crosshairs"></i> 重置</button></div>
            </div>

            <div class="meg-sp-group-head"><i class="fa-solid fa-layer-group"></i> Sections</div>

            <div class="meg-sp-settings-row" style="flex-direction: column; align-items: stretch; gap: 8px;">
                <div>
                    <div class="label">Sections to show</div>
                    <div class="desc">Toggle visibility. Numbers show current panel order — Alt+↑/↓ on a section's grip (in the panel) reorders it.</div>
                </div>
                <div class="meg-sp-section-grid">
                    ${sectionRows}
                </div>
            </div>

            <div class="mtab-toggle-row ${cfg.autoHideEmpty ? 'active' : ''}" id="megsp_autohide_row">
                <div class="toggle-info">
                    <div class="toggle-label">隐藏无数据的分区</div>
                    <div class="toggle-desc">没有内容可显示的分区会直接消失，而不是渲染空壳。</div>
                </div>
                <div class="ps-switch"></div>
            </div>

            <div class="meg-sp-settings-row">
                <div>
                    <div class="label">重置分区布局</div>
                    <div class="desc">恢复默认顺序、可见性与展开/折叠状态。</div>
                </div>
                <div class="control"><button id="megsp_sections_reset" class="ps-modern-btn secondary"><i class="fa-solid fa-rotate-left"></i> 重置</button></div>
            </div>

            <div class="meg-sp-group-head"><i class="fa-solid fa-users"></i> Present Characters Bar</div>

            <div class="mtab-toggle-row ${pb.enabled ? 'active' : ''}" id="megpb_enabled_row">
                <div class="toggle-info">
                    <div class="toggle-label">启用在场角色条</div>
                    <div class="toggle-desc">Doom 风格的横向肖像条，位于聊天输入框旁。从 AI 世界状态的「在场 NPC」拉取阵容，有则使用 NPC 库中的肖像。</div>
                </div>
                <div class="ps-switch"></div>
            </div>

            <div class="meg-sp-settings-row">
                <div>
                    <div class="label">条带位置</div>
                    <div class="desc">条带相对于 SillyTavern 消息输入框的挂载位置。</div>
                </div>
                <div class="control">
                    <select id="megpb_position" class="ps-modern-input" style="min-width: 160px;">
                        <option value="above" ${pb.position === "above" ? "selected" : ""}>输入框上方</option>
                        <option value="below" ${pb.position === "below" ? "selected" : ""}>输入框下方</option>
                        <option value="off"   ${pb.position === "off"   ? "selected" : ""}>Off (hide)</option>
                    </select>
                </div>
            </div>

            <div class="meg-sp-settings-row">
                <div>
                    <div class="label">卡片尺寸</div>
                    <div class="desc">条带中每张肖像卡片的宽 × 高。</div>
                </div>
                <div class="control">
                    <input id="megpb_card_w" type="number" min="80" max="240" step="5" value="${pb.cardWidth || 120}" class="ps-modern-input" style="width: 80px;" />
                    <span style="color: var(--text-muted); font-size: 12px;">×</span>
                    <input id="megpb_card_h" type="number" min="100" max="320" step="5" value="${pb.cardHeight || 160}" class="ps-modern-input" style="width: 80px;" />
                    <span style="color: var(--text-muted); font-size: 12px;">px</span>
                </div>
            </div>

            <div class="meg-sp-group-head"><i class="fa-solid fa-screwdriver-wrench"></i> Advanced</div>

            <div class="mtab-toggle-row ${cfg.hideInline ? 'active' : ''}" id="megsp_hideinline_row">
                <div class="toggle-info">
                    <div class="toggle-label">在聊天中隐藏内联追踪块</div>
                    <div class="toggle-desc">从渲染后的聊天 DOM 中移除 <code>&lt;details&gt;</code> 追踪块（仍保存在已保存消息中，以便重新解析）。</div>
                </div>
                <div class="ps-switch"></div>
            </div>

            <div class="meg-sp-settings-row">
                <div>
                    <div class="label">强制刷新</div>
                    <div class="desc">立即重新解析最新助手消息并重建面板。</div>
                </div>
                <div class="control"><button id="megsp_refresh" class="ps-modern-btn primary"><i class="fa-solid fa-rotate"></i> 刷新</button></div>
            </div>

            <div class="meg-sp-settings-row">
                <div>
                    <div class="label">重置全部侧边栏设置</div>
                    <div class="desc">将此选项卡的所有设置清回默认值。调试控制台句柄： <code>window.LukaSuite</code></div>
                </div>
                <div class="control"><button id="megsp_reset_all" class="ps-modern-btn secondary" style="color: #ef4444; border-color: rgba(239,68,68,0.3);"><i class="fa-solid fa-trash"></i> 全部重置</button></div>
            </div>
        </div>
    `);

    // ── Panel group ──
    c.find("#megsp_enabled_row").on("click", function () {
        cfg.enabled = !cfg.enabled;
        saveSettingsDebounced();
        applyEnabledChange();
        refreshSidePanel();
        meguminScheduleBlocksRefresh();
        if (cfg.enabled) {
            $(this).addClass("active");
            $("#megsp_main_content").slideDown(200);
            $("#megsp_header_badge").css({ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', 'border-color': 'rgba(245,158,11,0.25)' }).html(`<i class="fa-solid fa-circle-check" style="font-size:0.6rem;"></i> 已启用`);
        } else {
            $(this).removeClass("active");
            $("#megsp_main_content").slideUp(200);
            $("#megsp_header_badge").css({ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', 'border-color': 'var(--border-color)' }).html(`<i class="fa-solid fa-circle-xmark" style="font-size:0.6rem;"></i> 已禁用`);
        }
    });
    c.find("#megsp_mode").on("change", function () {
        cfg.mode = $(this).val();
        saveSettingsDebounced();
        applyModeChange();
        refreshSidePanel();
        const docked = cfg.mode === "docked";
        $("#megsp_position_row, #megsp_width_row").toggle(docked);
    });
    c.find("#megsp_position").on("change", function () {
        cfg.position = $(this).val();
        saveSettingsDebounced();
        applyPositionChange();
    });
    c.find("#megsp_width").on("input change", function () {
        const v = Math.max(320, Math.min(1100, parseInt($(this).val(), 10) || 620));
        cfg.width = v;
        saveSettingsDebounced();
        applyWidthChange();
    });
    c.find("#megsp_scale").on("input", function () {
        cfg.scale = parseFloat($(this).val()) || 1;
        $("#megsp_scale_val").text(Math.round(cfg.scale * 100) + "%");
        applyScaleChange();
    });
    c.find("#megsp_scale").on("change", function () {
        saveSettingsDebounced();
    });
    c.find("#megsp_float_reset").on("click", function () {
        cfg.float = { x: null, y: null, w: 620, h: 720 };
        saveSettingsDebounced();
        applyModeChange();
        toastr.success("浮动位置已重置", "Megumin Suite");
    });

    // ── Sections group ──
    c.find(".meg-sp-section-toggle").on("click", function () {
        const key = $(this).attr("data-section");
        if (!cfg.sections[key]) return;
        cfg.sections[key].visible = !cfg.sections[key].visible;
        $(this).toggleClass("active", cfg.sections[key].visible);
        saveSettingsDebounced();
        refreshSidePanel();
    });
    c.find("#megsp_autohide_row").on("click", function () {
        cfg.autoHideEmpty = !cfg.autoHideEmpty;
        $(this).toggleClass("active", cfg.autoHideEmpty);
        saveSettingsDebounced();
        refreshSidePanel();
    });
    c.find("#megsp_sections_reset").on("click", function () {
        resetSectionLayout();
        renderSidePanelTab(c);
        toastr.success("分区布局已重置", "Megumin Suite");
    });

    // ── Present Characters Bar group ──
    c.find("#megpb_enabled_row").on("click", function () {
        pb.enabled = !pb.enabled;
        $(this).toggleClass("active", pb.enabled);
        saveSettingsDebounced();
        applyPresentBarChange();
    });
    c.find("#megpb_position").on("change", function () {
        pb.position = $(this).val();
        saveSettingsDebounced();
        applyPresentBarChange();
    });
    c.find("#megpb_card_w").on("input change", function () {
        const v = Math.max(80, Math.min(240, parseInt($(this).val(), 10) || 120));
        pb.cardWidth = v;
        saveSettingsDebounced();
        applyPresentBarChange();
    });
    c.find("#megpb_card_h").on("input change", function () {
        const v = Math.max(100, Math.min(320, parseInt($(this).val(), 10) || 160));
        pb.cardHeight = v;
        saveSettingsDebounced();
        applyPresentBarChange();
    });

    // ── Advanced group ──
    c.find("#megsp_hideinline_row").on("click", function () {
        cfg.hideInline = !cfg.hideInline;
        $(this).toggleClass("active", cfg.hideInline);
        saveSettingsDebounced();
        applyInlineHidingChange();
        meguminScheduleBlocksRefresh();
    });
    c.find("#megsp_refresh").on("click", function () {
        refreshSidePanel();
        refreshPresentBar();
        toastr.success("侧边栏已刷新", "Megumin Suite");
    });
    c.find("#megsp_reset_all").on("click", function () {
        if (!confirm("将所有侧边栏设置重置为默认值？")) return;
        delete extension_settings["Megumin-Suite"].sidePanel;
        delete extension_settings["Megumin-Suite"].presentBar;
        saveSettingsDebounced();
        applyEnabledChange();
        applyPresentBarChange();
        refreshSidePanel();
        meguminScheduleBlocksRefresh();
        renderSidePanelTab(c);
        toastr.success("侧边栏设置已重置", "Megumin Suite");
    });
}
