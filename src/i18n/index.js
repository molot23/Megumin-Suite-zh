// Minimal i18n for this UI-CN fork. Default locale is zh-CN.
// Keys are the original English UI strings (stable for upstream merges).
import { ZH_CN } from "./zh-CN.js";

const DICTS = { "zh-CN": ZH_CN };
let locale = "zh-CN";

export function setLocale(next) {
    if (DICTS[next]) locale = next;
}

export function getLocale() {
    return locale;
}

/**
 * Translate a UI string. Falls back to the key (English) when missing.
 * Supports {name}-style interpolation: t("Hello {name}", { name: "Ada" })
 */
export function t(key, vars) {
    if (key == null || key === "") return key;
    const dict = DICTS[locale] || {};
    let out = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key;
    if (vars && typeof out === "string") {
        out = out.replace(/\{(\w+)\}/g, (_, k) =>
            (vars[k] != null ? String(vars[k]) : `{${k}}`));
    }
    return out;
}

/** Translate if present; otherwise return the original. Alias of t. */
export function tt(key, vars) {
    return t(key, vars);
}
