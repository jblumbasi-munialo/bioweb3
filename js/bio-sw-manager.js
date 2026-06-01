// ========== SERVICE WORKER REGISTRATION & MANAGEMENT ==========

class ServiceWorkerManager {
    constructor() {
        this.swPath = './service-worker.js';
        this.registration = null;
        this.updateCheckInterval = 60000; // Check for updates every minute
    }

    async register() {
        if (!('serviceWorker' in navigator)) {
            console.log('⚠️ Service Workers not supported');
            return false;
        }

        if (!featureFlags.isEnabled('serviceWorker')) {
            console.log('Service Worker disabled in feature flags');
            return false;
        }

        try {
            this.registration = await navigator.serviceWorker.register(this.swPath, {
                scope: './',
            });

            console.log('✅ Service Worker registered:', this.registration.scope);

            // Listen for updates
            this.registration.addEventListener('updatefound', () => {
                const newWorker = this.registration.installing;
                console.log('[SW] Update found, installing new version...');

                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('[SW] Update ready! Call swManager.skipWaiting() to activate');
                        this.notifyUpdateAvailable();
                    }
                });
            });

            // Periodically check for updates
            setInterval(() => this.checkForUpdates(), this.updateCheckInterval);

            return true;
        } catch (err) {
            console.error('❌ Service Worker registration failed:', err);
            return false;
        }
    }

    async checkForUpdates() {
        if (this.registration) {
            try {
                await this.registration.update();
                console.log('[SW] Update check completed');
            } catch (err) {
                console.warn('[SW] Update check failed:', err);
            }
        }
    }

    async unregister() {
        if (this.registration) {
            const success = await this.registration.unregister();
            if (success) {
                console.log('✅ Service Worker unregistered');
                this.registration = null;
            }
            return success;
        }
        return false;
    }

    async skipWaiting() {
        if (this.registration && this.registration.waiting) {
            this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            console.log('[SW] Update activated');
            window.location.reload();
        }
    }

    async clearCache() {
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
            console.log('✅ Cache cleared');
        }
    }

    async getCacheSize() {
        return new Promise((channel) => {
            if (navigator.serviceWorker.controller) {
                const messageChannel = new MessageChannel();
                navigator.serviceWorker.controller.postMessage(
                    { type: 'GET_CACHE_SIZE' },
                    [messageChannel.port2]
                );
                messageChannel.port1.onmessage = (event) => {
                    const sizeInMB = (event.data.size / 1024 / 1024).toFixed(2);
                    console.log(`📊 Cache size: ${sizeInMB}MB`);
                    channel(sizeInMB);
                };
            }
        });
    }

    notifyUpdateAvailable() {
        // Show notification with update prompt
        if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification('BioWeb3 Update Available', {
                body: 'A new version is ready. Refresh to activate.',
                icon: './images/icon-192.png',
                tag: 'update-notification',
                requireInteraction: true,
            });

            notification.onclick = () => {
                if (this.registration && this.registration.waiting) {
                    this.skipWaiting();
                }
            };
        }

        // Also show in-app toast
        if (typeof showToast === 'function') {
            showToast(
                'Update available! <button onclick="swManager.skipWaiting()">Activate now</button>',
                'info'
            );
        }
    }

    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then((permission) => {
                if (permission === 'granted') {
                    new Notification('Notifications enabled for BioWeb3');
                }
            });
        }
    }

    getStatus() {
        return {
            registered: !!this.registration,
            scope: this.registration?.scope,
            state: this.registration?.active?.state,
            hasUpdate: !!this.registration?.waiting,
            controllerActive: !!navigator.serviceWorker.controller,
        };
    }
}

// Auto-initialize when feature flags loaded
const swManager = new ServiceWorkerManager();

// Register when document is ready and flags are loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        await featureFlags.load();
        await swManager.register();
    });
} else {
    featureFlags.load().then(() => swManager.register());
}

// Expose in dev mode
if (typeof featureFlags !== 'undefined' && featureFlags.isEnabled('devTools')) {
    window.swManager = swManager;
}
