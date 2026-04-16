document.addEventListener('DOMContentLoaded', () => {
    // Set default date to today
    const dateField = document.getElementById('dateField');
    const today = new Date();
    // Format YYYY-MM-DD
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dateField.value = `${yyyy}-${mm}-${dd}`;

    const form = document.getElementById('waterQualityForm');
    const submitBtn = document.getElementById('submitBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnIcon = submitBtn.querySelector('.btn-icon');
    const spinner = submitBtn.querySelector('.spinner');

    // ==========================================
    // ⚠️ 請填入你的 Google Apps Script Web App URL
    // ==========================================
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwa9cJzlyX6jxNDzh2hYIrP716D68nkXgu5_W4cvDdwNq55P9mR7Z6tejp1LQV0INUp/exec';

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 檢查是否有填寫 URL (避免預設執行)
        if (GOOGLE_SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL') {
            showToast('錯誤: 尚未設定 Google 腳本網址！', true);
            return;
        }

        // 收集表單資料
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // 使用 URLSearchParams 以 urlencoded 傳送
        const payload = new URLSearchParams(data);

        // 修改按鈕 UI 狀態為 Loading
        submitBtn.classList.add('loading');
        btnText.textContent = '傳送中...';
        btnIcon.classList.add('hide');
        btnIcon.style.display = 'none';
        spinner.classList.remove('hide');

        try {
            // 發送請求到 Google Apps Script
            // POST 加上 mode:'no-cors' 可跨域但無法讀取 response
            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: payload
            });

            // 成功提示
            showToast('資料已成功送出！');
            // 清空除日期外的資料以便下一筆輸入，或者保持不動
            // form.reset(); 
            // dateField.value = `${yyyy}-${mm}-${dd}`; 

        } catch (error) {
            console.error('Fetch error:', error);
            showToast('發生錯誤，請檢查網路連線', true);
        } finally {
            // 恢復按鈕 UI 狀態
            submitBtn.classList.remove('loading');
            btnText.textContent = '送出紀錄';
            btnIcon.classList.remove('hide');
            btnIcon.style.display = 'block';
            spinner.classList.add('hide');
        }
    });

    // Toast 顯示函數
    function showToast(message, isError = false) {
        const toast = document.getElementById('toast');
        const toastMessage = toast.querySelector('.toast-message');
        const icon = toast.querySelector('.toast-icon');

        toastMessage.textContent = message;

        if (isError) {
            toast.classList.add('error');
            icon.textContent = 'error';
        } else {
            toast.classList.remove('error');
            icon.textContent = 'check_circle';
        }

        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // ==========================================
    // 語音輸入功能 (Web Speech API)
    // ==========================================
    const voiceBtn = document.getElementById('voiceBtn');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    // ── 快速輸入 modal ──
    const voiceModal = document.getElementById('voiceModal');
    const voiceTextInput = document.getElementById('voiceTextInput');

    // 標籤按鈕點擊 → 若已有此標籤+數值先移除，再插入到末尾
    document.querySelectorAll('.quick-tag-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const label = btn.dataset.label;
            // 逸出正則特殊字元（pH 的 H 無需，但 ORP 等英文無問題）
            const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // 移除「標籤 + 緊接著的數字（含負號和小數點）」
            const removeRx = new RegExp(escaped + '-?\\d*\\.?\\d*', 'g');
            let cur = voiceTextInput.value.replace(removeRx, '');
            // 清理多餘空格
            cur = cur.replace(/\s{2,}/g, ' ').trim();

            // 插入標籤到末尾
            const sep = cur ? ' ' : '';
            voiceTextInput.value = cur + sep + label;
            voiceTextInput.focus();
            const len = voiceTextInput.value.length;
            voiceTextInput.setSelectionRange(len, len);
        });
    });

    // 快速數字按鈕點擊 (解決 Gboard 語音衝突)
    document.querySelectorAll('.num-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault(); // 避免輸入框失去焦點
            if (btn.classList.contains('backspace-btn')) {
                voiceTextInput.value = voiceTextInput.value.slice(0, -1);
            } else {
                voiceTextInput.value += btn.textContent.trim();
            }
            voiceTextInput.focus(); // 讓游標保持在輸入框
        });
    });

    // 取消按鈕
    document.getElementById('voiceModalCancel').addEventListener('click', () => {
        stopRecognition();
        voiceModal.classList.remove('show');
    });

    // 填入表單按鈕
    document.getElementById('voiceModalSubmit').addEventListener('click', () => {
        const raw = voiceTextInput.value.trim();
        if (!raw) { showToast('請先輸入數值', true); return; }
        parseVoiceInput(raw);
        showToast('已填入表單');
        voiceModal.classList.remove('show');
        voiceTextInput.value = '';
    });

    // Enter 鍵直接送出
    voiceTextInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('voiceModalSubmit').click();
    });

    // 點遮罩關閉
    voiceModal.addEventListener('click', (e) => {
        if (e.target === voiceModal) {
            stopRecognition();
            voiceModal.classList.remove('show');
        }
    });

    function openVoiceFallback() {
        voiceTextInput.value = '';
        voiceModal.classList.add('show');
        // 開啟後不自動聚焦，讓使用者先點標籤按鈕
    }

    // ── 語音辨識（背景嘗試） ──
    let recognition = null;
    let isListening = false;

    function stopRecognition() {
        if (recognition && isListening) {
            try { recognition.stop(); } catch (_) {}
        }
    }

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.lang = 'zh-TW';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onresult = (event) => {
            isListening = false;
            const text = event.results[0][0].transcript;
            // 語音成功 → 填入輸入框，使用者可再確認
            voiceTextInput.value = text;
            voiceTextInput.placeholder = '點上方按鈕後輸入數值';
            showToast(`🎙 語音：${text}`);
        };

        recognition.onerror = (event) => {
            console.warn('語音辨識錯誤:', event.error);
            isListening = false;
            voiceTextInput.placeholder = '點上方按鈕後輸入數值';
        };

        recognition.onend = () => {
            isListening = false;
            voiceTextInput.placeholder = '點上方按鈕後輸入數值';
        };
    }

    // 語音按鈕：立刻開啟 modal，同時在背景嘗試語音
    voiceBtn.addEventListener('click', () => {
        // 1. 立刻開啟 modal
        openVoiceFallback();

        // 2. 嘗試語音辨識（若支援）
        if (!recognition || isListening) return;
        try {
            recognition.start();
            isListening = true;
            voiceTextInput.placeholder = '🎙 聆聽中，請說話...';
        } catch (err) {
            console.warn('recognition.start() 失敗:', err);
        }
    });

    function parseVoiceInput(text) {
        // 設定區域
        if (text.includes('生理')) document.querySelector('input[name="area"][value="生理區"]').checked = true;
        if (text.includes('魚病')) document.querySelector('input[name="area"][value="魚病區"]').checked = true;
        if (text.includes('基轉') || text.includes('機轉')) document.querySelector('input[name="area"][value="基轉區"]').checked = true;

        // 擷取數字通用函式
        const parseNum = (rx) => {
            const match = text.match(rx);
            return match ? match[1] : null;
        };

        // ── 關鍵字模式（語音辨識文字 / 帶標籤輸入）──
        const temp = parseNum(/(?:溫度|溫)[^\d]*(\d+\.?\d*)/);
        const ph   = parseNum(/(?:ph|酸鹼|酸|批)[^\d]*(\d+\.?\d*)/i);
        const sal  = parseNum(/(?:鹽度|鹽)[^\d]*(\d+\.?\d*)/);
        const orp  = parseNum(/(?:氧化|還原|orp|o r p)[^\d]*(\d+\.?\d*)/i);

        const hasKeyword = temp || ph || sal || orp;

        if (hasKeyword) {
            // 有關鍵字 → 填入對應欄位
            if (temp) document.getElementById('tempField').value    = parseFloat(temp).toFixed(2);
            if (ph)   document.getElementById('phField').value      = parseFloat(ph).toFixed(2);
            if (sal)  document.getElementById('salinityField').value = parseFloat(sal).toFixed(2);
            if (orp)  document.getElementById('orpField').value     = parseFloat(orp).toFixed(1);
        } else {
            // ── 純數字位置模式（空格 / 逗號分隔）──
            // 依序對應：溫度、pH、鹽度、ORP
            const nums = text.match(/-?\d+\.?\d*/g);
            if (nums) {
                if (nums[0] != null) document.getElementById('tempField').value     = parseFloat(nums[0]).toFixed(2);
                if (nums[1] != null) document.getElementById('phField').value       = parseFloat(nums[1]).toFixed(2);
                if (nums[2] != null) document.getElementById('salinityField').value = parseFloat(nums[2]).toFixed(2);
                if (nums[3] != null) document.getElementById('orpField').value      = parseFloat(nums[3]).toFixed(1);
            }
        }
    }

    // ==========================================
    // 拍照辨識功能 (升級為 OCR.space 雲端 API)
    // ==========================================
    const ocrBtn = document.getElementById('ocrBtn');
    const ocrInput = document.getElementById('ocrInput');

    ocrBtn.addEventListener('click', () => {
        ocrInput.click();
    });

    // ── OCR 彈出選單控制 (美化介面) ──
    const ocrSettingsToggle = document.getElementById('ocrSettingsToggle');
    const ocrSettingsPopup = document.getElementById('ocrSettingsPopup');

    if (ocrSettingsToggle) {
        ocrSettingsToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            ocrSettingsPopup.classList.toggle('show');
        });
    }

    // 點擊外部關閉選單
    document.addEventListener('touchstart', (e) => {
        if (ocrSettingsPopup && ocrSettingsPopup.classList.contains('show')) {
            if (!ocrSettingsPopup.contains(e.target) && e.target.closest('#ocrSettingsToggle') === null) {
                ocrSettingsPopup.classList.remove('show');
            }
        }
    }, {passive: true});

    document.addEventListener('click', (e) => {
        if (ocrSettingsPopup && ocrSettingsPopup.classList.contains('show')) {
            if (!ocrSettingsPopup.contains(e.target) && e.target.closest('#ocrSettingsToggle') === null) {
                ocrSettingsPopup.classList.remove('show');
            }
        }
    });

    // 初始化：讀取儲存的引擎設定，預設為 Engine 1
    const savedEngine = localStorage.getItem('selectedOcrEngine') || '1';
    const targetRadio = document.querySelector(`input[name="ocrEngine"][value="${savedEngine}"]`);
    if (targetRadio) targetRadio.checked = true;
    localStorage.setItem('selectedOcrEngine', savedEngine);

    // 監聽引擎切換並儲存
    document.querySelectorAll('input[name="ocrEngine"]').forEach(radio => {
        radio.addEventListener('change', () => {
            localStorage.setItem('selectedOcrEngine', radio.value);
        });
    });

    // 壓縮圖片：OCR.space 免費版有大小限制，且縮小能加快上傳速度
    function compressImageForApi(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    // 縮小至寬度最多 600px (加速辨識並減少 E101 超時)
                    const MAX_WIDTH = 600;
                    let width = img.width;
                    let height = img.height;
                    if (width > MAX_WIDTH) {
                        height = Math.floor(height * (MAX_WIDTH / width));
                        width = MAX_WIDTH;
                    }
                    canvas.width = width;
                    canvas.height = height;

                    ctx.drawImage(img, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.6); // 降低品質至 0.6 以減少傳輸負擔
                    console.log('壓縮後 Base64 長度:', dataUrl.length);
                    resolve(dataUrl);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    ocrInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        showToast('影像雲端辨識中，請稍候...');
        ocrBtn.classList.add('active');
        ocrBtn.querySelector('span:last-child').textContent = '辨識中...';

        try {
            // 壓縮影像轉成 Base64
            const base64Image = await compressImageForApi(file);

            // 取得目前選擇的 OCREngine
            const selectedEngine = document.querySelector('input[name="ocrEngine"]:checked').value;
            console.log("使用辨識引擎:", selectedEngine);

            // 方案：透過 Google Apps Script 代理傳送 (穩定性強化版)
            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'ocr',
                    base64Image: base64Image,
                    ocrEngine: selectedEngine,
                    language: 'eng',
                    scale: 'true'
                })
            });

            if (!response.ok) {
                throw new Error(`代理伺服器連線失敗 (HTTP ${response.status})`);
            }

            const result = await response.json();
            console.log("OCR Proxy Response (JSON):", result);
            console.log("OCR 回傳結果:", result);

            // 檢查是否為 GAS 噴出的邏輯錯誤 (通常代表腳本未正確部署)
            if (result.status === 'error') {
                throw new Error("GAS 傳回錯誤: " + (result.message || "可能是腳本未部署新版"));
            }

            if (result.IsErroredOnProcessing || !result.ParsedResults) {
                throw new Error("OCR 平台錯誤: " + (result.ErrorMessage || "未知錯誤"));
            }

            const text = result.ParsedResults[0].ParsedText || "";
            console.log("雲端 OCR 原始辨識結果:\n", text);

            let parsedCount = 0;

            // 轉小寫嘗試辨識數值
            let t = text.toLowerCase();
            // 去除所有逗號 (以防被誤判)
            t = t.replace(/,/g, '.');

            // 溫度: 支援 "24.14°c", "24.14c", "24.14oc", "24.14*c"
            const tempMatch = t.match(/(\d+\.\d+)\s*(?:°c|c|oc|0c|ec|ºc)/) || t.match(/(?:temp|c|°c)\s*:?\s*(\d+\.\d+)/);
            if (tempMatch) { document.getElementById('tempField').value = parseFloat(tempMatch[1]).toFixed(2); parsedCount++; }

            // pH: 支援 "7.28ph", "7.28 ph", "ph7.28"
            const phMatch = t.match(/(\d+\.\d+)\s*(?:ph)/) || t.match(/(?:ph)\s*:?\s*(\d+\.\d+)/);
            if (phMatch) { document.getElementById('phField').value = parseFloat(phMatch[1]).toFixed(2); parsedCount++; }



            // 鹽度 Salinity: 支援 "0.03psu", "0.03 psu"
            const salMatch = t.match(/(\d+\.\d+)\s*(?:psu|ppt|sal)/) || t.match(/(?:sal|psu|ppt)\s*:?\s*(\d+\.\d+)/);
            if (salMatch) { document.getElementById('salinityField').value = parseFloat(salMatch[1]).toFixed(2); parsedCount++; }

            // ORP: 支援 "181.1orp", "181.10rp", "181.1 orp"
            const orpMatch = t.match(/(\d+\.?\d*)\s*(?:orp|0rp|mv)/) || t.match(/(?:orp|mv)\s*:?\s*(\d+\.?\d*)/);
            if (orpMatch) { document.getElementById('orpField').value = parseFloat(orpMatch[1]).toFixed(1); parsedCount++; }

            if (parsedCount > 0) {
                showToast(`成功辨識並填入 ${parsedCount} 個數值`);
            } else {
                showToast('辨識完成，未找到明確標籤', true);
            }

            // 永遠彈出文字視窗方便使用者除錯與複製
            alert("雲端 API 辨識文字：\n\n" + text + "\n\n(已自動幫您填入有抓到的數值)");

        } catch (err) {
            console.error('OCR Error Detail:', err);
            
            let errorMsg = err.message;
            if (errorMsg === 'Failed to fetch') {
                errorMsg = '網路連線失敗或被阻擋 (CORS)。請檢查網路，或聯絡開發者更新後端代理。';
            }
            
            showToast('雲端辨識失敗', true);
            alert("辨識錯誤詳情：\n" + errorMsg);
        } finally {
            ocrBtn.classList.remove('active');
            ocrBtn.querySelector('span:last-child').textContent = '拍照 (OCR)';
            ocrInput.value = '';
        }
    });

    // ==========================================
    // 動態切換分區表格連結
    // ==========================================
    const zoneLinkContainer = document.getElementById('zoneLinkContainer');
    const zoneSheetLink = document.getElementById('zoneSheetLink');
    const targetAreaName = document.getElementById('targetAreaName');
    
    const zoneSheetUrls = {
        '生理區': 'https://docs.google.com/spreadsheets/d/1cCSFkOvnTlOHoz3XnfG8XnI3vu2V_SNnb_PHUjYJlNo/edit',
        '魚病區': 'https://docs.google.com/spreadsheets/d/1Y9syI5JchRQU7X_DxEczs5tbqx2FI6QwQ5SFkh5BdEY/edit',
        '基轉區': 'https://docs.google.com/spreadsheets/d/1VpdeeJFgSNLMr0Hpdi8vCuqRPVdmYwSn_H1GmTF_mA8/edit'
    };

    const areaRadios = document.querySelectorAll('input[name="area"]');
    areaRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            updateZoneLink(radio.value);
        });
    });

    function updateZoneLink(areaValue) {
        if (zoneSheetUrls[areaValue]) {
            targetAreaName.textContent = areaValue;
            zoneSheetLink.href = zoneSheetUrls[areaValue];
            zoneLinkContainer.classList.remove('hide');
        } else {
            zoneLinkContainer.classList.add('hide');
        }
    }

    // 擴充原有的 parseVoiceInput，使其在語音填入後也更新連結
    const originalParseVoiceInput = parseVoiceInput;
    parseVoiceInput = (text) => {
        originalParseVoiceInput(text);
        // 檢查哪個 radio 被選中了
        const checkedRadio = document.querySelector('input[name="area"]:checked');
        if (checkedRadio) {
            updateZoneLink(checkedRadio.value);
        }
    };
});
