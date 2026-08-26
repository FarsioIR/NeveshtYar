(() => {
    'use strict';

    const catalog = Object.freeze({
        fa: Object.freeze({
            'common.productName': 'نوشت‌یار',
            'common.productEnglishName': 'NeveshtYar',
            'common.themeToLight': 'فعال کردن حالت روشن',
            'common.themeToDark': 'فعال کردن حالت تاریک',
            'common.languageSwitcher': 'زبان رابط کاربری',
            'popup.documentTitle': 'نوشت‌یار',
            'popup.tagline': 'اصلاح هوشمند تایپ فارسی و انگلیسی در سراسر وب',
            'popup.assistantStatus': 'وضعیت دستیار',
            'popup.assistantToggleLabel': 'فعال یا غیرفعال کردن دستیار',
            'popup.browserSupportLabel': 'مرورگرهای پشتیبانی‌شده',
            'popup.detecting': 'در حال شناسایی…',
            'popup.changeStatus': 'تغییر وضعیت',
            'popup.siteActive': 'فعال در این سایت',
            'popup.siteDisabled': 'غیرفعال در این سایت',
            'popup.siteToggleLabel': 'فعال یا غیرفعال کردن دستیار در سایت فعلی',
            'popup.love': 'عشق',
            'popup.textFieldCorrections': 'اصلاح در فیلدهای متنی',
            'popup.statusDisabledAll': 'غیرفعال در همه سایت‌ها',
            'popup.statusSiteExcluded': 'دستیار فعال است؛ این سایت مستثناست',
            'popup.statusActiveWeb': 'فعال در سراسر وب',
            'popup.currentPage': 'صفحه فعلی',
            'popup.browserInternal': 'صفحه مرورگر / داخلی',
            'popup.unavailable': 'در دسترس نیست',
            'popup.enableOnSite': 'فعال در این سایت',
            'popup.disableOnSite': 'غیرفعال در این سایت',
            'popup.desktopSupport': 'پشتیبانی دسکتاپ',
            'popup.sixBrowsers': 'یک تجربه، شش مرورگر',
            'popup.tested': 'تست‌شده',
            'popup.quickTest': 'تست سریع',
            'popup.checkHere': 'متن را همین‌جا بررسی کن',
            'popup.inputLabel': 'متن ورودی',
            'popup.inputPlaceholder': 'مثلاً jivhk یا یک عبارت فارسی را وارد کنید…',
            'popup.correctedLabel': 'متن اصلاح‌شده',
            'popup.confirmCorrection': 'تأیید و ذخیره اصلاح',
            'popup.manualEdit': 'ویرایش دستی',
            'popup.saveEdit': 'ذخیره ویرایش',
            'popup.searchGoogle': 'جست‌وجوی بیشتر در گوگل',
            'popup.quickActions': 'دسترسی سریع',
            'popup.manageSites': 'مدیریت سایت‌ها',
            'popup.settings': 'تنظیمات',
            'popup.reportIssue': 'گزارش مشکل',
            'popup.footerMadeWith': 'ساخته شده با',
            'popup.footerFor': 'برای ایرانیان توسط',
            'popup.authorName': 'امیر متفکر',
            'popup.githubLabel': 'GitHub پروژه نوشت‌یار',
            'popup.githubTitle': 'GitHub پروژه',
            'popup.loading': 'در حال پردازش…',
            'popup.noResult': 'نتیجه‌ای برای «{term}» یافت نشد.',
            'popup.disambiguation': '«{title}» چند معنی دارد:',
            'popup.correctionSaved': 'اصلاح شما در دیکشنری ذخیره شد.',
            'popup.correctionSaveFailed': 'ذخیره اصلاح انجام نشد.',
            'options.documentTitle': 'تنظیمات نوشت‌یار',
            'options.title': 'تنظیمات',
            'options.subtitle': 'واژه‌های شخصی و اصلاحات ذخیره‌شده را مدیریت کنید.',
            'options.managementSections': 'بخش‌های مدیریت',
            'options.settings': 'تنظیمات',
            'options.manageSites': 'مدیریت سایت‌ها',
            'options.smartAutoTitle': 'اصلاح خودکار هوشمند',
            'options.smartAutoDescription': 'در اطمینان بالا، اصلاح به‌صورت خودکار اعمال می‌شود. موارد متوسط همچنان به شکل پیشنهاد باقی می‌مانند و بعد از اصلاح خودکار، گزینه «برگردان» نمایش داده می‌شود.',
            'options.smartAutoLabel': 'فعال بودن Smart Auto',
            'options.dictionaryTitle': 'دیکشنری شخصی',
            'options.dictionaryDescription': 'هر اصلاح را در یک خط و به فرم «عبارت اشتباه = عبارت درست» وارد کنید.',
            'options.dictionaryLabel': 'دیکشنری شخصی',
            'options.saveDictionary': 'ذخیره دیکشنری',
            'options.saveFailed': 'ذخیره انجام نشد: {message}',
            'options.smartAutoEnabled': 'Smart Auto فعال شد.',
            'options.smartAutoDisabled': 'Smart Auto غیرفعال شد.',
            'options.dictionarySaved': 'دیکشنری ذخیره شد.',
            'sites.documentTitle': 'مدیریت سایت‌ها — نوشت‌یار',
            'sites.title': 'مدیریت سایت‌ها',
            'sites.subtitle': 'دامنه‌هایی را که نمی‌خواهید دستیار در آن‌ها فعال باشد مدیریت کنید.',
            'sites.excludedTitle': 'سایت‌های مستثنا',
            'sites.excludedDescription': 'در هر خط یک دامنه وارد کنید؛ برای مثال example.com. زیر‌دامنه‌های آن هم مستثنا می‌شوند.',
            'sites.disabledHostsLabel': 'دامنه‌های غیرفعال',
            'sites.save': 'ذخیره سایت‌ها',
            'sites.saved': 'فهرست سایت‌های مستثنا ذخیره شد.',
            'inline.undoPrefix': 'برگردان:',
            'inline.correctionPrefix': 'اصلاح:',
            'inline.replaceWith': 'جایگزین با {text}'
        }),
        en: Object.freeze({
            'common.productName': 'NeveshtYar',
            'common.productEnglishName': 'NeveshtYar',
            'common.themeToLight': 'Switch to light mode',
            'common.themeToDark': 'Switch to dark mode',
            'common.languageSwitcher': 'Interface language',
            'popup.documentTitle': 'NeveshtYar',
            'popup.tagline': 'Smart Persian & English typing correction across the web',
            'popup.assistantStatus': 'Assistant status',
            'popup.assistantToggleLabel': 'Enable or disable the assistant',
            'popup.browserSupportLabel': 'Supported browsers',
            'popup.detecting': 'Detecting…',
            'popup.changeStatus': 'Change status',
            'popup.siteActive': 'Active on this site',
            'popup.siteDisabled': 'Disabled on this site',
            'popup.siteToggleLabel': 'Enable or disable the assistant on the current site',
            'popup.love': 'love',
            'popup.textFieldCorrections': 'Text field corrections',
            'popup.statusDisabledAll': 'Disabled on all sites',
            'popup.statusSiteExcluded': 'Assistant is on; this site is excluded',
            'popup.statusActiveWeb': 'Active across the web',
            'popup.currentPage': 'Current page',
            'popup.browserInternal': 'Browser / internal page',
            'popup.unavailable': 'Unavailable',
            'popup.enableOnSite': 'Enable on this site',
            'popup.disableOnSite': 'Disable on this site',
            'popup.desktopSupport': 'Desktop support',
            'popup.sixBrowsers': 'One experience, six browsers',
            'popup.tested': 'Tested',
            'popup.quickTest': 'Quick test',
            'popup.checkHere': 'Check your text right here',
            'popup.inputLabel': 'Input text',
            'popup.inputPlaceholder': 'Try jivhk or enter a Persian or English phrase…',
            'popup.correctedLabel': 'Corrected text',
            'popup.confirmCorrection': 'Confirm and save correction',
            'popup.manualEdit': 'Edit manually',
            'popup.saveEdit': 'Save edit',
            'popup.searchGoogle': 'Search more on Google',
            'popup.quickActions': 'Quick actions',
            'popup.manageSites': 'Site management',
            'popup.settings': 'Settings',
            'popup.reportIssue': 'Report an issue',
            'popup.footerMadeWith': 'Made with',
            'popup.footerFor': 'for Persian speakers by',
            'popup.authorName': 'Amir Motefaker',
            'popup.githubLabel': 'NeveshtYar project on GitHub',
            'popup.githubTitle': 'Project on GitHub',
            'popup.loading': 'Processing…',
            'popup.noResult': 'No result was found for “{term}”.',
            'popup.disambiguation': '“{title}” has multiple meanings:',
            'popup.correctionSaved': 'Your correction was saved to the personal dictionary.',
            'popup.correctionSaveFailed': 'The correction could not be saved.',
            'options.documentTitle': 'NeveshtYar Settings',
            'options.title': 'Settings',
            'options.subtitle': 'Manage your personal words and saved corrections.',
            'options.managementSections': 'Management sections',
            'options.settings': 'Settings',
            'options.manageSites': 'Site management',
            'options.smartAutoTitle': 'Smart Auto correction',
            'options.smartAutoDescription': 'High-confidence corrections are applied automatically. Medium-confidence cases remain suggestions, and an Undo action appears after an automatic correction.',
            'options.smartAutoLabel': 'Enable Smart Auto',
            'options.dictionaryTitle': 'Personal dictionary',
            'options.dictionaryDescription': 'Enter one correction per line as “wrong phrase = correct phrase”.',
            'options.dictionaryLabel': 'Personal dictionary',
            'options.saveDictionary': 'Save dictionary',
            'options.saveFailed': 'Save failed: {message}',
            'options.smartAutoEnabled': 'Smart Auto enabled.',
            'options.smartAutoDisabled': 'Smart Auto disabled.',
            'options.dictionarySaved': 'Dictionary saved.',
            'sites.documentTitle': 'Site Management — NeveshtYar',
            'sites.title': 'Site management',
            'sites.subtitle': 'Manage domains where you do not want the assistant to run.',
            'sites.excludedTitle': 'Excluded sites',
            'sites.excludedDescription': 'Enter one domain per line, for example example.com. Its subdomains will also be excluded.',
            'sites.disabledHostsLabel': 'Disabled domains',
            'sites.save': 'Save sites',
            'sites.saved': 'Excluded-site list saved.',
            'inline.undoPrefix': 'Undo:',
            'inline.correctionPrefix': 'Correction:',
            'inline.replaceWith': 'Replace with {text}'
        })
    });

    function normalizeLocale(value) {
        return String(value || '').toLowerCase() === 'en' ? 'en' : 'fa';
    }

    function interpolate(template, variables = {}) {
        return String(template ?? '').replace(/\{([A-Za-z0-9_]+)\}/g, (_match, key) => {
            return Object.prototype.hasOwnProperty.call(variables, key)
                ? String(variables[key])
                : `{${key}}`;
        });
    }

    function t(key, locale = 'fa', variables = {}) {
        const resolvedLocale = normalizeLocale(locale);
        const fallback = catalog.fa[key] ?? key;
        const value = catalog[resolvedLocale][key] ?? fallback;
        return interpolate(value, variables);
    }

    function applyDocument(locale, root = document) {
        if (!root) return normalizeLocale(locale);

        const resolvedLocale = normalizeLocale(locale);
        const documentNode = root.nodeType === 9
            ? root
            : root.ownerDocument || document;
        const documentElement = documentNode.documentElement;

        if (documentElement) {
            documentElement.lang = resolvedLocale;
            documentElement.dir = resolvedLocale === 'fa' ? 'rtl' : 'ltr';
            documentElement.dataset.locale = resolvedLocale;
        }

        const scope = root.querySelectorAll ? root : documentNode;

        scope.querySelectorAll('[data-i18n]').forEach((element) => {
            element.textContent = t(element.dataset.i18n, resolvedLocale);
        });

        scope.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
            element.setAttribute(
                'placeholder',
                t(element.dataset.i18nPlaceholder, resolvedLocale)
            );
        });

        scope.querySelectorAll('[data-i18n-title]').forEach((element) => {
            element.setAttribute(
                'title',
                t(element.dataset.i18nTitle, resolvedLocale)
            );
        });

        scope.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
            element.setAttribute(
                'aria-label',
                t(element.dataset.i18nAriaLabel, resolvedLocale)
            );
        });

        return resolvedLocale;
    }

    globalThis.FSA_UI_I18N = Object.freeze({
        catalog,
        normalizeLocale,
        t,
        applyDocument
    });
})();
