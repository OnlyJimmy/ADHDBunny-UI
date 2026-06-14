import {
    eventSource,
    event_types,
    saveSettingsDebounced,
    this_chid,
} from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';

const EXTENSION_NAME = 'ADHDBunnyUI';
const LEGACY_EXTENSION_NAME = 'PersonalWorkspaceLayout';
const ROOT_ID = 'pwl-workspace-controls';
const SETTINGS_ID = 'pwl-settings';

const defaults = {
    enabled: true,
    minimumWidth: 1100,
    inspectorWidthPercent: 50,
    guidedRailCollapsed: false,
    bottomChatBarCollapsed: false,
    floatingInspectorMigrated: false,
    proportionalInspectorMigrated: false,
};

const tools = [
    { id: 'api', label: 'API', icon: 'fa-plug', host: '#ai-config-button', drawer: '#left-nav-panel', tab: '[data-sb-tab="api"]' },
    { id: 'presets', label: 'Presets', icon: 'fa-sliders', host: '#ai-config-button', drawer: '#left-nav-panel', tab: '[data-sb-tab="presets"]' },
    { id: 'sampling', label: 'Sampling', icon: 'fa-wave-square', host: '#ai-config-button', drawer: '#left-nav-panel', tab: '[data-sb-tab="sampling"]' },
    { id: 'formatting', label: 'Formatting', icon: 'fa-wand-magic-sparkles', host: '#ai-config-button', drawer: '#left-nav-panel', tab: '[data-sb-tab="advanced-formatting"]' },
    { id: 'agents', label: 'Agents', icon: 'fa-robot', host: '#ai-config-button', drawer: '#left-nav-panel', tab: '[data-sb-tab="agents"]' },
    { id: 'characters', label: 'Characters', icon: 'fa-address-book', host: '#rightNavHolder', drawer: '#right-nav-panel', tab: '[data-sb-character-tab="characters"]' },
    { id: 'groups', label: 'Groups', icon: 'fa-users', host: '#rightNavHolder', drawer: '#right-nav-panel', tab: '[data-sb-character-tab="groups"]' },
    { id: 'world-info', label: 'World Info', icon: 'fa-book-atlas', host: '#rightNavHolder', drawer: '#right-nav-panel', tab: '[data-sb-character-tab="world-info"]' },
    { id: 'persona', label: 'Persona', icon: 'fa-face-smile', host: '#rightNavHolder', drawer: '#right-nav-panel', tab: '[data-sb-character-tab="persona"]' },
    { id: 'backgrounds', label: 'Backgrounds', icon: 'fa-image', host: '#user-settings-button', drawer: '#user-settings-block', tab: '[data-sb-tab="background"]' },
    { id: 'extensions', label: 'Extensions', icon: 'fa-puzzle-piece', host: '#user-settings-button', drawer: '#user-settings-block', tab: '[data-sb-tab="extensions"]' },
    { id: 'settings', label: 'Settings', icon: 'fa-gear', host: '#user-settings-button', drawer: '#user-settings-block', tab: '[data-sb-tab="settings"]' },
    { id: 'server', label: 'Server', icon: 'fa-server', host: '#user-settings-button', drawer: '#user-settings-block', tab: '[data-sb-tab="server"]' },
    { id: 'console-logs', label: 'Console Logs', icon: 'fa-terminal', host: '#user-settings-button', drawer: '#user-settings-block', tab: '[data-sb-tab="console-logs"]' },
];

const toolGroups = [
    { id: 'connection', label: 'Connection', icon: 'fa-plug', tools: ['api', 'presets', 'sampling', 'formatting', 'agents'] },
    { id: 'characters', label: 'Characters', icon: 'fa-address-book', tools: ['characters', 'groups', 'world-info', 'persona'] },
    { id: 'interface', label: 'Interface', icon: 'fa-window-maximize', tools: ['backgrounds', 'extensions'] },
    { id: 'settings', label: 'Settings', icon: 'fa-gear', tools: ['settings', 'server', 'console-logs'] },
];

let drawerObserver;
let guidedObserver;
let resizeFrame;
let menuOpen = false;
let menuDismissHandlersAttached = false;
let pendingCharacterEditor = null;
let initialized = false;
let enabledForSession;
let firstInstallPending = false;
let firstInstallNoticeShown = false;

function getSettings() {
    const legacySettings = extension_settings[LEGACY_EXTENSION_NAME];
    const storedSettings = extension_settings[EXTENSION_NAME];

    if ((!storedSettings || typeof storedSettings !== 'object') && legacySettings && typeof legacySettings === 'object') {
        extension_settings[EXTENSION_NAME] = { ...legacySettings };
        saveSettingsDebounced();
    }

    const migratedSettings = extension_settings[EXTENSION_NAME];
    if (!migratedSettings || typeof migratedSettings !== 'object') {
        extension_settings[EXTENSION_NAME] = { ...defaults };
        firstInstallPending = true;
        saveSettingsDebounced();
    } else {
        for (const [key, value] of Object.entries(defaults)) {
            if (!(key in migratedSettings)) {
                migratedSettings[key] = value;
            }
        }
    }

    const settings = extension_settings[EXTENSION_NAME];

    if (!settings.floatingInspectorMigrated) {
        settings.floatingInspectorMigrated = true;
        saveSettingsDebounced();
    }

    if (!settings.proportionalInspectorMigrated) {
        settings.inspectorWidthPercent = defaults.inspectorWidthPercent;
        settings.proportionalInspectorMigrated = true;
        saveSettingsDebounced();
    }

    return settings;
}

function createToolButton(tool) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pwl-tool';
    button.dataset.pwlTool = tool.id;
    button.dataset.pwlHost = tool.host;
    button.title = tool.label;
    button.setAttribute('aria-label', tool.label);
    button.setAttribute('role', 'treeitem');
    button.setAttribute('aria-level', '2');
    button.innerHTML = `
        <span class="pwl-tool-icon fa-solid ${tool.icon}" aria-hidden="true"></span>
        <span class="pwl-tool-label">${tool.label}</span>
    `;
    button.addEventListener('click', () => openTool(tool, button));
    return button;
}

function createToolGroup(group) {
    const container = document.createElement('div');
    container.className = 'pwl-tree-group';
    container.dataset.pwlGroup = group.id;
    container.setAttribute('role', 'treeitem');
    container.setAttribute('aria-level', '1');
    container.setAttribute('aria-expanded', 'false');

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'pwl-tree-group-toggle';
    toggle.setAttribute('aria-label', group.label);
    toggle.innerHTML = `
        <span class="pwl-tree-chevron fa-solid fa-chevron-right" aria-hidden="true"></span>
        <span class="pwl-tree-group-icon fa-solid ${group.icon}" aria-hidden="true"></span>
        <span class="pwl-tree-group-label">${group.label}</span>
    `;

    const children = document.createElement('div');
    children.className = 'pwl-tree-children';
    children.setAttribute('role', 'group');

    for (const toolId of group.tools) {
        const tool = tools.find(item => item.id === toolId);
        if (tool) {
            children.append(createToolButton(tool));
        }
    }

    toggle.addEventListener('click', () => {
        const expanded = container.getAttribute('aria-expanded') === 'true';
        if (!expanded) {
            container.parentElement?.querySelectorAll(':scope > .pwl-tree-group').forEach(sibling => {
                if (sibling !== container) {
                    sibling.setAttribute('aria-expanded', 'false');
                }
            });
        }
        container.setAttribute('aria-expanded', String(!expanded));
    });
    container.append(toggle, children);
    return container;
}

function buildWorkspaceControls() {
    if (document.getElementById(ROOT_ID)) {
        return;
    }

    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.innerHTML = `
        <aside id="pwl-tool-rail" aria-label="Workspace tools">
            <button id="pwl-menu-toggle" type="button" title="Open workspace menu" aria-label="Open workspace menu" aria-expanded="false" aria-controls="pwl-tool-list">
                <span class="fa-solid fa-bars" aria-hidden="true"></span>
            </button>
            <div id="pwl-tool-list" role="tree" aria-label="Workspace sections" aria-hidden="true"></div>
        </aside>
        <aside id="pwl-composer-actions" aria-label="Composer actions">
            <button id="pwl-composer-actions-toggle" type="button" title="Collapse Guided Generations rail" aria-label="Collapse Guided Generations rail" aria-expanded="true" aria-controls="gg-action-button-container">
                <span class="fa-solid fa-chevron-down" aria-hidden="true"></span>
            </button>
            <div id="pwl-action-placeholder" title="Guided Generations actions appear here when enabled">
                <span class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></span>
            </div>
        </aside>
    `;

    const list = root.querySelector('#pwl-tool-list');
    toolGroups.forEach(group => list.append(createToolGroup(group)));
    document.body.append(root);

    root.querySelector('#pwl-menu-toggle').addEventListener('click', event => {
        event.stopPropagation();
        setMenuOpen(!menuOpen);
    });
    root.querySelector('#pwl-composer-actions-toggle').addEventListener('click', () => {
        const settings = getSettings();
        settings.guidedRailCollapsed = !settings.guidedRailCollapsed;
        setGuidedRailCollapsed(settings.guidedRailCollapsed);
        saveSettingsDebounced();
    });
    root.querySelector('#pwl-tool-list').addEventListener('click', event => event.stopPropagation());
    attachMenuDismissHandlers();
}

function setGuidedRailCollapsed(collapsed) {
    const rail = document.getElementById('pwl-composer-actions');
    const toggle = document.getElementById('pwl-composer-actions-toggle');
    if (!rail || !toggle) {
        return;
    }

    rail.classList.toggle('pwl-composer-actions-collapsed', collapsed);
    toggle.title = collapsed ? 'Expand Guided Generations rail' : 'Collapse Guided Generations rail';
    toggle.setAttribute('aria-label', toggle.title);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.querySelector('.fa-solid')?.classList.toggle('fa-chevron-up', collapsed);
    toggle.querySelector('.fa-solid')?.classList.toggle('fa-chevron-down', !collapsed);
}

function ensureBottomChatBarToggle() {
    if (!document.body.classList.contains('pwl-layout-active')) {
        return;
    }

    const bar = document.getElementById('sb-bottom-chat-bar');
    if (!bar) {
        return;
    }

    let toggle = document.getElementById('pwl-bottom-chat-bar-toggle');
    if (!toggle) {
        toggle = document.createElement('button');
        toggle.id = 'pwl-bottom-chat-bar-toggle';
        toggle.type = 'button';
        toggle.innerHTML = '<span class="fa-solid" aria-hidden="true"></span>';
        toggle.addEventListener('click', () => {
            const settings = getSettings();
            settings.bottomChatBarCollapsed = !settings.bottomChatBarCollapsed;
            setBottomChatBarCollapsed(settings.bottomChatBarCollapsed);
            saveSettingsDebounced();
        });
    }

    if (toggle.parentElement !== bar) {
        bar.append(toggle);
    }
    setBottomChatBarCollapsed(Boolean(getSettings().bottomChatBarCollapsed));
}

function setBottomChatBarCollapsed(collapsed) {
    const bar = document.getElementById('sb-bottom-chat-bar');
    const toggle = document.getElementById('pwl-bottom-chat-bar-toggle');
    if (!bar || !toggle) {
        return;
    }

    bar.classList.toggle('pwl-bottom-chat-bar-collapsed', collapsed);
    toggle.title = collapsed ? 'Expand bar above composer' : 'Collapse bar above composer';
    toggle.setAttribute('aria-label', toggle.title);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.querySelector('.fa-solid')?.classList.toggle('fa-chevron-down', collapsed);
    toggle.querySelector('.fa-solid')?.classList.toggle('fa-chevron-up', !collapsed);
}

function setMenuOpen(open) {
    menuOpen = Boolean(open);
    document.body.classList.toggle('pwl-menu-open', menuOpen);

    const toggle = document.getElementById('pwl-menu-toggle');
    const list = document.getElementById('pwl-tool-list');
    if (toggle) {
        toggle.setAttribute('aria-expanded', String(menuOpen));
        toggle.title = menuOpen ? 'Close workspace menu' : 'Open workspace menu';
        toggle.setAttribute('aria-label', toggle.title);
    }
    list?.setAttribute('aria-hidden', String(!menuOpen));
}

function attachMenuDismissHandlers() {
    if (menuDismissHandlersAttached) {
        return;
    }

    menuDismissHandlersAttached = true;
    document.addEventListener('click', () => setMenuOpen(false));
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            setMenuOpen(false);
        }
    });
}

function getDrawerContent(tool) {
    return document.querySelector(tool.drawer)
        ?? document.querySelector(`${tool.host} > .drawer-content`)
        ?? document.querySelector(`${tool.host} .drawer-content`);
}

function getToolTab(tool, drawer) {
    return tool.tab ? drawer?.querySelector(tool.tab) : null;
}

function dispatchClick(element) {
    element?.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
    }));
}

function cancelPendingCharacterEditor() {
    window.clearTimeout(pendingCharacterEditor?.timeoutId);
    pendingCharacterEditor = null;
}

function openPendingCharacterEditor() {
    if (!pendingCharacterEditor || Number(this_chid) !== pendingCharacterEditor.chid) {
        return false;
    }

    cancelPendingCharacterEditor();
    if (typeof window.SillyBunnyShell?.openTab === 'function') {
        window.SillyBunnyShell.openTab('characters', 'editor');
    } else {
        dispatchClick(document.getElementById('sb_character_tab_editor'));
    }
    requestAnimationFrame(syncInspectorState);
    return true;
}

function handleCharacterCardSelection(event) {
    if (!document.body.classList.contains('pwl-layout-active') || event.shiftKey) {
        return;
    }

    const characterPanel = document.getElementById('right-nav-panel');
    const charactersTab = characterPanel?.querySelector('[data-sb-character-tab="characters"]');
    const charactersViewActive = characterPanel?.dataset.menuType === 'characters'
        && charactersTab?.getAttribute('aria-selected') === 'true';
    if (!charactersViewActive) {
        return;
    }

    const card = event.target.closest('#rm_print_characters_block .character_select');
    const chid = Number(card?.dataset.chid);
    if (!card || !Number.isFinite(chid)) {
        return;
    }

    window.clearTimeout(pendingCharacterEditor?.timeoutId);
    pendingCharacterEditor = {
        chid,
        timeoutId: window.setTimeout(() => {
            openPendingCharacterEditor();
            pendingCharacterEditor = null;
        }, 2000),
    };

    window.setTimeout(openPendingCharacterEditor);
}

function isToolActive(tool, drawer) {
    if (!isDrawerOpen(drawer)) {
        return false;
    }

    const tab = getToolTab(tool, drawer);
    return !tab || tab.classList.contains('is-active') || tab.getAttribute('aria-selected') === 'true';
}

function isDrawerOpen(drawer) {
    return drawer?.classList.contains('openDrawer')
        || drawer?.classList.contains('open')
        || drawer?.classList.contains('pinnedOpen');
}

function setImportantStyle(element, property, value) {
    if (element.style.getPropertyValue(property) === value && element.style.getPropertyPriority(property) === 'important') {
        return;
    }

    element.style.setProperty(property, value, 'important');
}

function enforceInspectorGeometry(drawer) {
    if (!document.body.classList.contains('pwl-layout-active')) {
        return;
    }

    setImportantStyle(drawer, 'position', 'fixed');
    setImportantStyle(drawer, 'top', 'var(--pwl-gap)');
    setImportantStyle(drawer, 'right', 'calc(var(--pwl-action-width) + (var(--pwl-gap) * 2))');
    setImportantStyle(drawer, 'bottom', 'var(--pwl-gap)');
    setImportantStyle(drawer, 'left', 'auto');
    setImportantStyle(drawer, 'width', 'var(--pwl-inspector-width)');
    setImportantStyle(drawer, 'min-width', 'var(--pwl-inspector-width)');
    setImportantStyle(drawer, 'max-width', 'var(--pwl-inspector-width)');
    setImportantStyle(drawer, 'height', 'auto');
    setImportantStyle(drawer, 'max-height', 'none');
    setImportantStyle(drawer, 'transform', 'none');
    drawer.dataset.pwlGeometry = 'true';
}

function clearInspectorGeometry() {
    document.querySelectorAll('[data-pwl-geometry="true"]').forEach(drawer => {
        for (const property of ['position', 'top', 'right', 'bottom', 'left', 'width', 'min-width', 'max-width', 'height', 'max-height', 'transform']) {
            drawer.style.removeProperty(property);
        }
        delete drawer.dataset.pwlGeometry;
    });
}

function enforceWorkspaceGeometry() {
    const workspace = document.getElementById('sheld');
    if (!workspace || !document.body.classList.contains('pwl-layout-active')) {
        return;
    }

    setImportantStyle(workspace, 'left', '50%');
    setImportantStyle(workspace, 'right', 'auto');
    setImportantStyle(workspace, 'width', 'min(66.667vw, calc(100vw - var(--pwl-action-width) - (var(--pwl-gap) * 4)))');
    setImportantStyle(workspace, 'max-width', 'none');
    setImportantStyle(workspace, 'transform', 'translateX(-50%)');
    workspace.dataset.pwlWorkspaceGeometry = 'true';
}

function clearWorkspaceGeometry() {
    const workspace = document.querySelector('[data-pwl-workspace-geometry="true"]');
    if (!workspace) {
        return;
    }

    for (const property of ['left', 'right', 'width', 'max-width', 'transform']) {
        workspace.style.removeProperty(property);
    }
    delete workspace.dataset.pwlWorkspaceGeometry;
}

function openTool(tool, button) {
    const host = document.querySelector(tool.host);
    const drawer = getDrawerContent(tool);
    if (!host || !drawer) {
        toastr.warning(`${tool.label} is not available in the current view.`, 'Workspace Layout');
        return;
    }

    const closedDrawers = new Set();
    for (const otherTool of tools) {
        const otherDrawer = getDrawerContent(otherTool);
        if (!otherDrawer || otherDrawer === drawer || closedDrawers.has(otherDrawer)) {
            continue;
        }

        if (isDrawerOpen(otherDrawer)) {
            dispatchClick(document.querySelector(`${otherTool.host} > .drawer-toggle`));
            closedDrawers.add(otherDrawer);
        }
    }

    const isCharacterSection = tool.host === '#rightNavHolder';
    if (isCharacterSection) {
        cancelPendingCharacterEditor();
    }

    if (isCharacterSection && typeof window.SillyBunnyShell?.openTab === 'function') {
        window.SillyBunnyShell.openTab('characters', tool.id);
        document.querySelectorAll('.pwl-tool').forEach(item => item.classList.remove('is-active'));
        button.classList.add('is-active');
        setMenuOpen(false);
        requestAnimationFrame(() => requestAnimationFrame(syncInspectorState));
        return;
    }

    if (!isDrawerOpen(drawer)) {
        dispatchClick(host.querySelector(':scope > .drawer-toggle'));
    }

    dispatchClick(getToolTab(tool, drawer));
    document.querySelectorAll('.pwl-tool').forEach(item => item.classList.remove('is-active'));
    button.classList.add('is-active');
    setMenuOpen(false);
    requestAnimationFrame(syncInspectorState);
}

function syncInspectorState() {
    let activeTool = null;
    const processedDrawers = new Set();

    for (const tool of tools) {
        const drawer = getDrawerContent(tool);
        const isOpen = isDrawerOpen(drawer);
        if (drawer && !processedDrawers.has(drawer)) {
            drawer.classList.toggle('pwl-inspector-drawer', isOpen);
            if (isOpen) {
                enforceInspectorGeometry(drawer);
            }
            processedDrawers.add(drawer);
        }
        if (isToolActive(tool, drawer)) {
            activeTool = tool;
        }
    }

    document.body.classList.toggle('pwl-inspector-open', Boolean(activeTool));
    document.querySelectorAll('.pwl-tool').forEach(button => {
        button.classList.toggle('is-active', button.dataset.pwlTool === activeTool?.id);
    });

    const activeButton = activeTool
        ? document.querySelector(`.pwl-tool[data-pwl-tool="${activeTool.id}"]`)
        : null;
    activeButton?.closest('.pwl-tree-group')?.setAttribute('aria-expanded', 'true');
}

function watchDrawers() {
    drawerObserver?.disconnect();
    drawerObserver = new MutationObserver(syncInspectorState);
    const observedElements = new Set();

    tools.forEach(tool => {
        const drawer = getDrawerContent(tool);
        if (drawer && !observedElements.has(drawer)) {
            drawerObserver.observe(drawer, {
                attributes: true,
                attributeFilter: ['class', 'style'],
            });
            observedElements.add(drawer);
        }

        const tab = getToolTab(tool, drawer);
        if (tab && !observedElements.has(tab)) {
            drawerObserver.observe(tab, {
                attributes: true,
                attributeFilter: ['class', 'aria-selected'],
            });
            observedElements.add(tab);
        }
    });

    syncInspectorState();
}

function relocateGuidedActions() {
    if (!document.body.classList.contains('pwl-layout-active')) {
        return;
    }

    ensureBottomChatBarToggle();

    const target = document.getElementById('pwl-composer-actions');
    const actions = document.getElementById('gg-action-button-container');
    if (!target || !actions) {
        return;
    }

    if (actions.parentElement !== target) {
        target.append(actions);
    }

    relocateInputHistoryArrows();
    relocateImageGeneration();
    syncComposerActionsGeometry();
    document.body.classList.add('pwl-has-composer-actions');
}

function relocateInputHistoryArrows() {
    const rightSendForm = document.getElementById('rightSendForm');
    const arrows = document.querySelector('#gg-action-button-container .stih--arrows');
    if (!rightSendForm || !arrows) {
        return;
    }

    let mount = document.getElementById('pwl-input-history-arrows');
    if (!mount) {
        mount = document.createElement('div');
        mount.id = 'pwl-input-history-arrows';
        mount.setAttribute('aria-label', 'Input history navigation');
        rightSendForm.prepend(mount);
    } else if (mount.parentElement !== rightSendForm) {
        rightSendForm.prepend(mount);
    }

    if (arrows.parentElement !== mount) {
        mount.append(arrows);
    }
}

function relocateImageGeneration() {
    const actions = document.getElementById('gg-action-button-container');
    const regularButtons = document.querySelector('#gg-action-button-container .gg-regular-buttons-container');
    const simpleSend = document.getElementById('gg_simple_send_button');
    const imageGeneration = document.getElementById('qig-input-btn');
    if (!actions || !regularButtons || !simpleSend || !imageGeneration) {
        return;
    }

    let imageGenerationProxy = document.getElementById('pwl-qig-rail-button');
    if (!imageGenerationProxy) {
        imageGenerationProxy = document.createElement('button');
        imageGenerationProxy.id = 'pwl-qig-rail-button';
        imageGenerationProxy.type = 'button';
        imageGenerationProxy.className = 'gg-action-button menu_button menu_button_icon fa-solid fa-palette';
        imageGenerationProxy.title = imageGeneration.title;
        imageGenerationProxy.setAttribute('aria-label', imageGeneration.title || 'Generate Image');
        imageGenerationProxy.addEventListener('click', event => {
            event.preventDefault();
            document.getElementById('qig-input-btn')?.click();
        });
        imageGenerationProxy.addEventListener('contextmenu', event => {
            event.preventDefault();
            document.getElementById('qig-input-btn')?.dispatchEvent(new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                clientX: event.clientX,
                clientY: event.clientY,
                view: window,
            }));
        });
    }

    const chatHistory = actions.querySelector(':scope > .stih--buttons');
    if (!chatHistory) {
        return;
    }
    if (imageGenerationProxy.parentElement !== actions || imageGenerationProxy.nextElementSibling !== chatHistory) {
        actions.insertBefore(imageGenerationProxy, chatHistory);
    }

    if (simpleSend.parentElement !== regularButtons) {
        regularButtons.prepend(simpleSend);
    }
}

function syncComposerActionsGeometry() {
    if (!document.body.classList.contains('pwl-layout-active')) {
        return;
    }

    const workspace = document.getElementById('sheld');
    if (!workspace) {
        return;
    }

    const workspaceRect = workspace.getBoundingClientRect();
    const root = document.documentElement;
    root.style.setProperty('--pwl-menu-left', `${Math.max(4, Math.round(workspaceRect.left - 62))}px`);
    root.style.setProperty('--pwl-menu-top', `${Math.max(4, Math.round(workspaceRect.top))}px`);
    root.style.setProperty('--pwl-action-left', `${Math.round(workspaceRect.right + 8)}px`);
    root.style.setProperty('--pwl-action-bottom', `${Math.max(0, Math.round(window.innerHeight - workspaceRect.bottom))}px`);
}

function restoreGuidedActions() {
    const actions = document.getElementById('gg-action-button-container');
    const sendForm = document.getElementById('send_form');
    const nonQrFormItems = document.getElementById('nonQRFormItems');
    if (!actions || !sendForm || actions.parentElement === sendForm) {
        return;
    }

    nonQrFormItems?.insertAdjacentElement('afterend', actions);

    const inputHistoryButtons = actions.querySelector('.stih--buttons');
    const arrows = document.querySelector('#pwl-input-history-arrows .stih--arrows');
    if (inputHistoryButtons && arrows) {
        inputHistoryButtons.prepend(arrows);
    }
    document.getElementById('pwl-input-history-arrows')?.remove();

    const regularButtons = actions.querySelector('.gg-regular-buttons-container');
    const simpleSend = document.getElementById('gg_simple_send_button');
    const imageGeneration = document.getElementById('qig-input-btn');
    const rightSendForm = document.getElementById('rightSendForm');
    const sendButton = document.getElementById('send_but');
    document.getElementById('pwl-qig-rail-button')?.remove();
    if (regularButtons && simpleSend) {
        regularButtons.prepend(simpleSend);
    }
    if (rightSendForm && imageGeneration) {
        rightSendForm.insertBefore(imageGeneration, sendButton);
    }
}

function watchGuidedActions() {
    relocateGuidedActions();
    guidedObserver?.disconnect();
    guidedObserver = new MutationObserver(relocateGuidedActions);
    guidedObserver.observe(document.body, { childList: true, subtree: true });
}

function applySettings() {
    const settings = getSettings();
    const wideEnough = window.innerWidth >= Number(settings.minimumWidth);
    const active = Boolean(enabledForSession && wideEnough);
    const root = document.documentElement;

    document.body.classList.toggle('pwl-layout-active', active);
    root.style.setProperty(
        '--pwl-inspector-width',
        `min(${settings.inspectorWidthPercent}vw, calc(100vw - var(--pwl-action-width) - (var(--pwl-gap) * 3)))`,
    );
    setGuidedRailCollapsed(Boolean(settings.guidedRailCollapsed));

    if (active) {
        ensureBottomChatBarToggle();
        enforceWorkspaceGeometry();
        relocateGuidedActions();
        syncInspectorState();
    } else {
        document.getElementById('pwl-bottom-chat-bar-toggle')?.remove();
        document.getElementById('sb-bottom-chat-bar')?.classList.remove('pwl-bottom-chat-bar-collapsed');
        restoreGuidedActions();
        clearInspectorGeometry();
        clearWorkspaceGeometry();
    }

    if (!active) {
        setMenuOpen(false);
    }
}

function handleResize() {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
        applySettings();
        syncComposerActionsGeometry();
    });
}

function injectSettings() {
    const container = document.getElementById('extensions_settings');
    if (!container || document.getElementById(SETTINGS_ID)) {
        return;
    }

    const settings = getSettings();
    const panel = document.createElement('div');
    panel.id = SETTINGS_ID;
    panel.className = 'extension_container';
    panel.innerHTML = `
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>ADHDBunny UI</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <label class="checkbox_label">
                    <input id="pwl-enabled" type="checkbox">
                    <span>Enable desktop workspace layout</span>
                </label>
                <small id="pwl-refresh-required" role="status" hidden>
                    Refresh the page to apply this change.
                </small>
                <label class="pwl-setting-row" for="pwl-minimum-width">
                    <span>Minimum viewport width</span>
                    <input id="pwl-minimum-width" class="text_pole" type="number" min="900" max="2200" step="20">
                </label>
                <label class="pwl-setting-row" for="pwl-inspector-width-percent">
                    <span>Inspector width (%)</span>
                    <input id="pwl-inspector-width-percent" class="text_pole" type="number" min="35" max="70" step="1">
                </label>
                <small>The stock SillyBunny layout remains active below the minimum width.</small>
            </div>
        </div>
    `;
    container.append(panel);

    const enabled = panel.querySelector('#pwl-enabled');
    const refreshRequired = panel.querySelector('#pwl-refresh-required');
    const minimumWidth = panel.querySelector('#pwl-minimum-width');
    const inspectorWidthPercent = panel.querySelector('#pwl-inspector-width-percent');
    enabled.checked = settings.enabled;
    refreshRequired.hidden = enabled.checked === enabledForSession;
    minimumWidth.value = settings.minimumWidth;
    inspectorWidthPercent.value = settings.inspectorWidthPercent;

    enabled.addEventListener('change', () => {
        settings.enabled = enabled.checked;
        refreshRequired.hidden = enabled.checked === enabledForSession;
        saveSettingsDebounced();
    });
    minimumWidth.addEventListener('change', () => {
        settings.minimumWidth = Math.max(900, Number(minimumWidth.value) || defaults.minimumWidth);
        minimumWidth.value = settings.minimumWidth;
        saveSettingsDebounced();
        applySettings();
    });
    inspectorWidthPercent.addEventListener('change', () => {
        settings.inspectorWidthPercent = Math.min(
            70,
            Math.max(35, Number(inspectorWidthPercent.value) || defaults.inspectorWidthPercent),
        );
        inspectorWidthPercent.value = settings.inspectorWidthPercent;
        saveSettingsDebounced();
        applySettings();
    });
}

function init() {
    const settings = getSettings();
    enabledForSession ??= firstInstallPending ? false : Boolean(settings.enabled);
    buildWorkspaceControls();
    injectSettings();
    watchDrawers();
    watchGuidedActions();
    applySettings();

    if (firstInstallPending && !firstInstallNoticeShown) {
        firstInstallNoticeShown = true;
        toastr.info(
            'Refresh SillyBunny to enable the ADHDBunny UI layout.',
            'ADHDBunny UI installed',
            {
                closeButton: true,
                extendedTimeOut: 0,
                preventDuplicates: true,
                timeOut: 0,
            },
        );
    }

    if (!initialized) {
        initialized = true;
        document.addEventListener('click', handleCharacterCardSelection);
        eventSource.on(event_types.CHAT_CHANGED, openPendingCharacterEditor);
        eventSource.on(event_types.CHAT_LOADED, openPendingCharacterEditor);
        window.addEventListener('resize', handleResize, { passive: true });
    }
}

eventSource.on(event_types.APP_READY, init);

if (document.readyState === 'complete') {
    init();
}
