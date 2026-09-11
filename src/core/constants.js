// Identity constants. Kept apart from state.js because these never change at
// runtime, and because almost every module wants extensionName for the
// extension_settings lookup — importing that shouldn't drag mutable state along.

/**
 * Resolve the real third-party folder this file lives in.
 * GitHub installs of the zh fork land in Megumin-Suite-zh; upstream uses Megumin-Suite.
 * Hardcoding either name breaks $.get(example.html) and the floating launcher never appears.
 */
function resolveExtensionFolderPath() {
    try {
        const pathname = decodeURIComponent(new URL(import.meta.url).pathname);
        const marker = "/scripts/extensions/third-party/";
        const idx = pathname.indexOf(marker);
        if (idx !== -1) {
            const folder = pathname.slice(idx + marker.length).split("/").filter(Boolean)[0];
            if (folder) return `scripts/extensions/third-party/${folder}`;
        }
    } catch (_) { /* fall through */ }
    return "scripts/extensions/third-party/Megumin-Suite";
}

/** Stable settings key — keep Megumin-Suite so profiles survive folder renames. */
export const extensionName = "Megumin-Suite";
export const extensionFolderPath = resolveExtensionFolderPath();
export const TARGET_PRESET_NAME = "Megumin Engine";
