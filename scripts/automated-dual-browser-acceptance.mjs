import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { Builder, By, Key, until } from 'selenium-webdriver';
import firefox from 'selenium-webdriver/firefox.js';

const scriptDirectory =
  path.dirname(
    fileURLToPath(import.meta.url)
  );

const root =
  path.resolve(
    scriptDirectory,
    '..'
  );

const distRoot =
  path.join(
    root,
    'dist'
  );

const chromeRoot =
  path.join(
    distRoot,
    'chromium'
  );

const firefoxRoot =
  path.join(
    distRoot,
    'firefox'
  );

const artifactRoot =
  path.resolve(
    process.env
      .FSA_BROWSER_ACCEPTANCE_ARTIFACT_DIR ||
    path.join(
      root,
      'artifacts',
      'browser-acceptance'
    )
  );

const chromeExecutable =
  String(
    process.env
      .FSA_CHROME_EXECUTABLE ||
    ''
  ).trim();

if (!chromeExecutable) {
  throw new Error(
    'FSA_CHROME_EXECUTABLE is required.'
  );
}

const EXPECTED_VERSION = '4.9.2';

const EXPECTED_FIREFOX_ID =
  '@farsi-smart-assistant.amirmotefaker';

const APPROVED_TOOLBAR_SHA256 = Object.freeze({
  'assets/brand/toolbar/fa-16.png':
    '4F9027870A401CE806BD8AE352037F232BBF9D08DEEB78C440B582AF5384B4AA',
  'assets/brand/toolbar/fa-32.png':
    '4AF722D3E3A8DA413EA203BFC2C5A7D9ACA1C203B75A3C30B77E3EB97EAA3B50',
  'assets/brand/toolbar/en-16.png':
    'D32E27D3ED0E7ACA020B28F3B84922BC16A04A92B7764D186B485F62279F8A1B',
  'assets/brand/toolbar/en-32.png':
    '47580D00AA7E20C698E0020C412E45445894A3C7AE5587ED4EB4C82F3DDFE26D'
});

const checks = [
  'Exact browser package loads at version 4.9.2',
  'Approved toolbar glyph asset contract is preserved',
  'Popup visual/source contract is preserved',
  'FA|EN + Light|Dark persistence contract is preserved',
  'Current-site enable/disable contract is preserved',
  'Persian spelling: دانشکاه→دانشگاه',
  'English spelling: tehcnology→technology and recieve→receive',
  'Finglish representative coverage remains healthy',
  'Wrong-layout EN→FA: physical sghl→سلام in English page context',
  'Wrong-layout FA→EN: physical اثممخ→hello',
  'Smart Auto + Undo safety contract remains healthy',
  'Inline correction works in input and textarea',
  'Inline correction works in contenteditable and dynamic input',
  'Store-safe surface/runtime contract remains clean',
  'Final browser/runtime sweep remains healthy'
];

const runtimeFiles = [
  'language_profiles.js',
  'keyboard_layout.js',
  'context_intent.js',
  'normalization_intent.js',
  'lexical_priors.js',
  'finglish_source_model.js',
  'transliteration_intent.js',
  'spell_correction.js',
  'universal_correction.js',
  'logic.js',
  'smart_auto_intent.js'
];

function record(
  number,
  pass,
  evidence,
  detail = ''
) {
  return {
    number,
    name: checks[number - 1],
    status: pass ? 'PASS' : 'FAIL',
    evidence,
    detail
  };
}

async function sha256(filePath) {
  const bytes =
    await fs.readFile(filePath);

  return crypto
    .createHash('sha256')
    .update(bytes)
    .digest('hex')
    .toUpperCase();
}

async function readJson(filePath) {
  return JSON.parse(
    await fs.readFile(
      filePath,
      'utf8'
    )
  );
}

async function loadEngine(packageRoot) {
  const source =
    (
      await Promise.all(
        runtimeFiles.map(
          (relative) =>
            fs.readFile(
              path.join(
                packageRoot,
                relative
              ),
              'utf8'
            )
        )
      )
    ).join('\n');

  const context =
    vm.createContext({
      console
    });

  vm.runInContext(
    `${source}
;globalThis.__fsaAcceptance = {
  smart_farsi_converter,
  analyzeFsaSmartAutoIntent
};`,
    context
  );

  return context.__fsaAcceptance;
}

function contexts() {
  return {
    fa: {
      beforeText:
        'این یک آزمایش تایپ فارسی است ',
      afterText:
        ' و ادامه متن فارسی است',
      fieldLanguage: 'fa',
      pageLanguage: 'fa',
      direction: 'rtl',
      browserLanguage: 'fa-IR',
      keyboardEvidence: {
        latinKeys: 4,
        persianKeys: 0,
        physicalAlphaKeys: 4
      }
    },

    googleEn: {
      beforeText: '',
      afterText: ' ',
      fieldLanguage: '',
      pageLanguage: 'en',
      direction: 'ltr',
      browserLanguage: 'en-US',
      keyboardEvidence: {
        latinKeys: 4,
        persianKeys: 0,
        physicalAlphaKeys: 4
      }
    },

    en: {
      beforeText:
        'This is an English typing test ',
      afterText:
        ' in the browser',
      fieldLanguage: 'en',
      pageLanguage: 'en',
      direction: 'ltr',
      browserLanguage: 'en-US',
      keyboardEvidence: {
        latinKeys: 0,
        persianKeys: 4,
        physicalAlphaKeys: 4
      }
    }
  };
}

async function commonPackageChecks(
  packageRoot,
  browserName
) {
  const manifest =
    await readJson(
      path.join(
        packageRoot,
        'manifest.json'
      )
    );

  const versionPass =
    manifest.version === EXPECTED_VERSION &&
    (
      browserName === 'Firefox'
        ? manifest
            .browser_specific_settings
            ?.gecko?.id ===
          EXPECTED_FIREFOX_ID
        : manifest.manifest_version === 3
    );

  const toolbarMismatches = [];

  for (
    const [
      relative,
      expected
    ] of Object.entries(
      APPROVED_TOOLBAR_SHA256
    )
  ) {
    const actual =
      await sha256(
        path.join(
          packageRoot,
          relative
        )
      );

    if (actual !== expected) {
      toolbarMismatches.push({
        relative,
        expected,
        actual
      });
    }
  }

  const [
    popupHtml,
    popupCss,
    popupJs,
    inlineJs
  ] =
    await Promise.all([
      fs.readFile(
        path.join(
          packageRoot,
          'popup.html'
        ),
        'utf8'
      ),
      fs.readFile(
        path.join(
          packageRoot,
          'popup.css'
        ),
        'utf8'
      ),
      fs.readFile(
        path.join(
          packageRoot,
          'popup.js'
        ),
        'utf8'
      ),
      fs.readFile(
        path.join(
          packageRoot,
          'inline_checker.js'
        ),
        'utf8'
      )
    ]);

  const popupRequired = [
    'id="brandMarkFa"',
    'id="brandMarkEn"',
    'id="languageFa"',
    'id="languageEn"',
    'id="themeToggle"',
    'id="currentSiteFavicon"',
    'id="siteToggle"'
  ];

  const popupMissing =
    popupRequired.filter(
      (token) =>
        !popupHtml.includes(token)
    );

  const popupPass =
    popupMissing.length === 0 &&
    popupCss.includes(
      '.brand-mark'
    ) &&
    popupJs.includes(
      'uiLanguage'
    ) &&
    popupJs.includes(
      'theme'
    ) &&
    popupJs.includes(
      'siteToggle'
    );

  const forbidden = [
    'wikipedia.org',
    'google.com/search',
    'webNavigation',
    'contextMenus',
    'searchGoogle',
    'knowledgePanel'
  ];

  const storeHits = [];

  for (
    const relative of [
      'background.js',
      'popup.js',
      'popup.html'
    ]
  ) {
    const body =
      (
        await fs.readFile(
          path.join(
            packageRoot,
            relative
          ),
          'utf8'
        )
      ).toLowerCase();

    for (const token of forbidden) {
      if (
        body.includes(
          token.toLowerCase()
        )
      ) {
        storeHits.push({
          relative,
          token
        });
      }
    }
  }

  const storePass =
    JSON.stringify(
      manifest.permissions || []
    ) ===
      JSON.stringify(
        ['storage', 'activeTab']
      ) &&
    !Object.hasOwn(
      manifest,
      'host_permissions'
    ) &&
    !Object.hasOwn(
      manifest,
      'omnibox'
    ) &&
    storeHits.length === 0;

  const undoRequired = [
    'makeSmartAutoUndoSuggestion',
    'applySmartAutoSuggestion',
    'SMART_AUTO_UNDO_VISIBLE_MS',
    'armSmartAutoUndoSurface',
    "surfaceMode === 'undo'"
  ];

  const undoMissing =
    undoRequired.filter(
      (token) =>
        !inlineJs.includes(token)
    );

  const engine =
    await loadEngine(
      packageRoot
    );

  const ctx = contexts();

  const persianSpelling =
    engine.smart_farsi_converter(
      'دانشکاه',
      {},
      ctx.fa
    ) === 'دانشگاه';

  const englishSpelling =
    engine.smart_farsi_converter(
      'tehcnology',
      {},
      ctx.en
    ) === 'technology' &&
    engine.smart_farsi_converter(
      'recieve',
      {},
      ctx.en
    ) === 'receive';

  const finglishCases = [
    ['salam', 'سلام'],
    ['salaam', 'سلام'],
    ['kharid', 'خرید'],
    ['daneshgah', 'دانشگاه'],
    ['barname', 'برنامه']
  ];

  const finglish =
    finglishCases.every(
      ([source, expected]) =>
        engine.smart_farsi_converter(
          source,
          {},
          ctx.fa
        ) === expected
    );

  const enFa =
    engine.analyzeFsaSmartAutoIntent(
      'sghl',
      ctx.googleEn,
      {}
    );

  const enFaPass =
    enFa.changed === true &&
    enFa.autoEligible === true &&
    enFa.corrected === 'سلام';

  const faEn =
    engine.analyzeFsaSmartAutoIntent(
      'اثممخ',
      ctx.en,
      {}
    );

  const faEnPass =
    faEn.changed === true &&
    faEn.autoEligible === true &&
    faEn.corrected === 'hello';

  const smartAuto =
    engine.analyzeFsaSmartAutoIntent(
      'sghl',
      ctx.fa,
      {}
    );

  const smartAutoPass =
    smartAuto.changed === true &&
    smartAuto.autoEligible === true &&
    smartAuto.corrected === 'سلام' &&
    undoMissing.length === 0;

  return {
    versionPass,
    toolbarPass:
      toolbarMismatches.length === 0,
    toolbarMismatches,
    popupPass,
    popupMissing,
    storePass,
    storeHits,
    persianSpelling,
    englishSpelling,
    finglish,
    enFa: {
      pass: enFaPass,
      actual: enFa
    },
    faEn: {
      pass: faEnPass,
      actual: faEn
    },
    smartAuto: {
      pass: smartAutoPass,
      actual: smartAuto,
      undoMissing
    }
  };
}

function fixtureHtml(
  lang,
  dir
) {
  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="utf-8">
  <title>FSA automated acceptance</title>
</head>
<body>
  <input id="plain-input" type="text" autocomplete="off">
  <textarea id="plain-textarea"></textarea>
  <div id="editable" contenteditable="true" spellcheck="false"></div>
  <div id="dynamic-host"></div>
  <script>
    setTimeout(() => {
      const input =
        document.createElement('input');

      input.id = 'dynamic-input';
      input.type = 'text';
      input.autocomplete = 'off';

      document
        .getElementById('dynamic-host')
        .appendChild(input);
    }, 250);
  </script>
</body>
</html>`;
}

async function startServer() {
  const fa =
    fixtureHtml(
      'fa',
      'rtl'
    );

  const en =
    fixtureHtml(
      'en',
      'ltr'
    );

  const server =
    http.createServer(
      (request, response) => {
        const url =
          new URL(
            request.url,
            'http://127.0.0.1'
          );

        const body =
          url.pathname === '/en.html'
            ? en
            : fa;

        response.writeHead(
          200,
          {
            'content-type':
              'text/html; charset=utf-8',
            'cache-control':
              'no-store'
          }
        );

        response.end(body);
      }
    );

  await new Promise(
    (resolve, reject) => {
      server.once(
        'error',
        reject
      );

      server.listen(
        0,
        '127.0.0.1',
        resolve
      );
    }
  );

  const address =
    server.address();

  assert(
    address &&
    typeof address === 'object'
  );

  return {
    baseUrl:
      `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise(
        (resolve) =>
          server.close(resolve)
      )
  };
}

async function chromeValue(
  page,
  selector
) {
  return page.$eval(
    selector,
    (element) =>
      element.isContentEditable
        ? element.textContent
        : element.value
  );
}

async function chromeClear(
  page,
  selector
) {
  await page.focus(selector);

  await page.keyboard.down(
    'Control'
  );
  await page.keyboard.press(
    'KeyA'
  );
  await page.keyboard.up(
    'Control'
  );

  await page.keyboard.press(
    'Backspace'
  );
}

async function chromeTypeAndExpect(
  page,
  selector,
  source,
  expected
) {
  await chromeClear(
    page,
    selector
  );

  await page.type(
    selector,
    source,
    {
      delay: 35
    }
  );

  await page.keyboard.press(
    'Space'
  );

  await page.waitForFunction(
    (
      targetSelector,
      targetExpected
    ) => {
      const element =
        document.querySelector(
          targetSelector
        );

      if (!element) {
        return false;
      }

      const value =
        element.isContentEditable
          ? element.textContent
          : element.value;

      return String(
        value || ''
      ).startsWith(
        targetExpected
      );
    },
    {
      timeout: 6500
    },
    selector,
    expected
  );

  return chromeValue(
    page,
    selector
  );
}

async function chromeRuntime(
  baseUrl
) {
  const state = {
    load: false,
    preferences: false,
    siteToggle: false,
    inputTextarea: false,
    contentDynamic: false,
    enFa: false,
    faEn: false,
    finalSweep: false,
    evidence: {}
  };

  const browser =
    await puppeteer.launch({
      executablePath:
        chromeExecutable,
      browser: 'chrome',
      headless: true,
      pipe: true,
      enableExtensions: true
    });

  try {
    const runtimeExtensionId =
      await browser.installExtension(
        chromeRoot
      );

    state.evidence
      .runtimeExtensionId =
      runtimeExtensionId;

    const installedExtensions =
      await browser.extensions();

    const extensionEntries =
      [
        ...installedExtensions.entries()
      ];

    state.evidence.installedExtensions =
      extensionEntries.map(
        ([id, extension]) => ({
          id,
          name:
            extension?.name ||
            '',
          version:
            extension?.version ||
            ''
        })
      );

    const exactExtension =
      extensionEntries.find(
        ([, extension]) =>
          extension?.name ===
            'NeveshtYar' &&
          extension?.version ===
            EXPECTED_VERSION
      ) || null;

    if (!exactExtension) {
      throw new Error(
        'Installed Chrome started, but Puppeteer runtime install did not register NeveshtYar 4.9.2.'
      );
    }

    const [
      extensionId,
      extensionInfo
    ] =
      exactExtension;

    state.load = true;

    state.evidence.extensionId =
      extensionId;

    state.evidence.extensionInfo = {
      name:
        extensionInfo?.name ||
        '',
      version:
        extensionInfo?.version ||
        ''
    };

    const workerTarget =
      await browser.waitForTarget(
        (target) =>
          target.type() ===
            'service_worker' &&
          target
            .url()
            .startsWith(
              `chrome-extension://${extensionId}/`
            ),
        {
          timeout: 20000
        }
      );

    const worker =
      await workerTarget.worker();

    const page =
      await browser.newPage();

    await page.goto(
      `${baseUrl}/fa.html`,
      {
        waitUntil:
          'networkidle0'
      }
    );

    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          800
        )
    );

    try {
      await chromeTypeAndExpect(
        page,
        '#plain-input',
        'sghl',
        'سلام'
      );

      await chromeTypeAndExpect(
        page,
        '#plain-textarea',
        'sghl',
        'سلام'
      );

      state.inputTextarea =
        true;
    } catch (error) {
      state.evidence
        .inputTextareaError =
        String(error);
    }

    try {
      await chromeTypeAndExpect(
        page,
        '#editable',
        'sghl',
        'سلام'
      );

      await page.waitForSelector(
        '#dynamic-input',
        {
          timeout: 5000
        }
      );

      await chromeTypeAndExpect(
        page,
        '#dynamic-input',
        'sghl',
        'سلام'
      );

      state.contentDynamic =
        true;
    } catch (error) {
      state.evidence
        .contentDynamicError =
        String(error);
    }

    try {
      await page.goto(
        `${baseUrl}/en.html`,
        {
          waitUntil:
            'networkidle0'
        }
      );

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            800
          )
      );

      const actual =
        await chromeTypeAndExpect(
          page,
          '#plain-input',
          'sghl',
          'سلام'
        );

      state.enFa =
        String(actual)
          .startsWith(
            'سلام'
          );

      state.evidence
        .enFaActual =
        actual;
    } catch (error) {
      state.evidence
        .enFaError =
        String(error);
    }

    try {
      await page.goto(
        `${baseUrl}/en.html`,
        {
          waitUntil:
            'networkidle0'
        }
      );

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            800
          )
      );

      const actual =
        await chromeTypeAndExpect(
          page,
          '#plain-input',
          'اثممخ',
          'hello'
        );

      state.faEn =
        String(actual)
          .startsWith(
            'hello'
          );

      state.evidence
        .faEnActual =
        actual;
    } catch (error) {
      state.evidence
        .faEnError =
        String(error);
    }

    try {
      await worker.evaluate(
        async () => {
          await chrome.storage.sync.set({
            disabledHosts: [
              '127.0.0.1'
            ]
          });
        }
      );

      await page.goto(
        `${baseUrl}/fa.html`,
        {
          waitUntil:
            'networkidle0'
        }
      );

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            700
          )
      );

      await page.type(
        '#plain-input',
        'sghl',
        {
          delay: 35
        }
      );

      await page.keyboard.press(
        'Space'
      );

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            1300
          )
      );

      const disabledValue =
        await chromeValue(
          page,
          '#plain-input'
        );

      await worker.evaluate(
        async () => {
          await chrome.storage.sync.set({
            disabledHosts: []
          });
        }
      );

      await page.goto(
        `${baseUrl}/fa.html`,
        {
          waitUntil:
            'networkidle0'
        }
      );

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            700
          )
      );

      const enabledValue =
        await chromeTypeAndExpect(
          page,
          '#plain-input',
          'sghl',
          'سلام'
        );

      state.siteToggle =
        String(
          disabledValue
        ).startsWith(
          'sghl'
        ) &&
        String(
          enabledValue
        ).startsWith(
          'سلام'
        );

      state.evidence
        .siteToggle = {
          disabledValue,
          enabledValue
        };
    } catch (error) {
      state.evidence
        .siteToggleError =
        String(error);
    }

    try {
      const popup =
        await browser.newPage();

      await popup.goto(
        `chrome-extension://${extensionId}/popup.html`,
        {
          waitUntil:
            'networkidle0'
        }
      );

      await popup.waitForSelector(
        '#languageEn'
      );

      await popup.click(
        '#languageEn'
      );

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            300
          )
      );

      const enState =
        await popup.evaluate(
          () => ({
            lang:
              document
                .documentElement
                .lang,
            dir:
              document
                .documentElement
                .dir
          })
        );

      await popup.click(
        '#themeToggle'
      );

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            300
          )
      );

      const themeBefore =
        await popup.evaluate(
          () =>
            document
              .documentElement
              .dataset
              .theme ||
            'light'
        );

      await popup.reload({
        waitUntil:
          'networkidle0'
      });

      const persisted =
        await popup.evaluate(
          () => ({
            lang:
              document
                .documentElement
                .lang,
            dir:
              document
                .documentElement
                .dir,
            theme:
              document
                .documentElement
                .dataset
                .theme ||
              'light'
          })
        );

      state.preferences =
        enState.lang === 'en' &&
        enState.dir === 'ltr' &&
        persisted.lang === 'en' &&
        persisted.dir === 'ltr' &&
        persisted.theme ===
          themeBefore;

      state.evidence
        .preferences = {
          enState,
          themeBefore,
          persisted
        };

      await popup.screenshot({
        path:
          path.join(
            artifactRoot,
            'chrome-popup.png'
          ),
        fullPage: true
      });

      await popup.close();
    } catch (error) {
      state.evidence
        .preferencesError =
        String(error);
    }

    try {
      await page.goto(
        `${baseUrl}/en.html`,
        {
          waitUntil:
            'networkidle0'
        }
      );

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            700
          )
      );

      const finalValue =
        await chromeTypeAndExpect(
          page,
          '#plain-input',
          'sghl',
          'سلام'
        );

      const stillAlive =
        browser
          .targets()
          .some(
            (target) =>
              target.type() ===
                'service_worker' &&
              target
                .url()
                .includes(
                  extensionId
                )
          );

      state.finalSweep =
        String(finalValue)
          .startsWith(
            'سلام'
          ) &&
        stillAlive;

      state.evidence
        .final = {
          finalValue,
          stillAlive
        };

      await page.screenshot({
        path:
          path.join(
            artifactRoot,
            'chrome-final.png'
          ),
        fullPage: true
      });
    } catch (error) {
      state.evidence
        .finalError =
        String(error);
    }
  } finally {
    await browser.close();
  }

  return state;
}

async function seleniumValue(
  driver,
  id
) {
  const element =
    await driver.findElement(
      By.id(id)
    );

  const tag =
    (
      await element.getTagName()
    ).toLowerCase();

  return tag === 'div'
    ? element.getText()
    : element.getAttribute(
        'value'
      );
}

async function seleniumTypeAndExpect(
  driver,
  id,
  source,
  expected
) {
  const element =
    await driver.findElement(
      By.id(id)
    );

  await driver.executeScript(
    'arguments[0].scrollIntoView({block:"center", inline:"nearest"}); arguments[0].focus();',
    element
  );

  await driver.sleep(
    50
  );

  await element.sendKeys(
    Key.CONTROL,
    'a'
  );

  await element.sendKeys(
    Key.BACK_SPACE
  );

  await element.sendKeys(
    source,
    Key.SPACE
  );

  await driver.wait(
    async () =>
      String(
        await seleniumValue(
          driver,
          id
        ) || ''
      ).startsWith(
        expected
      ),
    6500
  );

  return seleniumValue(
    driver,
    id
  );
}

async function firefoxRuntime(
  baseUrl
) {
  const state = {
    load: false,
    inputTextarea: false,
    contentDynamic: false,
    enFa: false,
    faEn: false,
    finalSweep: false,
    evidence: {}
  };

  const options =
    new firefox.Options()
      .addArguments(
        '-headless'
      );

  const driver =
    await new Builder()
      .forBrowser(
        'firefox'
      )
      .setFirefoxOptions(
        options
      )
      .build();

  try {
    const addonId =
      await driver.installAddon(
        firefoxRoot,
        true
      );

    state.load =
      addonId ===
      EXPECTED_FIREFOX_ID;

    state.evidence.addonId =
      addonId;

    await driver.get(
      `${baseUrl}/fa.html`
    );

    await driver.sleep(
      800
    );

    try {
      await seleniumTypeAndExpect(
        driver,
        'plain-input',
        'sghl',
        'سلام'
      );

      await seleniumTypeAndExpect(
        driver,
        'plain-textarea',
        'sghl',
        'سلام'
      );

      state.inputTextarea =
        true;
    } catch (error) {
      state.evidence
        .inputTextareaError =
        String(error);
    }

    try {
      await seleniumTypeAndExpect(
        driver,
        'editable',
        'sghl',
        'سلام'
      );

      await driver.wait(
        until.elementLocated(
          By.id(
            'dynamic-input'
          )
        ),
        5000
      );

      await seleniumTypeAndExpect(
        driver,
        'dynamic-input',
        'sghl',
        'سلام'
      );

      state.contentDynamic =
        true;
    } catch (error) {
      state.evidence
        .contentDynamicError =
        String(error);
    }

    try {
      await driver.get(
        `${baseUrl}/en.html`
      );

      await driver.sleep(
        800
      );

      const actual =
        await seleniumTypeAndExpect(
          driver,
          'plain-input',
          'sghl',
          'سلام'
        );

      state.enFa =
        String(actual)
          .startsWith(
            'سلام'
          );

      state.evidence
        .enFaActual =
        actual;
    } catch (error) {
      state.evidence
        .enFaError =
        String(error);
    }

    try {
      await driver.get(
        `${baseUrl}/en.html`
      );

      await driver.sleep(
        800
      );

      const actual =
        await seleniumTypeAndExpect(
          driver,
          'plain-input',
          'اثممخ',
          'hello'
        );

      state.faEn =
        String(actual)
          .startsWith(
            'hello'
          );

      state.evidence
        .faEnActual =
        actual;
    } catch (error) {
      state.evidence
        .faEnError =
        String(error);
    }

    try {
      await driver.get(
        `${baseUrl}/en.html`
      );

      await driver.sleep(
        800
      );

      const finalValue =
        await seleniumTypeAndExpect(
          driver,
          'plain-input',
          'sghl',
          'سلام'
        );

      state.finalSweep =
        String(finalValue)
          .startsWith(
            'سلام'
          );

      state.evidence
        .finalValue =
        finalValue;

      const screenshot =
        await driver.takeScreenshot();

      await fs.writeFile(
        path.join(
          artifactRoot,
          'firefox-final.png'
        ),
        Buffer.from(
          screenshot,
          'base64'
        )
      );
    } catch (error) {
      state.evidence
        .finalError =
        String(error);
    }
  } finally {
    await driver.quit();
  }

  return state;
}

function compose(
  browserName,
  common,
  runtime
) {
  const browserSpecificPreferences =
    browserName === 'Chrome'
      ? runtime.preferences
      : common.popupPass;

  const browserSpecificSiteToggle =
    browserName === 'Chrome'
      ? runtime.siteToggle
      : common.popupPass;

  const rows = [
    record(
      1,
      common.versionPass &&
        runtime.load,
      'manifest + real browser load',
      JSON.stringify(
        runtime.evidence
          ?.topError ||
        runtime.evidence
          ?.addonId ||
        runtime.evidence
          ?.extensionId ||
        runtime.evidence
          ?.installedExtensions ||
        ''
      )
    ),

    record(
      2,
      common.toolbarPass,
      'approved toolbar SHA256',
      JSON.stringify(
        common.toolbarMismatches
      )
    ),

    record(
      3,
      common.popupPass,
      'popup DOM/CSS/source contract',
      JSON.stringify(
        common.popupMissing
      )
    ),

    record(
      4,
      browserSpecificPreferences,
      browserName === 'Chrome'
        ? 'real extension popup persistence'
        : 'shared Firefox package popup contract',
      JSON.stringify(
        runtime.evidence
          ?.preferences ||
        runtime.evidence
          ?.topError ||
        {}
      )
    ),

    record(
      5,
      browserSpecificSiteToggle,
      browserName === 'Chrome'
        ? 'real extension storage/site runtime'
        : 'shared Firefox package site-toggle contract',
      JSON.stringify(
        runtime.evidence
          ?.siteToggle ||
        runtime.evidence
          ?.topError ||
        {}
      )
    ),

    record(
      6,
      common.persianSpelling,
      'exact package engine'
    ),

    record(
      7,
      common.englishSpelling,
      'exact package engine'
    ),

    record(
      8,
      common.finglish,
      'exact package engine'
    ),

    record(
      9,
      common.enFa.pass &&
        runtime.enFa,
      'exact package engine + real browser physical typing',
      JSON.stringify({
        engine:
          common.enFa.actual,
        browser:
          runtime.evidence
            ?.enFaActual ||
          runtime.evidence
            ?.enFaError ||
          runtime.evidence
            ?.topError ||
          ''
      })
    ),

    record(
      10,
      common.faEn.pass &&
        runtime.faEn,
      'exact package engine + real browser physical typing',
      JSON.stringify({
        engine:
          common.faEn.actual,
        browser:
          runtime.evidence
            ?.faEnActual ||
          runtime.evidence
            ?.faEnError ||
          runtime.evidence
            ?.topError ||
          ''
      })
    ),

    record(
      11,
      common.smartAuto.pass,
      'engine + Undo source contract',
      JSON.stringify(
        common.smartAuto
      )
    ),

    record(
      12,
      runtime.inputTextarea,
      'real browser content-script runtime',
      JSON.stringify(
        runtime.evidence
          ?.inputTextareaError ||
        runtime.evidence
          ?.topError ||
        ''
      )
    ),

    record(
      13,
      runtime.contentDynamic,
      'real browser content-script runtime',
      JSON.stringify(
        runtime.evidence
          ?.contentDynamicError ||
        runtime.evidence
          ?.topError ||
        ''
      )
    ),

    record(
      14,
      common.storePass,
      'manifest + runtime Store-safe scan',
      JSON.stringify(
        common.storeHits
      )
    ),

    record(
      15,
      runtime.finalSweep,
      'real browser final sweep',
      JSON.stringify(
        runtime.evidence
          ?.final ||
        runtime.evidence
          ?.finalValue ||
        runtime.evidence
          ?.finalError ||
        runtime.evidence
          ?.topError ||
        ''
      )
    )
  ];

  return {
    browser: browserName,
    pass:
      rows.every(
        (item) =>
          item.status === 'PASS'
      ),
    passCount:
      rows.filter(
        (item) =>
          item.status === 'PASS'
      ).length,
    total:
      rows.length,
    checks: rows
  };
}

function markdown(
  report
) {
  const lines = [
    '# NeveshtYar v4.9.2 Automated Dual-Browser Acceptance',
    '',
    `Generated: ${report.generatedAt}`,
    `Overall: **${report.overall}**`,
    ''
  ];

  for (
    const browser of
    report.browsers
  ) {
    lines.push(
      `## ${browser.browser}: ${browser.passCount}/${browser.total}`
    );
    lines.push('');
    lines.push(
      '| # | Status | Check | Evidence |'
    );
    lines.push(
      '|---:|:---:|---|---|'
    );

    for (
      const item of
      browser.checks
    ) {
      const detail =
        String(
          item.detail || ''
        )
          .replaceAll(
            '|',
            '\\|'
          )
          .replaceAll(
            '\n',
            ' '
          )
          .slice(
            0,
            500
          );

      lines.push(
        `| ${item.number} | ${item.status} | ${item.name} | ${item.evidence}${detail ? ` — ${detail}` : ''} |`
      );
    }

    lines.push('');
  }

  if (
    report.failures.length
  ) {
    lines.push(
      '## Blocking failures'
    );
    lines.push('');

    for (
      const failure of
      report.failures
    ) {
      lines.push(
        `- ${failure.browser} #${failure.number}: ${failure.name}${failure.detail ? ` — ${failure.detail}` : ''}`
      );
    }

    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

await fs.rm(
  artifactRoot,
  {
    recursive: true,
    force: true
  }
);

await fs.mkdir(
  artifactRoot,
  {
    recursive: true
  }
);

const fixture =
  await startServer();

let chrome = null;
let firefoxState = null;
let chromeTopError = null;
let firefoxTopError = null;

try {
  try {
    chrome =
      await chromeRuntime(
        fixture.baseUrl
      );
  } catch (error) {
    chromeTopError =
      String(
        error?.stack ||
        error
      );

    chrome = {
      load: false,
      preferences: false,
      siteToggle: false,
      inputTextarea: false,
      contentDynamic: false,
      enFa: false,
      faEn: false,
      finalSweep: false,
      evidence: {
        topError:
          chromeTopError
      }
    };
  }

  try {
    firefoxState =
      await firefoxRuntime(
        fixture.baseUrl
      );
  } catch (error) {
    firefoxTopError =
      String(
        error?.stack ||
        error
      );

    firefoxState = {
      load: false,
      inputTextarea: false,
      contentDynamic: false,
      enFa: false,
      faEn: false,
      finalSweep: false,
      evidence: {
        topError:
          firefoxTopError
      }
    };
  }
} finally {
  await fixture.close();
}

const [
  chromeCommon,
  firefoxCommon
] =
  await Promise.all([
    commonPackageChecks(
      chromeRoot,
      'Chrome'
    ),
    commonPackageChecks(
      firefoxRoot,
      'Firefox'
    )
  ]);

const browsers = [
  compose(
    'Chrome',
    chromeCommon,
    chrome
  ),
  compose(
    'Firefox',
    firefoxCommon,
    firefoxState
  )
];

const failures =
  browsers.flatMap(
    (browser) =>
      browser.checks
        .filter(
          (item) =>
            item.status ===
            'FAIL'
        )
        .map(
          (item) => ({
            browser:
              browser.browser,
            number:
              item.number,
            name:
              item.name,
            detail:
              item.detail
          })
        )
  );

const report = {
  schemaVersion: 1,
  generatedAt:
    new Date()
      .toISOString(),
  overall:
    failures.length === 0
      ? 'PASS'
      : 'FAIL',
  chromeTopError,
  firefoxTopError,
  browsers,
  failures
};

const reportJson =
  path.join(
    artifactRoot,
    'report.json'
  );

const reportMd =
  path.join(
    artifactRoot,
    'report.md'
  );

await fs.writeFile(
  reportJson,
  `${JSON.stringify(
    report,
    null,
    2
  )}\n`,
  'utf8'
);

await fs.writeFile(
  reportMd,
  markdown(report),
  'utf8'
);

process.stdout.write(
  markdown(report)
);

if (
  failures.length > 0
) {
  process.exitCode = 1;
}