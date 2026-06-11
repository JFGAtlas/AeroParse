/* ==============================================================================
   AeroParse - Client Logic (JavaScript)
   ============================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const parseForm = document.getElementById('parse-form');
    const shareUrlInput = document.getElementById('share-url');
    const pasteBtn = document.getElementById('paste-btn');
    const submitBtn = document.getElementById('submit-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    
    // Settings elements
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsDrawer = document.getElementById('settings-drawer');
    const apiBaseUrlInput = document.getElementById('api-base-url');
    const saveSettingsBtn = document.getElementById('save-settings');

    // Loader & Result elements
    const loader = document.getElementById('loader');
    const resultCard = document.getElementById('result-card');
    
    // Media elements
    const videoPreviewWrapper = document.getElementById('video-preview-wrapper');
    const videoPlayer = document.getElementById('video-player');
    const imagePreviewWrapper = document.getElementById('image-preview-wrapper');
    const carouselSlides = document.getElementById('carousel-slides');
    const carouselDots = document.getElementById('carousel-dots');
    const carouselPrev = document.getElementById('carousel-prev');
    const carouselNext = document.getElementById('carousel-next');
    const coverDisplayWrapper = document.getElementById('cover-display-wrapper');
    const mediaCover = document.getElementById('media-cover');

    // Details elements
    const authorAvatar = document.getElementById('author-avatar');
    const authorName = document.getElementById('author-name');
    const authorUid = document.getElementById('author-uid');
    const postDesc = document.getElementById('post-desc');
    const metricLikes = document.getElementById('metric-likes');
    const metricComments = document.getElementById('metric-comments');
    const metricShares = document.getElementById('metric-shares');

    // Download buttons
    const videoDownloads = document.getElementById('video-downloads');
    const btnDlVideo = document.getElementById('btn-dl-video');
    const btnDlVideoFallback = document.getElementById('btn-dl-video-fallback');
    const imageDownloads = document.getElementById('image-downloads');
    const btnDlZip = document.getElementById('btn-dl-zip');
    const imageLinksGrid = document.getElementById('image-links-grid');
    const btnDlAudio = document.getElementById('btn-dl-audio');
    const audioDownloadContainer = document.getElementById('audio-download-container');

    // History elements
    const historySection = document.getElementById('history-section');
    const historyList = document.getElementById('history-list');
    const clearHistoryBtn = document.getElementById('clear-history');

    // Global variables
    let currentCarouselIndex = 0;
    let carouselImages = [];
    let apiBaseUrl = localStorage.getItem('aero_api_base_url') || '';

    // Initialize API Base URL Input
    apiBaseUrlInput.value = apiBaseUrl;

    // Load History list initially
    renderHistory();

    // Toggle Settings drawer
    settingsToggle.addEventListener('click', () => {
        settingsDrawer.classList.toggle('hidden');
    });

    // Save Settings
    saveSettingsBtn.addEventListener('click', () => {
        let val = apiBaseUrlInput.value.trim();
        // Remove trailing slash if present
        if (val.endsWith('/')) {
            val = val.slice(0, -1);
        }
        apiBaseUrl = val;
        localStorage.setItem('aero_api_base_url', val);
        showToast('API 基础地址已保存');
        settingsDrawer.classList.add('hidden');
    });

    // Clipboard Paste Helper
    pasteBtn.addEventListener('click', async () => {
        try {
            // Check browser clipboard API permission
            const text = await navigator.clipboard.readText();
            if (text) {
                shareUrlInput.value = text;
                showToast('已从剪贴板粘贴内容');
            } else {
                showToast('剪贴板为空', 'warning');
            }
        } catch (err) {
            showToast('无法读取剪贴板，请手动粘贴', 'warning');
        }
    });

    // Form Submission for Parsing
    parseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rawUrl = shareUrlInput.value.trim();
        if (!rawUrl) return;

        // Clean link extraction helper (match HTTP(S) URLs)
        const urlMatch = rawUrl.match(/https?:\/\/[^\s]+/);
        const cleanUrl = urlMatch ? urlMatch[0] : rawUrl;

        startLoading();

        try {
            const parsedData = await fetchVideoData(cleanUrl);
            displayResults(parsedData, cleanUrl);
            saveToHistory(parsedData, cleanUrl);
        } catch (err) {
            console.error(err);
            showToast(err.message || '解析失败，请检查链接或接口配置', 'error');
            loader.classList.add('hidden');
        } finally {
            stopLoading();
        }
    });

    // Clear History Action
    clearHistoryBtn.addEventListener('click', () => {
        localStorage.removeItem('aero_parse_history');
        renderHistory();
        showToast('历史记录已清除');
    });

    // API Base URL Resolver
    function getApiBase() {
        if (apiBaseUrl) return apiBaseUrl;
        
        // Auto-detect: if served on localhost/relative, use origin
        const origin = window.location.origin;
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
            return 'http://localhost:8000';
        }
        // Default to the public API server if hosted on GitHub Pages or other external static hosts
        return 'https://api.douyin.wtf';
    }

    // Async API Fetcher
    async function fetchVideoData(url) {
        const base = getApiBase();
        let apiUrl = `${base}/api/hybrid/video_data?url=${encodeURIComponent(url)}&minimal=true`;
        
        // If hosted on a remote server (like GitHub Pages) and requesting the default public API,
        // use a browser CORS proxy to bypass CORS restrictions of api.douyin.wtf.
        const origin = window.location.origin;
        if (!origin.includes('localhost') && !origin.includes('127.0.0.1') && base.includes('douyin.wtf')) {
            apiUrl = `https://corsproxy.io/?` + encodeURIComponent(apiUrl);
        }
        
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 20000); // 20s timeout

            const response = await fetch(apiUrl, {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(id);

            if (!response.ok) {
                const errJson = await response.json().catch(() => ({}));
                throw new Error(errJson?.detail?.message || `服务器返回错误 (${response.status})`);
            }

            const json = await response.json();
            if (json.code === 200 && json.data) {
                return json.data;
            } else {
                throw new Error(json.message || '解析返回空数据');
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('解析连接超时，请检查您的网络连接或后端服务器是否在线。');
            }
            throw error;
        }
    }

    // Display parsed results
    function displayResults(data, originalUrl) {
        // Hide loaders & display card
        loader.classList.add('hidden');
        resultCard.classList.remove('hidden');

        // Populate Author details safely
        const author = data.author || {};
        authorName.textContent = author.nickname || '未知用户';
        
        // UID resolver
        const uid = author.unique_id || author.short_id || author.uid || '无';
        authorUid.textContent = `${data.platform === 'douyin' ? '抖音' : 'TikTok'} ID: ${uid}`;
        
        // Avatar resolver
        let avatarUrl = 'https://raw.githubusercontent.com/Evil0ctal/Douyin_TikTok_Download_API/main/logo/logo192.png';
        if (author.avatar_thumb && author.avatar_thumb.url_list && author.avatar_thumb.url_list.length > 0) {
            avatarUrl = author.avatar_thumb.url_list[0];
        } else if (author.avatar_medium && author.avatar_medium.url_list && author.avatar_medium.url_list.length > 0) {
            avatarUrl = author.avatar_medium.url_list[0];
        } else if (author.face) {
            avatarUrl = author.face; // Bilibili avatar
        }
        authorAvatar.src = avatarUrl;

        // Post description & metrics
        postDesc.textContent = data.desc || '这个视频没有填写描述...';
        
        const stats = data.statistics || {};
        metricLikes.textContent = formatNum(stats.digg_count || stats.like_count || stats.like || 0);
        metricComments.textContent = formatNum(stats.comment_count || stats.comment || 0);
        metricShares.textContent = formatNum(stats.share_count || stats.share || 0);

        // Reset display wrappers
        videoPreviewWrapper.classList.add('hidden');
        imagePreviewWrapper.classList.add('hidden');
        coverDisplayWrapper.classList.add('hidden');
        
        // Reset player
        videoPlayer.pause();
        videoPlayer.src = '';

        // Check Media Type
        if (data.type === 'video') {
            videoPreviewWrapper.classList.remove('hidden');
            
            const videoData = data.video_data || {};
            // Determine video address
            const playUrl = videoData.nwm_video_url_HQ || videoData.nwm_video_url || videoData.wm_video_url;
            
            // Set video source
            if (playUrl) {
                videoPlayer.src = playUrl;
                // Add poster
                if (data.cover_data && data.cover_data.cover) {
                    const coverObj = data.cover_data.cover;
                    videoPlayer.poster = typeof coverObj === 'string' ? coverObj : (coverObj.url_list ? coverObj.url_list[0] : '');
                }
            }
            
            // Configure Download Buttons
            videoDownloads.classList.remove('hidden');
            imageDownloads.classList.add('hidden');

            // Set up direct download linking to avoid CORS/Headers issues (resolves 302 stream in the backend)
            const base = getApiBase();
            const downloadUrl = `${base}/api/download?url=${encodeURIComponent(originalUrl)}&with_watermark=false`;
            btnDlVideo.href = downloadUrl;
            btnDlVideoFallback.href = playUrl || '#';
            
        } else if (data.type === 'image') {
            imagePreviewWrapper.classList.remove('hidden');
            videoDownloads.classList.add('hidden');
            imageDownloads.classList.remove('hidden');

            const imageData = data.image_data || {};
            carouselImages = imageData.no_watermark_image_list || [];

            // Render Carousel Slides
            carouselSlides.innerHTML = '';
            carouselDots.innerHTML = '';
            
            if (carouselImages.length > 0) {
                carouselImages.forEach((imgUrl, index) => {
                    // Slide
                    const slide = document.createElement('div');
                    slide.className = 'carousel-slide';
                    const img = document.createElement('img');
                    img.src = imgUrl;
                    img.alt = `图片 ${index + 1}`;
                    slide.appendChild(img);
                    carouselSlides.appendChild(slide);

                    // Dot
                    const dot = document.createElement('div');
                    dot.className = `carousel-dot ${index === 0 ? 'active' : ''}`;
                    dot.addEventListener('click', () => setCarouselIndex(index));
                    carouselDots.appendChild(dot);
                });
                
                // Reset Index
                currentCarouselIndex = 0;
                updateCarouselDisplay();

                // Setup individual image download buttons
                imageLinksGrid.innerHTML = '';
                carouselImages.forEach((imgUrl, idx) => {
                    const btn = document.createElement('a');
                    btn.className = 'img-dl-btn';
                    btn.href = imgUrl;
                    btn.target = '_blank';
                    btn.rel = 'noreferrer';
                    btn.textContent = `图片 ${idx + 1}`;
                    btn.title = '在新标签页打开高清图';
                    imageLinksGrid.appendChild(btn);
                });
            }

            // Set Zip download link
            const base = getApiBase();
            btnDlZip.onclick = () => {
                window.open(`${base}/api/download?url=${encodeURIComponent(originalUrl)}&with_watermark=false`);
            };

        } else {
            // Fallback Cover
            coverDisplayWrapper.classList.remove('hidden');
            if (data.cover_data && data.cover_data.cover) {
                const coverObj = data.cover_data.cover;
                mediaCover.src = typeof coverObj === 'string' ? coverObj : (coverObj.url_list ? coverObj.url_list[0] : '');
            }
            videoDownloads.classList.remove('hidden');
            imageDownloads.classList.add('hidden');
        }

        // Music Download Handler
        if (data.music && (data.music.play_url || data.music.play_url_list)) {
            audioDownloadContainer.classList.remove('hidden');
            let musicUrl = '';
            if (data.music.play_url) {
                musicUrl = typeof data.music.play_url === 'string' ? data.music.play_url : (data.music.play_url.url_list ? data.music.play_url.url_list[0] : '');
            } else if (data.music.play_url_list && data.music.play_url_list.length > 0) {
                musicUrl = data.music.play_url_list[0];
            }
            
            btnDlAudio.href = musicUrl || '#';
        } else {
            audioDownloadContainer.classList.add('hidden');
        }
    }

    // Carousel Slider controllers
    function setCarouselIndex(index) {
        if (index < 0 || index >= carouselImages.length) return;
        currentCarouselIndex = index;
        updateCarouselDisplay();
    }

    function updateCarouselDisplay() {
        if (carouselImages.length === 0) return;
        // Shift transform
        carouselSlides.style.transform = `translateX(-${currentCarouselIndex * 100}%)`;
        
        // Active dot class
        const dots = carouselDots.querySelectorAll('.carousel-dot');
        dots.forEach((dot, idx) => {
            if (idx === currentCarouselIndex) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    carouselPrev.addEventListener('click', () => {
        let prevIdx = currentCarouselIndex - 1;
        if (prevIdx < 0) prevIdx = carouselImages.length - 1;
        setCarouselIndex(prevIdx);
    });

    carouselNext.addEventListener('click', () => {
        let nextIdx = currentCarouselIndex + 1;
        if (nextIdx >= carouselImages.length) nextIdx = 0;
        setCarouselIndex(nextIdx);
    });

    // Loading State Managers
    function startLoading() {
        submitBtn.disabled = true;
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');
        
        // Hide previous results & show loading skeleton
        resultCard.classList.add('hidden');
        loader.classList.remove('hidden');
        
        // Pause player
        videoPlayer.pause();
    }

    function stopLoading() {
        submitBtn.disabled = false;
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
    }

    // LocalStorage History Controllers
    function saveToHistory(data, url) {
        let history = [];
        try {
            history = JSON.parse(localStorage.getItem('aero_parse_history')) || [];
        } catch(e) {
            history = [];
        }

        // Avoid duplicate entries
        history = history.filter(item => item.url !== url);

        // Prep new item
        const author = data.author || {};
        let avatarUrl = 'https://raw.githubusercontent.com/Evil0ctal/Douyin_TikTok_Download_API/main/logo/logo192.png';
        if (author.avatar_thumb && author.avatar_thumb.url_list && author.avatar_thumb.url_list.length > 0) {
            avatarUrl = author.avatar_thumb.url_list[0];
        } else if (author.face) {
            avatarUrl = author.face;
        }

        const historyItem = {
            url: url,
            desc: data.desc || '无描述作品',
            avatar: avatarUrl,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            platform: data.platform
        };

        // Add to front of history queue (limit size to 6)
        history.unshift(historyItem);
        if (history.length > 6) {
            history.pop();
        }

        localStorage.setItem('aero_parse_history', JSON.stringify(history));
        renderHistory();
    }

    function renderHistory() {
        let history = [];
        try {
            history = JSON.parse(localStorage.getItem('aero_parse_history')) || [];
        } catch(e) {
            history = [];
        }

        if (history.length === 0) {
            historySection.classList.add('hidden');
            return;
        }

        historySection.classList.remove('hidden');
        historyList.innerHTML = '';

        history.forEach(item => {
            const el = document.createElement('div');
            el.className = 'history-item';
            el.innerHTML = `
                <div class="history-item-left">
                    <img class="history-avatar" src="${item.avatar}" alt="用户头像">
                    <span class="history-desc" title="${item.desc}">${item.desc}</span>
                </div>
                <div class="history-item-right">
                    <span>${item.time}</span>
                </div>
            `;
            el.addEventListener('click', () => {
                shareUrlInput.value = item.url;
                // Auto trigger submit
                parseForm.dispatchEvent(new Event('submit'));
            });
            historyList.appendChild(el);
        });
    }

    // Utility formatting function (like 124000 -> 12.4w)
    function formatNum(num) {
        if (!num) return '0';
        if (num >= 10000) {
            return (num / 10000).toFixed(1) + 'w';
        }
        return num.toLocaleString();
    }

    // Toast Notifications Trigger
    function showToast(msg, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = msg;
        
        // Remove style class variables
        toast.style.borderColor = 'rgba(255,255,255,0.1)';
        
        if (type === 'error') {
            toast.style.borderColor = 'var(--error-color)';
        } else if (type === 'warning') {
            toast.style.borderColor = 'orange';
        } else {
            toast.style.borderColor = 'var(--success-color)';
        }
        
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
});
