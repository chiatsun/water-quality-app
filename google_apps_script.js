function doPost(e) {
  try {
    var params;
    if (e.postData && e.postData.contents) {
      try {
        params = JSON.parse(e.postData.contents);
      } catch (err) {
        params = e.parameter;
      }
    } else {
      params = e.parameter;
    }

    // ==========================================
    // 新增：OCR 代理模式 (處理拍照辨識 - 穩定性強化版)
    // ==========================================
    if (params.action === 'ocr') {
      var base64Image = params.base64Image;
      if (!base64Image) {
        return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": "缺少圖片資料" }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      var engine = params.ocrEngine || '1';
      var resText = "";

      try {
        if (engine === '3') {
          // --- 方案 A: 使用 Google Drive OCR (最強大的 Google 引擎) ---
          resText = performGoogleOcr(base64Image);
        } else {
          // --- 方案 B: 使用 OCR.space API (原本的方法) ---
          var ocrResponse = UrlFetchApp.fetch('https://api.ocr.space/parse/image', {
            'method': 'post',
            'payload': {
              'apikey': 'helloworld',
              'language': params.language || 'eng',
              'base64Image': base64Image,
              'scale': params.scale || 'true',
              'OCREngine': engine 
            },
            'muteHttpExceptions': true 
          });
          var apiResult = JSON.parse(ocrResponse.getContentText());
          if (apiResult.ParsedResults && apiResult.ParsedResults[0]) {
            resText = apiResult.ParsedResults[0].ParsedText;
          } else {
            throw new Error(apiResult.ErrorMessage || "OCR.space 辨識失敗");
          }
        }

        return ContentService.createTextOutput(JSON.stringify({
          "status": "success",
          "data": resText
        })).setMimeType(ContentService.MimeType.JSON);

      } catch (ocrErr) {
        return ContentService.createTextOutput(JSON.stringify({
          "status": "error",
          "message": "辨識失敗: " + ocrErr.message
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    var dateStr = params.date || '';
    var area = params.area || '';
    var temp = params.temperature || params.temp || '';
    var ph = params.ph || '';
    var salinity = params.salinity || '';
    var orp = params.orp || '';

    if (!dateStr || !area) {
      return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": "缺少日期或區域" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var messages = [];
    var isError = false;

    // ==========================================
    // 動作 1：寫入「總表」 (無腦往下新增一行)
    // ==========================================
    try {
      var masterSheetId = '1S5BwHs2wRPfWwgPlUZ_lgKLCLtA9dndqune02ei80pc';
      var masterSs = SpreadsheetApp.openById(masterSheetId);
      var masterSheet = masterSs.getActiveSheet();

      // 假設總表順序：日期, 區域, 溫度, pH, 鹽度, 氧化還原
      masterSheet.appendRow([dateStr, area, temp, ph, salinity, orp]);
      messages.push("總表已紀錄");
    } catch (err) {
      isError = true;
      messages.push("總表失敗: " + err.message);
    }

    // ==========================================
    // 動作 2：寫入「各區專屬日曆表」 (精準格位覆寫保護)
    // ==========================================
    try {
      var sheetsMap = {
        '生理區': '1cCSFkOvnTlOHoz3XnfG8XnI3vu2V_SNnb_PHUjYJlNo',
        '魚病區': '1Y9syI5JchRQU7X_DxEczs5tbqx2FI6QwQ5SFkh5BdEY',
        '基轉區': '1VpdeeJFgSNLMr0Hpdi8vCuqRPVdmYwSn_H1GmTF_mA8'
      };

      var targetSheetId = sheetsMap[area];
      if (!targetSheetId) {
        throw new Error("未知的測量區域: " + area);
      }

      var ss = SpreadsheetApp.openById(targetSheetId);

      // 計算民國年月
      var dateObj = new Date(dateStr);
      var yearROC = dateObj.getFullYear() - 1911;
      var month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
      var day = dateObj.getDate();

      var sheetName = yearROC + '/' + month;
      var sheet = ss.getSheetByName(sheetName);

      if (!sheet) {
        throw new Error("找不到月份工作表: " + sheetName + "，請先建立");
      }

      var targetRow = day + 2;
      var updatesCount = 0;

      function updateCellIfEmpty(colIndex, value) {
        if (value === '' || value === undefined || value === null) return;
        var cell = sheet.getRange(targetRow, colIndex);
        var currentVal = cell.getValue();
        if (currentVal === '' || currentVal === null) {
          cell.setValue(value);
          updatesCount++;
        }
      }

      updateCellIfEmpty(2, temp);     // B: 溫度
      updateCellIfEmpty(3, ph);       // C: pH
      updateCellIfEmpty(4, salinity); // D: 鹽度
      updateCellIfEmpty(5, orp);      // E: ORP

      messages.push(`分區表填入 ${updatesCount} 格`);
    } catch (err) {
      isError = true;
      messages.push("分區表失敗: " + err.message);
    }

    // 將執行結果回傳
    return ContentService.createTextOutput(JSON.stringify({
      "status": isError ? "warning" : "success",
      "message": messages.join(" | ")
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 使用 Google Drive OCR 進行辨識
 * 需開啟進階服務：Drive API
 */
function performGoogleOcr(base64Data) {
  try {
    // 1. 去除 Base64 前綴並轉為 Blob
    var byteString = Utilities.base64Decode(base64Data.split(',')[1]);
    var blob = Utilities.newBlob(byteString, 'image/jpeg', 'ocr_temp_' + new Date().getTime() + '.jpg');

    // 2. 使用 Drive API (Advanced Service) 建立檔案並啟用 OCR
    // 將 mimeType 設為 GOOGLE_DOCS 會自動轉換為文字
    var resource = {
      title: blob.getName(),
      mimeType: MimeType.GOOGLE_DOCS
    };
    
    // 執行檔案建立 (啟動 OCR)
    // 注意：Drive API v3 使用 create，v2 使用 insert
    var driveFile = Drive.Files.create(resource, blob);
    
    // 3. 讀取產生的文件內容
    var doc = DocumentApp.openById(driveFile.id);
    var text = doc.getBody().getText();
    
    // 4. 清理：刪除產生的暫存文件
    // 注意：在 GAS 的 Drive API v3 中，delete 方法被改名為 remove (避免與 JS 關鍵字衝突)
    Drive.Files.remove(driveFile.id);
    
    return text;
  } catch (e) {
    throw new Error("Google OCR 流程發生錯誤: " + e.message);
  }
}

function doOptions(e) {
  return ContentService.createTextOutput("").setMimeType(ContentService.MimeType.TEXT);
}

function authTrigger() {
  // 這只是用來強迫 Google 跳出授權視窗
  UrlFetchApp.fetch("https://www.google.com");
  Logger.log("授權成功！");
}

