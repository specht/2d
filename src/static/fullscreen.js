// Play the game truly full screen – with a button in the corner (like on
// YouTube) or Alt+Enter. In the studio the game runs inside an iframe; then
// the iframe itself goes full screen, so only the game fills the screen.
(function () {
    // The element that goes full screen and the document that owns it.
    function host() {
        try {
            if (window.parent !== window && window.frameElement)
                return { doc: window.parent.document, el: window.frameElement };
        } catch (e) { /* different origin: use our own page */ }
        return { doc: document, el: document.documentElement };
    }

    function fullscreen_element(doc) {
        return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
    }

    function supported() {
        const { doc } = host();
        return Boolean(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
    }

    function is_fullscreen() {
        const { doc, el } = host();
        return fullscreen_element(doc) === el;
    }

    function toggle() {
        const { doc, el } = host();
        try {
            if (fullscreen_element(doc)) {
                (doc.exitFullscreen ?? doc.webkitExitFullscreen).call(doc);
            } else {
                const request = el.requestFullscreen ?? el.webkitRequestFullscreen;
                const result = request?.call(el, { navigationUI: 'hide' });
                result?.catch?.(() => { });
            }
        } catch (e) { /* the browser refused (e.g. no user action) */ }
        window.focus();
    }
    window.toggle_game_fullscreen = toggle;

    // Alt+Enter (Option+Enter on a Mac), as in many PC games. Capture phase: the
    // game must not also see Enter.
    window.addEventListener('keydown', (e) => {
        if (e.altKey && !e.ctrlKey && !e.metaKey && (e.code === 'Enter' || e.code === 'NumpadEnter')) {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (!e.repeat) toggle();
        }
    }, true);

    const ICON_ENTER = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M3 3h7v2.5H5.5V10H3zm11 0h7v7h-2.5V5.5H14zM3 14h2.5v4.5H10V21H3zm15.5 0H21v7h-7v-2.5h4.5z"/></svg>';
    const ICON_EXIT = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M7.5 3H10v7H3V7.5h4.5zm6.5 0h2.5v4.5H21V10h-7zM3 14h7v7H7.5v-4.5H3zm11 0h7v2.5h-4.5V21H14z"/></svg>';

    document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.textContent = `
            #fullscreen_button {
                position: fixed; right: 1.2vh; bottom: 1.2vh; z-index: 1000;
                width: 44px; height: 44px; padding: 0; border: none; border-radius: 8px;
                display: flex; align-items: center; justify-content: center;
                color: #fff; background: rgba(0, 0, 0, 0.5); cursor: pointer;
                opacity: 0; pointer-events: none; transition: opacity 0.3s ease, transform 0.15s ease;
            }
            #fullscreen_button.visible { opacity: 0.85; pointer-events: auto; }
            #fullscreen_button:hover, #fullscreen_button:focus-visible { opacity: 1; transform: scale(1.08); outline: none; }
            body.fullscreen-idle, body.fullscreen-idle * { cursor: none !important; }
        `;
        document.head.appendChild(style);
        if (!supported()) return;

        const button = document.createElement('button');
        button.id = 'fullscreen_button';
        button.type = 'button';
        // The button must not take the keyboard focus away from the game.
        button.tabIndex = -1;
        button.addEventListener('mousedown', (e) => e.preventDefault());
        button.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
        document.body.appendChild(button);

        const update = () => {
            const full = is_fullscreen();
            button.innerHTML = full ? ICON_EXIT : ICON_ENTER;
            button.title = full ? 'Vollbild beenden (Alt+Enter oder Esc)' : 'Vollbild (Alt+Enter)';
            button.setAttribute('aria-label', button.title);
            window.dispatchEvent(new Event('resize'));
        };
        update();
        const { doc } = host();
        doc.addEventListener('fullscreenchange', update);
        doc.addEventListener('webkitfullscreenchange', update);

        // Like a video player: the button (and in full screen the mouse pointer)
        // shows up when the mouse moves and hides again after a moment.
        let timer = null;
        const wake = () => {
            button.classList.add('visible');
            document.body.classList.remove('fullscreen-idle');
            clearTimeout(timer);
            timer = setTimeout(() => {
                if (button.matches(':hover')) return wake();
                button.classList.remove('visible');
                if (is_fullscreen()) document.body.classList.add('fullscreen-idle');
            }, 2500);
        };
        window.addEventListener('mousemove', wake);
        window.addEventListener('touchstart', wake, { passive: true });
    });
})();
