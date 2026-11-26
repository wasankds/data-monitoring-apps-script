# data-monitoring-apps-script

ระบบบันทึกข้อมูล Monitoring เข้า Google Sheets ฟรี ด้วย Google Apps Script (รองรับทั้ง `HTTP GET` และ `HTTP POST JSON`)

## โครงสร้างโปรเจกต์
- `src/Code.js` — โค้ด Google Apps Script (`doGet` / `doPost`)
- `src/appsscript.json` — ตั้งค่าโปรเจกต์ Apps Script (`Asia/Bangkok`, `V8`)

## วิธีใช้งาน
1. สร้าง Google Sheets ใหม่ หรือ Copy ไฟล์ตัวอย่างจากในคลิป
2. เปิดเมนู **Extensions > Apps Script** แล้วนำโค้ดจาก `src/Code.js` ไปวาง
3. กด **Deploy > New deployment > Web app** (ตั้งค่า `Execute as: Me` และ `Who has access: Anyone`)
4. นำ Web App URL ที่ได้ไปใช้งานร่วมกับ Browser, Postman, Thunder Client หรืออุปกรณ์ IoT (เช่น Shelly)
