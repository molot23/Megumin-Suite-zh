/**
 * First-level Extensions settings entry:
 * - Open Megumin preset modal (same as floating launcher)
 * - Toggle hide floating launcher ball
 */
import { extension_settings, saveSettingsDebounced } from "../st.js";
import { extensionName } from "../core/constants.js";

const PANEL_ID = "megumin_ext_settings";
const HIDE_KEY = "hideLauncherBall";

function ensureUiSettings() {
    if (!extension_settings[extensionName]) extension_settings[extensionName] = { profiles: {} };
    if (!extension_settings[extensionName].globalSettings) {
        extension_settings[extensionName].globalSettings = {
            promptPreview: false,
            enableUtilityPrefill: false,
            saveMode: "character",
            [HIDE_KEY]: false,
        };
    }
    const g = extension_settings[extensionName].globalSettings;
    if (typeof g[HIDE_KEY] !== "boolean") g[HIDE_KEY] = false;
    return g;
}

export function isLauncherHidden() {
    return !!ensureUiSettings()[HIDE_KEY];
}

export function applyLauncherVisibility() {
    const hide = isLauncherHidden();
    const $btn = $("#prompt-slot-fixed-btn");
    if (!$btn.length) return;
    if (hide) {
        $btn.css({ display: "none", visibility: "hidden", opacity: "0", pointerEvents: "none" });
        $btn.attr("aria-hidden", "true");
    } else {
        // initDraggableButton sets display:flex when positioning; keep visible defaults
        $btn.css({ display: "flex", visibility: "visible", opacity: "1", pointerEvents: "" });
        $btn.removeAttr("aria-hidden");
    }
}

/**
 * Open the same preset modal as #prompt-slot-fixed-btn.
 * deps: { initProfile, updateCharacterDisplay, switchTab, initMobileDrawer? }
 */
export function openMeguminPresetModal(deps = {}) {
    const {
        initProfile,
        updateCharacterDisplay,
        switchTab,
        initMobileDrawer,
    } = deps;
    try {
        if (typeof initProfile === "function") initProfile();
        if (typeof updateCharacterDisplay === "function") updateCharacterDisplay();
        if (typeof switchTab === "function") switchTab(0);
    } catch (e) {
        console.error(`[${extensionName}] openMeguminPresetModal prep failed`, e);
    }
    const $overlay = $("#prompt-slot-modal-overlay");
    if (!$overlay.length) {
        toastr?.error?.("Megumin 预设面板尚未加载，请稍后再试或刷新页面", "Megumin Suite");
        return false;
    }
    $overlay.fadeIn(250).css("display", "flex");
    if (typeof initMobileDrawer === "function") {
        setTimeout(() => {
            try { initMobileDrawer(); } catch (_) { /* ignore */ }
        }, 100);
    }
    return true;
}

export function injectExtSettingsPanel(deps = {}) {
    ensureUiSettings();
    if ($(`#${PANEL_ID}`).length) {
        applyLauncherVisibility();
        return true;
    }

    const $target = $("#extensions_settings2").length
        ? $("#extensions_settings2")
        : ($("#extensions_settings").length ? $("#extensions_settings") : null);
    if (!$target) return false;

    const hide = isLauncherHidden();
    const html = `
        <div id="${PANEL_ID}" class="megumin-ext-settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>Megumin Suite 汉化版</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <p style="opacity:.85;font-size:12px;line-height:1.4;margin:0 0 8px;">
                        预设大面板与聊天页悬浮球同一入口。隐藏悬浮球后，请用下方按钮打开设置。
                    </p>
                    <div class="megumin-ext-actions" style="display:flex;flex-direction:column;gap:8px;">
                        <button type="button" id="megumin_open_preset" class="menu_button" style="width:100%;">
                            打开 Megumin 预设设置
                        </button>
                        <label class="checkbox_label" style="display:flex;align-items:center;gap:8px;">
                            <input type="checkbox" id="megumin_hide_launcher" ${hide ? "checked" : ""}/>
                            <span>隐藏启动悬浮球</span>
                        </label>
                        <small style="opacity:.75;">隐藏后聊天页不再显示头像球；扩展设置里仍可打开预设。</small>
                    </div>
                </div>
            </div>
        </div>
    `;
    $target.prepend(html);

    $("#megumin_open_preset").on("click", function () {
        openMeguminPresetModal(deps);
    });

    $("#megumin_hide_launcher").on("change", function () {
        const g = ensureUiSettings();
        g[HIDE_KEY] = $(this).is(":checked");
        saveSettingsDebounced();
        applyLauncherVisibility();
        toastr?.info?.(
            g[HIDE_KEY] ? "已隐藏启动悬浮球（可在扩展设置打开预设）" : "已显示启动悬浮球",
            "Megumin Suite",
        );
    });

    applyLauncherVisibility();
    return true;
}

/** Retry inject until extensions settings DOM exists. */
export function startExtSettingsInjector(deps = {}) {
    const tryInject = () => {
        try {
            if (injectExtSettingsPanel(deps)) return true;
        } catch (e) {
            console.warn(`[${extensionName}] ext settings inject`, e);
        }
        return false;
    };
    if (tryInject()) return;
    let n = 0;
    const t = setInterval(() => {
        n += 1;
        if (tryInject() || n > 40) clearInterval(t);
    }, 500);
}
