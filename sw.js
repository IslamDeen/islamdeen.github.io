// Install Event
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => caches.delete(cache))
            );
        }).then(() => self.clients.claim())
    );
});

// control/app-config.json থেকে সরাসরি অ্যাপের নাম ও লোগো নিয়ে আসা (কোনো অদৃশ্য ক্যারেক্টার থাকলে তাও ক্লিন করবে)
async function getAppConfig() {
    const urls = ['control/app-config.json', 'app-config.json'];
    for (const url of urls) {
        try {
            const res = await fetch(url, { cache: 'no-store' });
            if (res.ok) {
                const text = await res.text();
                return JSON.parse(text.replace(/[\u200B-\u200D\uFEFF]/g, ''));
            }
        } catch (e) {}
    }
    return {};
}

// Fetch Event - ডাইনামিক PWA ইন্সটল ও pages/ ফোল্ডার অটো-রাউটিং
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const reqUrl = new URL(event.request.url);

    // ১. আলাদা manifest.json ছাড়াই সরাসরি app-config.json থেকে অ্যাপ ইন্সটল করানো
    if (reqUrl.pathname.endsWith('/manifest.json') || reqUrl.pathname === 'manifest.json') {
        event.respondWith(
            getAppConfig().then((config) => {
                const appName = config.appName || '';
                const logoUrl = config.logoUrl || '';
                const dynamicManifest = {
                    name: appName,
                    short_name: appName,
                    description: config.appDescription || '',
                    start_url: './index.html',
                    scope: './',
                    display: 'standalone',
                    background_color: config.backgroundColor || '#f8fafc',
                    theme_color: config.themeColor || '#1b6b5c',
                    orientation: 'portrait-primary',
                    icons: logoUrl ? [
                        { src: logoUrl, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
                        { src: logoUrl, sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
                    ] : []
                };
                return new Response(JSON.stringify(dynamicManifest), {
                    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' }
                });
            })
        );
        return;
    }

    // ২. pages/ ফোল্ডারের ভেতরে থাকা পেজ থেকে হোমপেজ বা অডিও/লোগো খুঁজলে অটোমেটিক ঠিক করে দেওয়া
    event.respondWith(
        fetch(event.request).then((res) => {
            if (res.status === 404 && reqUrl.origin === self.location.origin) {
                if (reqUrl.pathname.includes('/pages/')) {
                    const fallbackPath = reqUrl.pathname.replace('/pages/', '/');
                    return fetch(fallbackPath);
                } else {
                    const pagesPath = '/pages' + (reqUrl.pathname.startsWith('/') ? reqUrl.pathname : '/' + reqUrl.pathname);
                    return fetch(pagesPath).then(r => r.ok ? r : res);
                }
            }
            return res;
        }).catch(() => {
            if (event.request.mode === 'navigate') {
                return new Response(
                    `<!DOCTYPE html>
                    <html lang="bn">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>অফলাইন</title>
                        <style>
                            body { font-family: sans-serif; background: #f8fafc; color: #334155; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; margin: 0; text-align: center; padding: 20px; }
                            .box { background: #fff; padding: 24px; border-radius: 16px; border: 1px solid #e2e8f0; max-width: 300px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
                            h2 { margin: 0 0 8px; font-size: 18px; color: #1b6b5c; }
                            p { margin: 0 0 16px; font-size: 13px; color: #64748b; line-height: 1.5; }
                            button { background: #1b6b5c; color: #fff; border: none; padding: 8px 20px; border-radius: 8px; font-weight: bold; font-size: 13px; cursor: pointer; }
                        </style>
                    </head>
                    <body>
                        <div class="box">
                            <h2>ইন্টারনেট সংযোগ নেই!</h2>
                            <p>অনুগ্রহ করে আপনার ফোনের ইন্টারনেট সংযোগ চালু করে আবার চেষ্টা করুন।</p>
                            <button onclick="window.location.reload()">আবার চেষ্টা করুন</button>
                        </div>
                    </body>
                    </html>`,
                    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
                );
            }
        })
    );
});
