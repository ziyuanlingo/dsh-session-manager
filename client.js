window.__ModuleLoader__.load({
    id: 'dsh-session-manager',
    factory: (require) => {
        const React = require('react');
        const LOCK_STYLE_ATTR = 'data-session-manager-resize-lock';
        const LOCK_STATE_KEY = '__dshSessionManagerResizeLock';
        const PANEL_ID = 'dsh-session-manager-panel';
        const LANG_STORAGE_KEY = 'dsh_i18n_lang';

        const LABELS = {
            en: {
                tab: 'Session Editor',
                sidebar: 'Session Manager',
                iframeTitle: 'DSH Session Manager & In-Place Editor',
            },
            'zh-CN': {
                tab: '会话编辑/删除',
                sidebar: '会话全权管家',
                iframeTitle: 'DSH 会话管理与原地编辑工作台',
            },
            ja: {
                tab: 'セッション編集・削除',
                sidebar: 'セッション管理',
                iframeTitle: 'DSH セッション管理＆インプレース編集ワークベンチ',
            },
        };

        function resolveInitialLang() {
            try {
                const saved = window.localStorage?.getItem(LANG_STORAGE_KEY);
                if (saved && Object.prototype.hasOwnProperty.call(LABELS, saved)) {
                    return saved;
                }
            } catch { /* ignore storage errors */ }
            return 'en';
        }

        const FRAME_STYLE = {
            width: '100%',
            height: '100%',
            flex: '1 1 auto',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: 0,
        };
        const IFRAME_STYLE = {
            width: '100%',
            height: '100%',
            flex: '1 1 auto',
            minHeight: 0,
            border: 0,
            display: 'block',
        };

        function lockState() {
            const host = window;
            const existing = host[LOCK_STATE_KEY];
            if (existing && typeof existing === 'object' && existing.owners instanceof Set)
                return existing;
            const created = { owners: new Set(), style: null };
            host[LOCK_STATE_KEY] = created;
            return created;
        }

        function applyResizeLock() {
            const state = lockState();
            let style = document.querySelector('style[' + LOCK_STYLE_ATTR + ']');
            if (!style) {
                style = document.createElement('style');
                style.setAttribute(LOCK_STYLE_ATTR, '');
                document.head.appendChild(style);
            }
            style.textContent = '[data-conversation-content]:has([data-session-manager-frame-host]) > [data-width-handle]{display:none!important}';
            state.style = style;
        }

        function releaseResizeLock(token) {
            const state = lockState();
            state.owners.delete(token);
            if (state.owners.size > 0)
                return;
            if (state.style && state.style.isConnected !== false)
                state.style.remove();
            state.style = null;
        }

        function useDshResizeLock() {
            React.useEffect(() => {
                const token = {};
                lockState().owners.add(token);
                applyResizeLock();
                return () => releaseResizeLock(token);
            }, []);
        }

        function buildSrc(sessionId, viewKind) {
            const params = new URLSearchParams();
            if (sessionId)
                params.set('sessionId', sessionId);
            params.set('view', viewKind);
            const qs = params.toString();
            return '/session-manager' + (qs ? '?' + qs : '');
        }

        function ManagerEmbed({ sessionId = '', viewKind = 'main' }) {
            useDshResizeLock();
            const [lang, setLang] = React.useState(resolveInitialLang);
            const src = buildSrc(sessionId, viewKind);

            React.useEffect(() => {
                const onMessage = (event) => {
                    if (event.origin !== window.location.origin)
                        return;
                    const data = event.data;
                    if (!data || typeof data !== 'object')
                        return;
                    if (data.type === 'session-manager:reload-host') {
                        window.location.reload();
                    } else if (data.type === 'dsh-i18n-lang' && Object.prototype.hasOwnProperty.call(LABELS, data.lang)) {
                        setLang(data.lang);
                    }
                };
                window.addEventListener('message', onMessage);
                return () => window.removeEventListener('message', onMessage);
            }, []);

            const dict = LABELS[lang] || LABELS.en;
            return React.createElement(
                'div',
                { style: FRAME_STYLE, 'data-session-manager-frame-host': '' },
                React.createElement('iframe', {
                    title: dict.iframeTitle,
                    src,
                    style: IFRAME_STYLE,
                })
            );
        }

        const ConversationTabView = (props) => {
            const sessionId = props.sessionId ?? props.injected?.sessionId ?? '';
            return React.createElement(ManagerEmbed, { sessionId, viewKind: 'conversation' });
        };

        const MainSidebarPanel = (props) => {
            const currentSessionId = typeof props.useSessions === 'function'
                ? props.useSessions(state => Object.values(state.byId ?? {}).find(s => (s.retainedBy?.mainView ?? 0) > 0)?.id ?? state.current)
                : undefined;
            const sessionId = props.sessionId ?? props.injected?.sessionId ?? currentSessionId ?? '';
            return React.createElement(ManagerEmbed, { sessionId, viewKind: 'main' });
        };

        const ManagerIcon = ({ size = 18 }) => React.createElement(
            'svg',
            {
                width: size,
                height: size,
                viewBox: '0 0 24 24',
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: 1.8,
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
                'aria-hidden': true,
            },
            React.createElement('path', { d: 'M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7.2' }),
            React.createElement('path', { d: 'M4 5.5v11A2.5 2.5 0 0 0 6.5 19H11' }),
            React.createElement('path', { d: 'M8 8h8M8 12h5' }),
            React.createElement('path', { d: 'M15.2 18.8l4.3-4.3a1.4 1.4 0 0 1 2 2l-4.3 4.3-2.6.6.6-2.6z' })
        );

        return {
            inject: ['slots', 'conversation'],
            apply(ctx) {
                const initialDict = LABELS[resolveInitialLang()] || LABELS.en;

                ctx.slots.inject('conversation.view', () => ctx.slots.register({
                    name: 'conversation.view',
                    id: PANEL_ID,
                    order: 28,
                    label: initialDict.tab,
                }, ConversationTabView));

                ctx.slots.inject('main', () => ctx.slots.register({
                    name: 'main',
                    key: PANEL_ID,
                }, MainSidebarPanel));

                ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
                    name: 'sidebar.panellist',
                    id: PANEL_ID,
                    order: 32,
                    label: initialDict.sidebar,
                }, ManagerIcon));
            },
        };
    },
});
