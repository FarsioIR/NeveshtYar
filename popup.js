document.addEventListener('DOMContentLoaded', function() {
    const i18n = globalThis.FSA_UI_I18N;

    if (!i18n) {
        throw new Error('FSA_UI_I18N is required before popup.js');
    }

    const inputText = document.getElementById('inputText');
    const correctedTextBox = document.getElementById('correctedTextBox');
    const settingsLink = document.getElementById('settingsLink');
    const manageSitesLink = document.getElementById('manageSitesLink');
    const reportIssueLink = document.getElementById('reportIssueLink');
    const versionDisplay = document.getElementById('version-display');
    const resultContainer = document.getElementById('resultContainer');
    const feedbackContainer = document.getElementById('feedbackContainer');
    const confirmButton = document.getElementById('confirmButton');
    const rejectButton = document.getElementById('rejectButton');
    const saveManualCorrectionButton = document.getElementById('saveManualCorrectionButton');
    const saveConfirmation = document.getElementById('saveConfirmation');
    const themeToggle = document.getElementById('themeToggle');
    const languageFa = document.getElementById('languageFa');
    const languageEn = document.getElementById('languageEn');
    const assistantToggle = document.getElementById('assistantToggle');
    const assistantStatusText = document.getElementById('assistantStatusText');
    const currentSiteHost = document.getElementById('currentSiteHost');
    const currentSiteFavicon = document.getElementById('currentSiteFavicon');
    const currentSiteFallback = document.getElementById('currentSiteFallback');
    const siteToggle = document.getElementById('siteToggle');
    const siteToggleText = document.getElementById('siteToggleText');

    let debounceTimer;
    const DEBOUNCE_DELAY = 500;
    let customDictionary = {};
    let assistantEnabled = true;
    let disabledHosts = [];
    let activeHost = '';
    let activeFaviconUrl = '';
    let uiTheme = 'light';
    let uiLanguage = 'fa';

    function t(key, variables = {}) {
        return i18n.t(key, uiLanguage, variables);
    }

    function storageGet(keys) {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.get(keys, (data) => {
                const runtimeError = chrome.runtime.lastError;

                if (runtimeError) {
                    reject(new Error(runtimeError.message));
                    return;
                }

                resolve(data || {});
            });
        });
    }

    function storageSet(values) {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.set(values, () => {
                const runtimeError = chrome.runtime.lastError;

                if (runtimeError) {
                    reject(new Error(runtimeError.message));
                    return;
                }

                resolve();
            });
        });
    }

    function queryCurrentTab() {
        return new Promise((resolve) => {
            if (!chrome.tabs || typeof chrome.tabs.query !== 'function') {
                resolve(null);
                return;
            }

            chrome.tabs.query(
                { active: true, currentWindow: true },
                (tabs) => resolve(Array.isArray(tabs) ? tabs[0] || null : null)
            );
        });
    }

    function normalizeHostname(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/^\.+|\.+$/g, '');
    }

    function hostnameFromUrl(url) {
        try {
            const parsed = new URL(url);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:'
                ? normalizeHostname(parsed.hostname)
                : '';
        } catch (_error) {
            return '';
        }
    }

    function normalizeFaviconUrl(value) {
        const source = String(value || '').trim();

        if (!source) return '';

        try {
            const parsed = new URL(source);

            return [
                'http:',
                'https:',
                'data:',
                'chrome:',
                'chrome-extension:'
            ].includes(parsed.protocol)
                ? source
                : '';
        } catch (_error) {
            return '';
        }
    }

    function renderSiteFavicon() {
        const showFallback = () => {
            currentSiteFavicon.hidden = true;
            currentSiteFavicon.removeAttribute('src');
            currentSiteFallback.hidden = false;
        };

        if (!activeHost || !activeFaviconUrl) {
            showFallback();
            return;
        }

        currentSiteFavicon.onload = () => {
            currentSiteFallback.hidden = true;
            currentSiteFavicon.hidden = false;
        };

        currentSiteFavicon.onerror = showFallback;
        currentSiteFavicon.src = activeFaviconUrl;
    }

    function isHostDisabled(hostname) {
        const host = normalizeHostname(hostname);

        if (!host) return false;

        return disabledHosts.some((entry) => {
            const blocked = normalizeHostname(entry);
            return blocked && (
                host === blocked ||
                host.endsWith(`.${blocked}`)
            );
        });
    }

    function resolveInitialTheme(value) {
        if (value === 'dark' || value === 'light') return value;

        return window.matchMedia?.('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';
    }

    function applyTheme(theme) {
        uiTheme = theme === 'dark' ? 'dark' : 'light';
        document.documentElement.dataset.theme = uiTheme;
        const themeAction = uiTheme === 'dark'
            ? t('common.themeToLight')
            : t('common.themeToDark');

        themeToggle.setAttribute('aria-label', themeAction);
        themeToggle.setAttribute('title', themeAction);
    }

    function renderLanguageSwitch() {
        const isFa = uiLanguage === 'fa';
        languageFa.classList.toggle('is-active', isFa);
        languageEn.classList.toggle('is-active', !isFa);
        languageFa.setAttribute('aria-pressed', String(isFa));
        languageEn.setAttribute('aria-pressed', String(!isFa));
    }

    function applyLanguage(language) {
        uiLanguage = i18n.applyDocument(language, document);
        renderLanguageSwitch();
        applyTheme(uiTheme);
        renderAssistantState();
    }

    function renderAssistantState() {
        assistantToggle.checked = assistantEnabled;

        if (!assistantEnabled) {
            assistantStatusText.textContent = t('popup.statusDisabledAll');
            assistantStatusText.style.color = 'var(--muted)';
        } else if (activeHost && isHostDisabled(activeHost)) {
            assistantStatusText.textContent = t('popup.statusSiteExcluded');
            assistantStatusText.style.color = 'var(--muted)';
        } else {
            assistantStatusText.textContent = t('popup.statusActiveWeb');
            assistantStatusText.style.color = 'var(--success)';
        }

        renderSiteFavicon();

        if (!activeHost) {
            currentSiteHost.textContent = t('popup.browserInternal');
            siteToggle.checked = false;
            siteToggle.disabled = true;
            siteToggleText.textContent = t('popup.unavailable');
            return;
        }

        const siteEnabled = !isHostDisabled(activeHost);

        currentSiteHost.textContent = activeHost;
        siteToggle.checked = siteEnabled;
        siteToggle.disabled = false;
        siteToggleText.textContent = siteEnabled
            ? t('popup.siteActive')
            : t('popup.siteDisabled');
    }

    async function setUiLanguage(nextLanguage) {
        const previous = uiLanguage;
        applyLanguage(nextLanguage);

        try {
            await storageSet({ uiLanguage });
        } catch (error) {
            console.error('Language save error:', error);
            applyLanguage(previous);
        }
    }

    async function init() {
        const version = chrome.runtime.getManifest().version;
        versionDisplay.textContent = `v${version}`;

        try {
            const data = await storageGet([
                'customDictionary',
                'assistantEnabled',
                'disabledHosts',
                'uiTheme',
                'uiLanguage'
            ]);

            customDictionary = data.customDictionary || {};
            assistantEnabled = data.assistantEnabled !== false;
            disabledHosts = Array.isArray(data.disabledHosts)
                ? data.disabledHosts.map(normalizeHostname).filter(Boolean)
                : [];
            uiTheme = resolveInitialTheme(data.uiTheme);
            uiLanguage = i18n.normalizeLocale(data.uiLanguage);

            const activeTab = await queryCurrentTab();
            activeHost = hostnameFromUrl(activeTab?.url || '');
            activeFaviconUrl = normalizeFaviconUrl(
                activeTab?.favIconUrl || ''
            );

            applyLanguage(uiLanguage);
            applyTheme(uiTheme);
        } catch (error) {
            console.error('Popup initialization error:', error);
            uiLanguage = 'fa';
            uiTheme = resolveInitialTheme(null);
            applyLanguage(uiLanguage);
            applyTheme(uiTheme);
        }

        inputText.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(handleRealtimeUpdate, DEBOUNCE_DELAY);
        });

        settingsLink.addEventListener('click', () => {
            chrome.runtime.openOptionsPage();
        });

        manageSitesLink.addEventListener('click', () => {
            const url = chrome.runtime.getURL('site_management.html');
            chrome.tabs.create({ url });
        });

        reportIssueLink.addEventListener('click', () => {
            const url = 'https://github.com/FarsioIR/NeveshtYar/issues/new';
            chrome.tabs.create({ url });
        });

        languageFa.addEventListener('click', () => {
            void setUiLanguage('fa');
        });

        languageEn.addEventListener('click', () => {
            void setUiLanguage('en');
        });

        themeToggle.addEventListener('click', async () => {
            const nextTheme = uiTheme === 'dark' ? 'light' : 'dark';
            applyTheme(nextTheme);

            try {
                await storageSet({ uiTheme: nextTheme });
            } catch (error) {
                console.error('Theme save error:', error);
            }
        });

        assistantToggle.addEventListener('change', async () => {
            const previous = assistantEnabled;
            assistantEnabled = assistantToggle.checked;
            renderAssistantState();

            try {
                await storageSet({ assistantEnabled });
            } catch (error) {
                assistantEnabled = previous;
                renderAssistantState();
                console.error('Assistant state save error:', error);
            }
        });

        siteToggle.addEventListener('change', async () => {
            if (!activeHost) return;

            const previous = [...disabledHosts];
            const shouldEnable = siteToggle.checked;

            if (shouldEnable) {
                disabledHosts = disabledHosts.filter((entry) => {
                    const blocked = normalizeHostname(entry);
                    return !(
                        activeHost === blocked ||
                        activeHost.endsWith(`.${blocked}`)
                    );
                });
            } else {
                disabledHosts = Array.from(
                    new Set([...disabledHosts, activeHost])
                ).sort();
            }

            renderAssistantState();

            try {
                await storageSet({ disabledHosts });
            } catch (error) {
                disabledHosts = previous;
                renderAssistantState();
                console.error('Site state save error:', error);
            }
        });

        confirmButton.addEventListener('click', saveCurrentCorrection);
        rejectButton.addEventListener('click', enableManualCorrection);
        saveManualCorrectionButton.addEventListener('click', saveCurrentCorrection);
    }

    init();

    async function saveCurrentCorrection() {
        const originalText = inputText.value.trim().toLowerCase();
        const correctedText = correctedTextBox.value.trim();

        if (!originalText || !correctedText) return;

        customDictionary[originalText] = correctedText;

        try {
            await storageSet({ customDictionary });
            showConfirmation(t('popup.correctionSaved'));
            feedbackContainer.style.display = 'none';
            saveManualCorrectionButton.style.display = 'none';
            correctedTextBox.readOnly = true;
        } catch (error) {
            console.error('Dictionary save error:', error);
            showConfirmation(t('popup.correctionSaveFailed'));
        }
    }

    function enableManualCorrection() {
        correctedTextBox.readOnly = false;
        correctedTextBox.focus();
        feedbackContainer.style.display = 'none';
        saveManualCorrectionButton.style.display = 'block';
    }

    function showConfirmation(message) {
        saveConfirmation.textContent = message;
        saveConfirmation.style.opacity = 1;
        setTimeout(() => {
            saveConfirmation.style.opacity = 0;
        }, 2500);
    }

    const handleRealtimeUpdate = () => {
        const query = inputText.value.trim();

        resultContainer.style.display = 'none';
        correctedTextBox.value = '';
        correctedTextBox.readOnly = true;
        feedbackContainer.style.display = 'none';
        saveManualCorrectionButton.style.display = 'none';

        if (!query) {
            return;
        }

        try {
            const correctedText = smart_farsi_converter(query, customDictionary);

            if (query.toLowerCase() !== correctedText.toLowerCase()) {
                correctedTextBox.value = correctedText;
                resultContainer.style.display = 'block';
                feedbackContainer.style.display = 'flex';
            }
        } catch (error) {
            console.error('Realtime correction error:', error);
        }
    };

});
