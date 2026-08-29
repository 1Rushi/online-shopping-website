// login-animation.js - Automatic Video Logic

document.addEventListener('DOMContentLoaded', () => {
    const loginScene = document.getElementById('login-scene');
    const video = document.getElementById('login-video');

    if (!loginScene || !video) return;

    // Configuration timestamp (in seconds)
    // Time when the form should emerge over the video
    const FORM_APPEAR_TIMESTAMP = 8.9;

    let hasOpened = false;

    // 1. Play entrance animation automatically
    video.play().catch(e => {
        // Autoplay was prevented by browser, fallback to showing form immediately
        console.warn("Autoplay prevented, showing form immediately.");
        showForm();
    });

    // 2. Listen for the precise moment to show the form
    video.addEventListener('timeupdate', () => {
        if (!hasOpened && video.currentTime >= FORM_APPEAR_TIMESTAMP) {
            hasOpened = true;
            // video.pause(); // Uncomment this if you want the video to freeze when the form appears
            showForm();
        }
    });

    // Also show form if video ends naturally before the timestamp
    video.addEventListener('ended', () => {
        if (!hasOpened) {
            hasOpened = true;
            showForm();
        }
    });

    function showForm() {
        loginScene.classList.remove('is-closed');
        loginScene.classList.add('is-open');

        // Focus the first input of the active tab for accessibility
        setTimeout(() => {
            const activeTab = document.querySelector('.auth-tabs button.active');
            if (activeTab) {
                if (activeTab.id === 'tab-login') {
                    document.getElementById('login-email')?.focus();
                } else if (activeTab.id === 'tab-register') {
                    document.getElementById('register-name')?.focus();
                }
            }
        }, 800); // wait for CSS transition to finish
    }
});
