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
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx6wK2VwGgi0gKS4d0biVR9d_QgepkmV3yIelbug_Wv60I8r7LQwAtch76Ku42rU3Lo/exec';

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

    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'zh-TW';
        recognition.continuous = false;
        recognition.interimResults = false;

        voiceBtn.addEventListener('click', () => {
            recognition.start();
            voiceBtn.classList.add('active');
            voiceBtn.querySelector('span:last-child').textContent = '聆聽中...';
            showToast('請開始說話，例如：「基轉區，溫度26.5」');
        });

        recognition.onresult = (event) => {
            const text = event.results[0][0].transcript;
            showToast(`語音解析：${text}`);
            parseVoiceInput(text);
        };

        recognition.onspeechend = () => {
            recognition.stop();
        };

        recognition.onend = () => {
            voiceBtn.classList.remove('active');
            voiceBtn.querySelector('span:last-child').textContent = '語音填寫';
        };
    } else {
        voiceBtn.style.display = 'none';
        console.warn("此瀏覽器不支援語音辨識");
    }

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

        // 溫度
        const temp = parseNum(/(?:溫度|溫)[^\d]*(\d+\.?\d*)/);
        if (temp) document.getElementById('tempField').value = parseFloat(temp).toFixed(2);

        // pH
        const ph = parseNum(/(?:ph|酸鹼|酸|批)[^\d]*(\d+\.?\d*)/i);
        if (ph) document.getElementById('phField').value = parseFloat(ph).toFixed(2);



        // 鹽度
        const sal = parseNum(/(?:鹽度|鹽)[^\d]*(\d+\.?\d*)/);
        if (sal) document.getElementById('salinityField').value = parseFloat(sal).toFixed(2);

        // 氧化還原
        const orp = parseNum(/(?:氧化|還原|orp|o r p)[^\d]*(\d+\.?\d*)/i);
        if (orp) document.getElementById('orpField').value = parseFloat(orp).toFixed(1);
    }

    // ==========================================
    // 拍照辨識功能 (升級為 OCR.space 雲端 API)
    // ==========================================
    const ocrBtn = document.getElementById('ocrBtn');
    const ocrInput = document.getElementById('ocrInput');

    ocrBtn.addEventListener('click', () => {
        ocrInput.click();
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
                    
                    // 縮小至寬度最多 1200px
                    const MAX_WIDTH = 1200;
                    let width = img.width;
                    let height = img.height;
                    if (width > MAX_WIDTH) {
                        height = Math.floor(height * (MAX_WIDTH / width));
                        width = MAX_WIDTH;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8)); // 輸出 Base64
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

            // 呼叫 OCR.space 雲端 API (使用公共測試金鑰 helloworld)
            const formData = new FormData();
            formData.append('apikey', 'helloworld'); 
            formData.append('language', 'eng');
            formData.append('base64Image', base64Image);
            formData.append('scale', 'true');
            formData.append('OCREngine', '2'); // Engine 2 對於數字和特規字體(LCD)的辨識能力遠勝 Engine 1

            const response = await fetch('https://api.ocr.space/parse/image', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            if (result.IsErroredOnProcessing || !result.ParsedResults) {
                throw new Error("API 錯誤: " + (result.ErrorMessage || "未知錯誤"));
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
            console.error(err);
            showToast('雲端辨識失敗，請稍後重試', true);
            alert("錯誤詳細資訊：\n" + err.message);
        } finally {
            ocrBtn.classList.remove('active');
            ocrBtn.querySelector('span:last-child').textContent = '拍照 (OCR)';
            ocrInput.value = '';
        }
    });
});
