/**
 * dsh-a11y — Client half (v1).
 *
 * Coverage, not a rewrite. The shipped chat already owns two polite live
 * regions (turn start: `chat.deepDiving`; turn end: worked / failed / stopped).
 * This plugin deliberately never announces turn start or turn end. It adds the
 * transitions the host leaves silent: tool started / finished / failed,
 * approval requested, and question asked. Everything is derived from Client
 * state (`useChat`, `useSessionStatus`), never from scraping another plugin's
 * DOM. The only host DOM reads are focus-management lookups for a pending
 * approval (`[data-approval-key]`) and the composer input
 * (`[data-composer-input]`), both host-owned stable markers.
 *
 * v2 (author kit: ctx.a11y, <LiveRegion>, useFocusTrap, useRovingTabIndex,
 * auditSubtree) is intentionally absent from this build.
 */
window.__ModuleLoader__.load({
  id: 'dsh-a11y',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const PKG = 'dsh-a11y';
    const NS = 'a11y';
    const STYLE_TAG_ID = PKG + '/client.css';
    const STORAGE_KEY = 'dsh-a11y.settings.v1';
    const TEXT_SIZES = Object.freeze([12, 14, 16, 18, 20, 22]);
    const SPEED_MS = Object.freeze({ fast: 250, normal: 700, slow: 1400 });
    const DEFAULTS = Object.freeze({
      verbosity: 'concise',
      speed: 'normal',
      focusRing: 'default',
      motion: 'system',
    });
    const VERBOSITY_VALUES = new Set(['off', 'concise', 'detailed']);
    const SPEED_VALUES = new Set(['fast', 'normal', 'slow']);
    const FOCUS_VALUES = new Set(['default', 'strong']);
    const MOTION_VALUES = new Set(['system', 'reduce', 'full']);

    // ---------------------------------------------------------------------
    // Copy. Keep this in sync with locale/en.json and locale/zh.json; the
    // package files are the display metadata and the runtime dictionaries are
    // what components receive through the locale seat.
    // ---------------------------------------------------------------------
    const EN = Object.freeze({
      'meta.title': 'Accessibility',
      'meta.description': 'Screen-reader announcements, keyboard navigation, and accessibility preferences.',
      'section.nav': 'Accessibility',
      'section.title': 'Accessibility',
      'section.intro': 'Extra announcements and keyboard navigation for screen-reader and keyboard use. The built-in chat announcement still owns turn start and turn end, so this plugin stays silent for those.',
      'section.storageNote': 'These preferences are saved in this browser.',
      'verbosity.title': 'Announcements',
      'verbosity.description': 'What is spoken while a turn runs: tool activity, approvals, and questions.',
      'verbosity.off': 'Off',
      'verbosity.concise': 'Concise',
      'verbosity.detailed': 'Detailed',
      'speed.title': 'Announcement speed',
      'speed.description': 'The pause between queued announcements. Use a slower speed if your screen reader cuts messages off.',
      'speed.fast': 'Fast',
      'speed.normal': 'Normal',
      'speed.slow': 'Slow',
      'focus.title': 'Focus ring',
      'focus.description': 'Draw a larger, higher-contrast focus indicator on every control.',
      'focus.default': 'Default',
      'focus.strong': 'Emphasized',
      'motion.title': 'Motion',
      'motion.description': "Follow the operating system's reduced-motion setting, or override it for this app.",
      'motion.system': 'Follow system',
      'motion.reduce': 'Reduce motion',
      'motion.full': 'Allow motion',
      'motion.systemReduced': 'Your system currently asks for reduced motion.',
      'motion.systemFull': 'Your system currently allows full motion.',
      'text.title': 'Text size',
      'text.description': 'Content text size for the conversation. This is the same preference as Appearance → Text size.',
      'text.px': '{px} px',
      'test.title': 'Test',
      'test.description': 'Check that announcements reach your screen reader.',
      'test.button': 'Test announcement',
      'test.spoken': 'Announcements are working. This is a test.',
      'reset.title': 'Reset',
      'reset.description': 'Restore the default announcement, focus, motion, and text-size preferences.',
      'reset.button': 'Reset preferences',
      'reset.done': 'Accessibility preferences reset.',
      'turn.heading': 'Turn {turn}: {status}',
      'turn.completed': 'completed',
      'turn.stopped': 'stopped',
      'turn.failed': 'failed',
      'turn.maxTokens': 'ended at the output-token limit',
      'turn.unknown': 'ended',
      'nav.label': 'Conversation navigation',
      'nav.latest': 'Jump to latest turn',
      'skip.label': 'Skip to conversation',
      'skip.nav': 'Accessibility',
      'announce.toolStart': 'Tool {name} started',
      'announce.toolStartedUnknown': 'A tool started',
      'announce.toolDone': 'Tool {name} finished',
      'announce.toolDoneSeconds': 'Tool {name} finished in {seconds} seconds',
      'announce.toolDoneSummary': 'Tool {name} finished. {summary}',
      'announce.toolDoneDetail': 'Tool {name} finished in {seconds} seconds. {summary}',
      'announce.toolDoneUnknown': 'A tool finished',
      'announce.toolDoneUnknownSummary': 'A tool finished. {summary}',
      'announce.toolFailed': 'Tool {name} failed',
      'announce.toolFailedDetail': 'Tool {name} failed. {summary}',
      'announce.toolFailedUnknown': 'A tool failed',
      'announce.toolFailedUnknownDetail': 'A tool failed. {summary}',
      'announce.approval': 'Approval requested for {tool}',
      'announce.approvalReason': 'Approval requested for {tool}. {reason}',
      'announce.question': 'Question: {question}',
      'announce.questions': '{count} questions. First: {question}',
      'announce.planReview': 'Plan review requested: {question}',
      'announce.planReviewShort': 'Plan review requested',
      'announce.questionShort': 'A question needs an answer',
      'announce.questionFallback': 'a question without text',
      'duration.seconds': '{seconds}',
    });

    const ZH = Object.freeze({
      'meta.title': '无障碍',
      'meta.description': '读屏播报、键盘导航和无障碍偏好设置。',
      'section.nav': '无障碍',
      'section.title': '无障碍',
      'section.intro': '为读屏和纯键盘操作补充播报与导航。回合开始和结束仍由内置聊天播报负责，本插件不会重复播报。',
      'section.storageNote': '这些偏好保存在当前浏览器中。',
      'verbosity.title': '播报',
      'verbosity.description': '回合运行期间播报什么：工具活动、审批和提问。',
      'verbosity.off': '关闭',
      'verbosity.concise': '简洁',
      'verbosity.detailed': '详细',
      'speed.title': '播报速度',
      'speed.description': '队列中两条播报之间的停顿。如果读屏会截断消息，请选择更慢的速度。',
      'speed.fast': '快',
      'speed.normal': '正常',
      'speed.slow': '慢',
      'focus.title': '焦点环',
      'focus.description': '为所有控件绘制更大、对比度更高的焦点指示。',
      'focus.default': '默认',
      'focus.strong': '强调',
      'motion.title': '动态效果',
      'motion.description': '跟随操作系统的“减少动态效果”设置，或仅为此应用覆盖它。',
      'motion.system': '跟随系统',
      'motion.reduce': '减少动态效果',
      'motion.full': '允许动态效果',
      'motion.systemReduced': '系统当前要求减少动态效果。',
      'motion.systemFull': '系统当前允许完整动态效果。',
      'text.title': '文字大小',
      'text.description': '对话内容的文字大小。与“外观 → 文字大小”是同一个偏好。',
      'text.px': '{px} 像素',
      'test.title': '测试',
      'test.description': '检查播报是否能到达你的读屏。',
      'test.button': '测试播报',
      'test.spoken': '播报工作正常。这是一次测试。',
      'reset.title': '重置',
      'reset.description': '恢复默认的播报、焦点、动态效果和文字大小偏好。',
      'reset.button': '重置偏好',
      'reset.done': '无障碍偏好已重置。',
      'turn.heading': '第 {turn} 回合：{status}',
      'turn.completed': '已完成',
      'turn.stopped': '已停止',
      'turn.failed': '失败',
      'turn.maxTokens': '因输出令牌上限而结束',
      'turn.unknown': '已结束',
      'nav.label': '对话导航',
      'nav.latest': '跳到最新回合',
      'skip.label': '跳到对话',
      'skip.nav': '无障碍',
      'announce.toolStart': '工具 {name} 已开始',
      'announce.toolStartedUnknown': '有工具开始运行',
      'announce.toolDone': '工具 {name} 已完成',
      'announce.toolDoneSeconds': '工具 {name} 已在 {seconds} 秒内完成',
      'announce.toolDoneSummary': '工具 {name} 已完成。{summary}',
      'announce.toolDoneDetail': '工具 {name} 已在 {seconds} 秒内完成。{summary}',
      'announce.toolDoneUnknown': '有工具完成',
      'announce.toolDoneUnknownSummary': '有工具完成。{summary}',
      'announce.toolFailed': '工具 {name} 失败',
      'announce.toolFailedDetail': '工具 {name} 失败。{summary}',
      'announce.toolFailedUnknown': '有工具失败',
      'announce.toolFailedUnknownDetail': '有工具失败。{summary}',
      'announce.approval': '请求批准 {tool}',
      'announce.approvalReason': '请求批准 {tool}。{reason}',
      'announce.question': '提问：{question}',
      'announce.questions': '{count} 个问题。第一个：{question}',
      'announce.planReview': '请求审阅计划：{question}',
      'announce.planReviewShort': '请求审阅计划',
      'announce.questionShort': '有一个问题需要回答',
      'announce.questionFallback': '一个没有文字的问题',
      'duration.seconds': '{seconds}',
    });

    const LOCALE_DICTS = Object.freeze({
      en: EN,
      zh: ZH,
      ja: EN,
      es: EN,
      fr: EN,
      de: EN,
      ru: EN,
      pt: EN,
    });

    // ---------------------------------------------------------------------
    // Pure announcement formatting. These are exported for node tests and are
    // also the only place announcement copy is produced.
    // ---------------------------------------------------------------------
    function interpolate(template, params) {
      if (typeof template !== 'string') return '';
      if (params === undefined || params === null) return template;
      return template.replace(/\{(\w+)\}/g, (match, key) => {
        return Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match;
      });
    }

    function truncate(text, max = 96) {
      const normalized = String(text === undefined || text === null ? '' : text)
        .replace(/\s+/g, ' ')
        .trim();
      if (normalized.length <= max) return normalized;
      const cut = normalized.slice(0, Math.max(0, max - 1)).trimEnd();
      return cut + '…';
    }

    function formatToolStart(t, name) {
      const clean = truncate(name || '', 40);
      return clean
        ? t('announce.toolStart', { name: clean })
        : t('announce.toolStartedUnknown');
    }

    function formatToolEnd(t, options) {
      const name = truncate(options && options.name ? options.name : '', 40);
      const summary = options && options.summary ? truncate(options.summary, 96) : '';
      const seconds = options && options.seconds ? options.seconds : '';
      if (options && options.isError) {
        if (name && summary) return t('announce.toolFailedDetail', { name, summary });
        if (name) return t('announce.toolFailed', { name });
        return summary
          ? t('announce.toolFailedUnknownDetail', { summary })
          : t('announce.toolFailedUnknown');
      }
      if (!name) {
        return options && options.detailed && summary
          ? t('announce.toolDoneUnknownSummary', { summary })
          : t('announce.toolDoneUnknown');
      }
      if (!options || !options.detailed) return t('announce.toolDone', { name });
      if (summary && seconds) return t('announce.toolDoneDetail', { name, seconds, summary });
      if (summary) return t('announce.toolDoneSummary', { name, summary });
      if (seconds) return t('announce.toolDoneSeconds', { name, seconds });
      return t('announce.toolDone', { name });
    }

    function formatPending(t, pending) {
      if (pending === undefined || pending === null) return '';
      if (pending.kind === 'approval') {
        const tool = truncate(pending.toolName || 'tool', 40);
        const reason = pending.reason ? truncate(pending.reason, 96) : '';
        return reason
          ? t('announce.approvalReason', { tool, reason })
          : t('announce.approval', { tool });
      }
      const questions = Array.isArray(pending.questions) ? pending.questions : [];
      const first =
        questions.length > 0 && typeof questions[0].question === 'string'
          ? truncate(questions[0].question, 120)
          : '';
      if (pending.kind === 'plan-review') {
        return first ? t('announce.planReview', { question: first }) : t('announce.planReviewShort');
      }
      if (questions.length > 1) {
        return t('announce.questions', {
          count: questions.length,
          question: first || t('announce.questionFallback'),
        });
      }
      return first ? t('announce.question', { question: first }) : t('announce.questionShort');
    }

    function mergeAnnouncementQueue(queue, item) {
      if (item && item.mergeKey !== undefined) {
        const index = queue.findIndex((entry) => entry.mergeKey === item.mergeKey);
        if (index >= 0) {
          const next = queue.slice();
          next[index] = item;
          return next;
        }
      }
      return queue.concat(item);
    }

    function nodeToText(value, depth = 0) {
      if (value === undefined || value === null || depth > 3) return '';
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (Array.isArray(value)) {
        return value.map((item) => nodeToText(item, depth + 1)).filter(Boolean).join(' ');
      }
      if (typeof value === 'object') {
        if (typeof value.text === 'string') return value.text;
        if (typeof value.content === 'string') return value.content;
        if (typeof value.message === 'string') return value.message;
        if (Array.isArray(value.content)) return nodeToText(value.content, depth + 1);
      }
      return '';
    }

    function toolResultSummary(node) {
      if (!node) return '';
      if (node.isError) {
        const error = node.error && typeof node.error === 'object' ? node.error : {};
        return truncate(error.reason || error.code || nodeToText(node.content), 96);
      }
      return truncate(nodeToText(node.content), 96);
    }

    function toolDurationSeconds(node) {
      if (!node || typeof node.time !== 'number' || typeof node.callTime !== 'number') return null;
      const ms = node.time - node.callTime;
      if (!Number.isFinite(ms) || ms < 0) return null;
      return (Math.max(100, ms) / 1000).toFixed(1);
    }

    function turnStatus(t, turn) {
      const reason = turn && turn.end && turn.end.data && turn.end.data.reason
        ? turn.end.data.reason.kind
        : undefined;
      if (reason === 'aborted' || reason === 'interrupted') return t('turn.stopped');
      if (reason === 'error') return t('turn.failed');
      if (reason === 'max-tokens' || reason === 'max_tokens') return t('turn.maxTokens');
      if (turn && turn.status === 'open') return t('turn.unknown');
      return t('turn.completed');
    }

    // ---------------------------------------------------------------------
    // Preferences. Browser-local, normalized on read and write.
    // ---------------------------------------------------------------------
    function normalizeSettings(value) {
      const next = { ...DEFAULTS };
      if (value && typeof value === 'object') {
        if (VERBOSITY_VALUES.has(value.verbosity)) next.verbosity = value.verbosity;
        if (SPEED_VALUES.has(value.speed)) next.speed = value.speed;
        if (FOCUS_VALUES.has(value.focusRing)) next.focusRing = value.focusRing;
        if (MOTION_VALUES.has(value.motion)) next.motion = value.motion;
      }
      return Object.freeze(next);
    }

    function safeStorage() {
      try {
        const storage = window.localStorage;
        const probe = '__dsh_a11y_probe__';
        storage.setItem(probe, '1');
        storage.removeItem(probe);
        return storage;
      } catch (error) {
        return null;
      }
    }

    function createSettingsStore(storage) {
      let state = normalizeSettings(undefined);
      if (storage !== null) {
        try {
          const raw = storage.getItem(STORAGE_KEY);
          if (raw) state = normalizeSettings(JSON.parse(raw));
        } catch (error) {
          state = normalizeSettings(undefined);
        }
      }
      const listeners = new Set();
      function persist() {
        if (storage === null) return;
        try {
          storage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
          /* Browser storage can be unavailable or full; the in-memory value still works. */
        }
      }
      function emit() {
        for (const listener of Array.from(listeners)) {
          try {
            listener();
          } catch (error) {
            /* A broken listener must not stop the others. */
          }
        }
      }
      return {
        get() {
          return state;
        },
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        update(patch) {
          state = normalizeSettings({ ...state, ...patch });
          persist();
          emit();
        },
        reset() {
          state = normalizeSettings(undefined);
          persist();
          emit();
        },
      };
    }

    function applyGlobalSettings(settings) {
      if (typeof document === 'undefined' || document.documentElement === null) return;
      const root = document.documentElement;
      root.setAttribute('data-dsh-a11y-focus', settings.focusRing === 'strong' ? 'strong' : 'default');
      if (settings.motion === 'system') root.removeAttribute('data-dsh-a11y-motion');
      else root.setAttribute('data-dsh-a11y-motion', settings.motion);
    }

    // ---------------------------------------------------------------------
    // Announcement bus. One pair of live regions lives in shell.overlay; any
    // component (coordinator, settings test button) pushes through this bus.
    // Fast tool start/finish pairs merge so a short call is spoken once.
    // ---------------------------------------------------------------------
    function createAnnouncementBus(store) {
      let snapshot = Object.freeze({ polite: '', assertive: '' });
      const listeners = new Set();
      let queue = [];
      let timer = null;
      let speaking = false;
      let flip = 0;

      function notify() {
        for (const listener of Array.from(listeners)) {
          try {
            listener();
          } catch (error) {
            /* ignore a broken subscriber */
          }
        }
      }

      function setRegion(kind, text) {
        snapshot = Object.freeze({ ...snapshot, [kind]: text });
        notify();
      }

      function decorate(text) {
        flip = flip === 0 ? 1 : 0;
        return flip === 1 ? text + '\u200B' : text;
      }

      function gapMs() {
        const speed = store.get().speed;
        return SPEED_MS[speed] === undefined ? SPEED_MS.normal : SPEED_MS[speed];
      }

      function pump() {
        if (speaking || queue.length === 0) return;
        speaking = true;
        const item = queue.shift();
        setRegion('polite', decorate(item.text));
        timer = window.setTimeout(() => {
          timer = null;
          speaking = false;
          pump();
        }, gapMs());
      }

      function push(text, options = {}) {
        if (typeof text !== 'string' || text === '') return;
        if (!options.force && store.get().verbosity === 'off') return;
        const item = {
          text,
          kind: options.kind || 'announcement',
          mergeKey: options.mergeKey,
        };
        if (options.assertive) {
          setRegion('assertive', decorate(text));
          return;
        }
        queue = mergeAnnouncementQueue(queue, item);
        if (queue.length > 30) queue = queue.slice(queue.length - 30);
        pump();
      }

      function clearAll() {
        if (timer !== null) {
          window.clearTimeout(timer);
          timer = null;
        }
        queue = [];
        listeners.clear();
      }

      const stopStore = store.subscribe(() => {
        if (store.get().verbosity === 'off') {
          queue = [];
          if (timer !== null) {
            window.clearTimeout(timer);
            timer = null;
          }
          speaking = false;
        }
      });

      return {
        getSnapshot() {
          return snapshot;
        },
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        push,
        dispose() {
          stopStore();
          clearAll();
        },
      };
    }

    // ---------------------------------------------------------------------
    // Host focus targets. These are focus management, not content scraping:
    // the approval card publishes `data-approval-key` itself, and the composer
    // publishes `data-composer-input`.
    // ---------------------------------------------------------------------
    function visibleTurnHeadings() {
      if (typeof document === 'undefined') return [];
      const found = [];
      const nodes = document.querySelectorAll('[data-dsh-a11y-turn]');
      for (const node of nodes) {
        if (node instanceof HTMLElement && node.getClientRects().length > 0) found.push(node);
      }
      return found;
    }

    function focusComposer() {
      if (typeof document === 'undefined') return false;
      const input = document.querySelector('[data-composer-input]');
      if (input instanceof HTMLElement) {
        input.focus();
        return true;
      }
      return false;
    }

    function focusConversation() {
      const headings = visibleTurnHeadings();
      if (headings.length > 0) {
        headings[headings.length - 1].focus();
        return true;
      }
      return focusComposer();
    }

    function focusApprovalCard() {
      if (typeof document === 'undefined') return;
      const card = document.querySelector('[data-approval-key]');
      if (!(card instanceof HTMLElement)) return;
      const group = card.querySelector('[role="group"]');
      if (group instanceof HTMLElement) {
        group.focus();
        return;
      }
      const button = card.querySelector('button:not([disabled])');
      if (button instanceof HTMLElement) button.focus();
    }

    // ---------------------------------------------------------------------
    // Styles. Only --dsw-alias-* colors; radii fall back to host tokens.
    // ---------------------------------------------------------------------
    const CSS = `
.dsh-a11y-sr{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;white-space:nowrap!important;border:0!important}
.dsh-a11y-skip{position:fixed;top:calc(var(--dsh-frame-top-clearance,0px) + 8px);left:8px;z-index:10000;box-sizing:border-box;max-width:calc(100vw - 16px);padding:8px 12px;border:1px solid var(--dsw-alias-brand-primary);border-radius:var(--dsw-radius-md,6px);background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;line-height:20px;text-decoration:none;transform:translateY(calc(-100% - 24px));transition:transform 120ms ease;pointer-events:auto}
.dsh-a11y-skip:focus{transform:none;outline:3px solid var(--dsw-alias-brand-primary);outline-offset:2px}
@media (prefers-reduced-motion:reduce){.dsh-a11y-skip{transition:none}}
.dsh-a11y-dock{display:flex;justify-content:center;align-items:center;padding-top:2px}
.dsh-a11y-jump{box-sizing:border-box;min-height:24px;padding:2px 8px;border:0;border-radius:var(--dsw-radius-sm,4px);background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:var(--dsh-content-font-size-secondary,13px);line-height:20px;cursor:pointer}
.dsh-a11y-jump:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}
.dsh-a11y-jump:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dsh-a11y-section{display:flex;flex-direction:column;width:100%;min-width:0}
.dsh-a11y-title{margin:0;color:var(--dsw-alias-label-primary);font-size:16px;font-weight:500;line-height:24px}
.dsh-a11y-intro{margin:6px 0 4px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px;overflow-wrap:anywhere}
.dsh-a11y-note{margin:10px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.dsh-a11y-row{box-sizing:border-box;display:flex;justify-content:space-between;align-items:center;gap:24px;padding:16px 0;border-bottom:.5px solid var(--dsw-alias-border-l2);min-width:0}
.dsh-a11y-row:last-of-type{border-bottom:none}
.dsh-a11y-row-text{min-width:0}
.dsh-a11y-row-title{display:block;color:var(--dsw-alias-label-primary);font-size:14px;line-height:20px;font-weight:400}
.dsh-a11y-row-desc{margin-top:4px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;overflow-wrap:anywhere}
.dsh-a11y-control{flex:none;display:flex;align-items:center;gap:8px;max-width:240px}
.dsh-a11y-select{box-sizing:border-box;min-width:150px;max-width:240px;min-height:32px;padding:0 8px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,6px);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:14px}
.dsh-a11y-select:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dsh-a11y-button{box-sizing:border-box;min-height:32px;padding:4px 12px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,6px);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;cursor:pointer}
.dsh-a11y-button:hover{background:var(--dsw-alias-bg-layer-2)}
.dsh-a11y-button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dsh-a11y-system{margin-top:6px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.dsh-a11y-feedback{min-height:18px;margin:4px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
@media (max-width:520px){
.dsh-a11y-row{flex-direction:column;align-items:stretch;gap:8px}
.dsh-a11y-control{max-width:none}
.dsh-a11y-select{width:100%;max-width:none}
}
html[data-dsh-a11y-focus="strong"] :is(a,button,input,select,textarea,[role="button"],[role="textbox"],[contenteditable="true"],[tabindex]:not([tabindex="-1"])):focus-visible{outline:3px solid var(--dsw-alias-brand-primary)!important;outline-offset:2px!important}
html[data-dsh-a11y-motion="reduce"] *,html[data-dsh-a11y-motion="reduce"] *::before,html[data-dsh-a11y-motion="reduce"] *::after{animation-duration:.001ms!important;animation-delay:0ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;transition-delay:0ms!important;scroll-behavior:auto!important}
@media (prefers-reduced-motion:reduce){
html[data-dsh-a11y-motion="full"] *:not(svg):not(svg *),html[data-dsh-a11y-motion="full"] *::before,html[data-dsh-a11y-motion="full"] *::after{transition-duration:150ms!important;transition-delay:0s!important;animation-duration:1s!important;animation-delay:0s!important}
}
`;

    function installStyles() {
      if (typeof document === 'undefined') return () => {};
      const existing = document.querySelector(`style[data-plugin-css="${STYLE_TAG_ID}"]`);
      if (existing !== null) existing.remove();
      const tag = document.createElement('style');
      tag.dataset.plugin = PKG;
      tag.dataset.pluginCss = STYLE_TAG_ID;
      tag.textContent = CSS;
      document.head.appendChild(tag);
      return () => {
        tag.remove();
      };
    }

    // ---------------------------------------------------------------------
    // Components
    // ---------------------------------------------------------------------
    function SkipLink({ t }) {
      return h(
        'nav',
        { 'aria-label': t('skip.nav'), 'data-dsh-a11y-skip-nav': '' },
        h(
          'a',
          {
            className: 'dsh-a11y-skip',
            href: '#dsh-a11y-turn-latest',
            'data-dsh-a11y-skip': '',
            onClick(event) {
              event.preventDefault();
              focusConversation();
            },
          },
          t('skip.label'),
        ),
      );
    }

    function AnnouncementCenter({ a11yBus }) {
      const live = React.useSyncExternalStore(a11yBus.subscribe, a11yBus.getSnapshot, a11yBus.getSnapshot);
      return h(
        'div',
        { 'data-dsh-a11y-live-wrap': '' },
        h('div', {
          className: 'dsh-a11y-sr',
          role: 'status',
          'aria-live': 'polite',
          'aria-atomic': 'true',
          'data-dsh-a11y-live': 'polite',
        }, live.polite),
        h('div', {
          className: 'dsh-a11y-sr',
          role: 'alert',
          'aria-live': 'assertive',
          'aria-atomic': 'true',
          'data-dsh-a11y-live': 'assertive',
        }, live.assertive),
      );
    }

    function ConversationCoordinator(props) {
      const {
        useChat,
        useSessionStatus,
        sessionId,
        t,
        a11yBus,
        a11yStore,
      } = props;
      const runningCalls = useChat((snapshot) => snapshot.legacy.runningCalls);
      const finalizedNodes = useChat((snapshot) => snapshot.legacy.nodes);
      const pendingInteraction = useSessionStatus((snapshot) => {
        if (!snapshot || typeof snapshot.get !== 'function') return undefined;
        const status = snapshot.get(sessionId);
        return status ? status.pendingInteraction : undefined;
      });
      const turnCount = useChat((snapshot) => snapshot.navigation.items().length);
      const tRef = React.useRef(t);
      tRef.current = t;
      const toolRef = React.useRef({
        session: null,
        primed: false,
        maxSeq: 0,
        started: new Map(),
        finished: new Set(),
      });
      const pendingKeyRef = React.useRef(null);
      const previousFocusRef = React.useRef(null);

      // Tool transitions. Start is announced at dispatch (`phase === 'start'`),
      // never for preparing calls; results newer than the prime watermark are
      // live, older ones are history paging and stay silent.
      React.useEffect(() => {
        const state = toolRef.current;
        if (state.session !== sessionId) {
          state.session = sessionId;
          state.primed = false;
          state.maxSeq = 0;
          state.started.clear();
          state.finished.clear();
        }
        if (!state.primed) {
          for (const call of runningCalls) {
            state.started.set(call.callId, {
              name: call.name,
              phase: call.phase,
              announced: false,
            });
          }
          for (const node of finalizedNodes) {
            if (node.kind === 'tool-result') state.finished.add(node.callId);
            if (typeof node.seq === 'number' && node.seq > state.maxSeq) state.maxSeq = node.seq;
          }
          state.primed = true;
          return;
        }

        const announce = a11yStore.get().verbosity !== 'off';
        for (const call of runningCalls) {
          let entry = state.started.get(call.callId);
          if (!entry) {
            entry = { name: call.name, phase: call.phase, announced: false };
            state.started.set(call.callId, entry);
          }
          entry.phase = call.phase;
          if (call.name) entry.name = call.name;
          if (entry.announced || state.finished.has(call.callId)) continue;
          if (call.phase !== 'start') continue;
          entry.announced = true;
          if (announce) {
            a11yBus.push(formatToolStart(tRef.current, entry.name || call.name), {
              kind: 'tool',
              mergeKey: 'tool:' + call.callId,
            });
          }
        }

        for (const node of finalizedNodes) {
          if (node.kind === 'tool-result' && !state.finished.has(node.callId)) {
            const entry = state.started.get(node.callId);
            const live = entry !== undefined
              || (typeof node.seq === 'number' && node.seq > state.maxSeq);
            state.finished.add(node.callId);
            if (live && announce) {
              const seconds = toolDurationSeconds(node);
              a11yBus.push(
                formatToolEnd(tRef.current, {
                  name: (entry && entry.name) || node.name,
                  isError: node.isError === true,
                  summary: toolResultSummary(node),
                  seconds,
                  detailed: a11yStore.get().verbosity === 'detailed',
                }),
                { kind: 'tool', mergeKey: 'tool:' + node.callId },
              );
            }
          }
        }
        for (const node of finalizedNodes) {
          if (typeof node.seq === 'number' && node.seq > state.maxSeq) state.maxSeq = node.seq;
        }
      }, [runningCalls, finalizedNodes, sessionId, a11yBus, a11yStore]);

      // Pending approvals and questions. The host approval card has no live
      // region and no focus move, so this is additive, not duplicated.
      React.useEffect(() => {
        const key = pendingInteraction
          ? String(pendingInteraction.kind) + ':' + String(pendingInteraction.key)
          : null;
        if (key === pendingKeyRef.current) return;
        const previous = pendingKeyRef.current;
        pendingKeyRef.current = key;

        if (key === null) {
          const target = previousFocusRef.current;
          previousFocusRef.current = null;
          if (target instanceof HTMLElement && target.isConnected) {
            try {
              target.focus();
              return;
            } catch (error) {
              /* fall through to the composer */
            }
          }
          if (previous !== null) focusComposer();
          return;
        }

        if (previous !== null) return;
        const settings = a11yStore.get();
        if (settings.verbosity !== 'off') {
          a11yBus.push(formatPending(tRef.current, pendingInteraction), {
            kind: 'pending',
            assertive: true,
          });
        }
        if (pendingInteraction.kind === 'approval') {
          const active = document.activeElement;
          previousFocusRef.current = active instanceof HTMLElement
            && active !== document.body
            && active !== document.documentElement
            ? active
            : null;
          const handle = window.setTimeout(() => {
            focusApprovalCard();
          }, 0);
          return () => {
            window.clearTimeout(handle);
          };
        }
        return undefined;
      }, [pendingInteraction, a11yBus, a11yStore]);

      if (!(turnCount > 0)) return null;
      return h(
        'nav',
        { className: 'dsh-a11y-dock', 'aria-label': t('nav.label') },
        h(
          'button',
          {
            type: 'button',
            className: 'dsh-a11y-jump',
            onClick() {
              focusConversation();
            },
          },
          t('nav.latest'),
        ),
      );
    }

    function TurnHeading({ turn, useChat, t }) {
      const latestTurn = useChat((snapshot) => {
        const items = snapshot.navigation.items();
        return items.length === 0 ? undefined : items[items.length - 1].turn;
      });
      const number = turn && typeof turn.turn === 'number' ? turn.turn : 0;
      return h(
        'h2',
        {
          id: latestTurn === number ? 'dsh-a11y-turn-latest' : undefined,
          className: 'dsh-a11y-sr',
          tabIndex: -1,
          'data-dsh-a11y-turn': String(number),
        },
        t('turn.heading', { turn: number, status: turnStatus(t, turn) }),
      );
    }

    function SettingRow({ id, title, description, children, labelFor }) {
      const TitleTag = labelFor ? 'label' : 'div';
      const titleProps = labelFor ? { htmlFor: labelFor } : {};
      return h(
        'div',
        { className: 'dsh-a11y-row' },
        h(
          'div',
          { className: 'dsh-a11y-row-text' },
          h(TitleTag, { className: 'dsh-a11y-row-title', ...titleProps }, title),
          h('div', { className: 'dsh-a11y-row-desc', id: id + '-desc' }, description),
        ),
        h('div', { className: 'dsh-a11y-control' }, children),
      );
    }

    function selectOptions(values, labelFor) {
      return values.map((value) => h('option', { key: value, value }, labelFor(value)));
    }

    function AccessibilitySettings(props) {
      const { a11yStore, a11yBus, themeRuntime, onThemeChange, t } = props;
      const settings = React.useSyncExternalStore(
        a11yStore.subscribe,
        a11yStore.get,
        a11yStore.get,
      );
      const canTheme = themeRuntime !== undefined
        && themeRuntime !== null
        && typeof themeRuntime.getTheme === 'function'
        && typeof themeRuntime.setFontSize === 'function';
      const [fontSize, setFontSize] = React.useState(() => {
        if (!canTheme) return 14;
        try {
          const snapshot = themeRuntime.getTheme();
          return snapshot && snapshot.fontSizes && typeof snapshot.fontSizes.text === 'number'
            ? snapshot.fontSizes.text
            : 14;
        } catch (error) {
          return 14;
        }
      });
      const [feedback, setFeedback] = React.useState('');

      React.useEffect(() => {
        if (!canTheme || typeof onThemeChange !== 'function') return undefined;
        return onThemeChange((snapshot) => {
          if (snapshot && snapshot.fontSizes && typeof snapshot.fontSizes.text === 'number') {
            setFontSize(snapshot.fontSizes.text);
          }
        });
      }, [canTheme, onThemeChange]);

      let reducedMotion = false;
      try {
        reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch (error) {
        reducedMotion = false;
      }

      const sizeOptions = Array.from(new Set(TEXT_SIZES.concat([fontSize]))).sort((a, b) => a - b);

      return h(
        'section',
        { className: 'dsh-a11y-section', 'aria-labelledby': 'dsh-a11y-settings-title' },
        h('h2', { id: 'dsh-a11y-settings-title', className: 'dsh-a11y-title' }, t('section.title')),
        h('p', { className: 'dsh-a11y-intro' }, t('section.intro')),

        h(
          SettingRow,
          {
            id: 'dsh-a11y-verbosity',
            title: t('verbosity.title'),
            description: t('verbosity.description'),
            labelFor: 'dsh-a11y-verbosity',
          },
          h(
            'select',
            {
              id: 'dsh-a11y-verbosity',
              className: 'dsh-a11y-select',
              value: settings.verbosity,
              'aria-describedby': 'dsh-a11y-verbosity-desc',
              onChange(event) {
                a11yStore.update({ verbosity: event.target.value });
              },
            },
            selectOptions(['off', 'concise', 'detailed'], (value) => t('verbosity.' + value)),
          ),
        ),

        h(
          SettingRow,
          {
            id: 'dsh-a11y-speed',
            title: t('speed.title'),
            description: t('speed.description'),
            labelFor: 'dsh-a11y-speed',
          },
          h(
            'select',
            {
              id: 'dsh-a11y-speed',
              className: 'dsh-a11y-select',
              value: settings.speed,
              'aria-describedby': 'dsh-a11y-speed-desc',
              onChange(event) {
                a11yStore.update({ speed: event.target.value });
              },
            },
            selectOptions(['fast', 'normal', 'slow'], (value) => t('speed.' + value)),
          ),
        ),

        h(
          SettingRow,
          {
            id: 'dsh-a11y-focus',
            title: t('focus.title'),
            description: t('focus.description'),
            labelFor: 'dsh-a11y-focus',
          },
          h(
            'select',
            {
              id: 'dsh-a11y-focus',
              className: 'dsh-a11y-select',
              value: settings.focusRing,
              'aria-describedby': 'dsh-a11y-focus-desc',
              onChange(event) {
                a11yStore.update({ focusRing: event.target.value });
              },
            },
            selectOptions(['default', 'strong'], (value) => t('focus.' + value)),
          ),
        ),

        h(
          SettingRow,
          {
            id: 'dsh-a11y-motion',
            title: t('motion.title'),
            description: t('motion.description'),
            labelFor: 'dsh-a11y-motion',
          },
          h(
            'div',
            null,
            h(
              'select',
              {
                id: 'dsh-a11y-motion',
                className: 'dsh-a11y-select',
                value: settings.motion,
                'aria-describedby': 'dsh-a11y-motion-desc',
                onChange(event) {
                  a11yStore.update({ motion: event.target.value });
                },
              },
              selectOptions(['system', 'reduce', 'full'], (value) => t('motion.' + value)),
            ),
            h(
              'div',
              { className: 'dsh-a11y-system' },
              reducedMotion ? t('motion.systemReduced') : t('motion.systemFull'),
            ),
          ),
        ),

        canTheme
          ? h(
            SettingRow,
            {
              id: 'dsh-a11y-text',
              title: t('text.title'),
              description: t('text.description'),
              labelFor: 'dsh-a11y-text',
            },
            h(
              'select',
              {
                id: 'dsh-a11y-text',
                className: 'dsh-a11y-select',
                value: String(fontSize),
                'aria-describedby': 'dsh-a11y-text-desc',
                onChange(event) {
                  const px = Number(event.target.value);
                  if (!Number.isInteger(px)) return;
                  try {
                    themeRuntime.setFontSize('text', px);
                  } catch (error) {
                    /* Out-of-range values cannot come from the fixed option list. */
                  }
                },
              },
              sizeOptions.map((px) => h('option', { key: px, value: String(px) }, t('text.px', { px }))),
            ),
          )
          : null,

        h(
          SettingRow,
          { id: 'dsh-a11y-test', title: t('test.title'), description: t('test.description') },
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-a11y-button',
              onClick() {
                a11yBus.push(t('test.spoken'), { force: true, kind: 'test' });
              },
            },
            t('test.button'),
          ),
        ),

        h(
          SettingRow,
          { id: 'dsh-a11y-reset', title: t('reset.title'), description: t('reset.description') },
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-a11y-button',
              onClick() {
                a11yStore.reset();
                if (canTheme) {
                  try {
                    themeRuntime.setFontSize('text', 14);
                  } catch (error) {
                    /* The theme row can be unavailable in a stripped profile. */
                  }
                }
                setFeedback(t('reset.done'));
              },
            },
            t('reset.button'),
          ),
        ),

        h('div', { className: 'dsh-a11y-feedback', role: 'status', 'aria-live': 'polite' }, feedback),
        h('p', { className: 'dsh-a11y-note' }, t('section.storageNote')),
      );
    }

    function SettingsIcon({ size = 16 }) {
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 16 16',
          'aria-hidden': 'true',
          focusable: 'false',
          style: { display: 'block' },
        },
        h('circle', { cx: '8', cy: '3.4', r: '1.6', fill: 'currentColor' }),
        h('path', {
          d: 'M8 5.8v4.4M8 7.1 3.6 5.8M8 7.1l4.4-1.3M8 10.2 5.4 14M8 10.2 10.6 14',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: '1.5',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      );
    }

    // ---------------------------------------------------------------------
    // Plugin installation
    // ---------------------------------------------------------------------
    const inject = ['slots', 'locale', 'theme'];

    function apply(ctx) {
      const store = createSettingsStore(safeStorage());
      const bus = createAnnouncementBus(store);

      ctx.effect(() => {
        try {
          return ctx.locale.register(NS, LOCALE_DICTS);
        } catch (error) {
          console.error('[dsh-a11y] locale registration failed', error);
          return () => {};
        }
      }, 'dsh-a11y: dictionaries');

      const translate = ctx.locale.bind(NS);

      ctx.effect(() => installStyles(), 'dsh-a11y: styles');

      ctx.effect(() => {
        applyGlobalSettings(store.get());
        return () => {
          document.documentElement.removeAttribute('data-dsh-a11y-focus');
          document.documentElement.removeAttribute('data-dsh-a11y-motion');
        };
      }, 'dsh-a11y: initial global settings');
      ctx.effect(() => store.subscribe(() => applyGlobalSettings(store.get())), 'dsh-a11y: global settings');

      ctx.effect(() => {
        function onKeyDown(event) {
          if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
          if (event.key !== 'Tab' || event.shiftKey) return;
          const active = document.activeElement;
          const atRoot = active === null || active === document.body || active === document.documentElement;
          const skip = document.querySelector('[data-dsh-a11y-skip]');
          if (!(skip instanceof HTMLElement)) return;
          if (atRoot) {
            event.preventDefault();
            skip.focus();
            return;
          }
          if (active === skip) {
            event.preventDefault();
            focusConversation();
          }
        }
        document.addEventListener('keydown', onKeyDown, true);
        return () => document.removeEventListener('keydown', onKeyDown, true);
      }, 'dsh-a11y: skip link keyboard entry');

      ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'a11y-skip-link',
        order: 90,
        locale: NS,
      }, SkipLink));

      ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'a11y-announcer',
        order: 91,
        inject: () => ({ a11yBus: bus }),
      }, AnnouncementCenter));

      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'accessibility',
        order: 30,
        label: () => translate('section.nav'),
        locale: NS,
        inject: () => ({
          a11yStore: store,
          a11yBus: bus,
          themeRuntime: ctx.theme,
          onThemeChange: (listener) => ctx.on('theme/change', listener),
        }),
      }, AccessibilitySettings));

      ctx.slots.inject('settings.section.icon', () => ctx.slots.register({
        name: 'settings.section.icon',
        id: 'accessibility',
        order: 30,
      }, SettingsIcon));

      ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
        name: 'conversation.composer.dock',
        id: 'a11y-coordinator',
        order: 2,
        locale: NS,
        inject: () => ({ a11yBus: bus, a11yStore: store }),
      }, ConversationCoordinator));

      ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({
        name: 'conversation.chat.turnTail',
        id: 'a11y-turn-heading',
        order: 1000,
        locale: NS,
      }, TurnHeading));

      ctx.effect(() => () => bus.dispose(), 'dsh-a11y: announcements');
    }

    return {
      inject,
      apply,
      __test: {
        LOCALES: LOCALE_DICTS,
        DEFAULTS,
        normalizeSettings,
        interpolate,
        truncate,
        formatToolStart,
        formatToolEnd,
        formatPending,
        mergeAnnouncementQueue,
        toolResultSummary,
        toolDurationSeconds,
        turnStatus,
        components: {
          SkipLink,
          AnnouncementCenter,
          ConversationCoordinator,
          TurnHeading,
          AccessibilitySettings,
          SettingsIcon,
        },
      },
    };
  },
});
