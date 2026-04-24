# TrustPay — Sketchware Pro Setup Guide (Hinglish)

Ye complete project Sketchware Pro me **manually paste karke** build karna hai.
Sketchware Pro me direct ZIP import nahi hota — har file ka apna section hai.

---

## Step 1 — New Project banao

Sketchware Pro kholo → **New Project**:
- App name: **TrustPay**
- Package name: **com.trustpay.app**
- Project name: **TrustPay**
- Theme: **AppCompat Light NoActionBar**
- Min SDK: **21**
- Target SDK: **34**

Create kar do.

---

## Step 2 — Permissions add karo

Project khol ke → **AndroidManifest** menu → ek-ek karke ye permissions add karo
(ya pura `AndroidManifest.xml` replace kar do is folder se):

- INTERNET
- ACCESS_NETWORK_STATE
- ACCESS_WIFI_STATE
- RECEIVE_SMS
- READ_SMS
- SEND_SMS
- READ_PHONE_STATE
- CAMERA
- RECORD_AUDIO
- VIBRATE
- READ_EXTERNAL_STORAGE
- WRITE_EXTERNAL_STORAGE
- POST_NOTIFICATIONS
- WAKE_LOCK
- FOREGROUND_SERVICE

---

## Step 3 — Java files add karo

**Sketchware Pro → Java Manager (या Java Files)** se ye 3 file add karo:

1. `SplashActivity.java` — `java/SplashActivity.java`
2. `MainActivity.java` — `java/MainActivity.java`
3. `SmsReceiver.java` — `java/SmsReceiver.java`

> Package name `com.trustpay.app` rakhna **mandatory** hai, varna `R.layout` resolve nahi hoga.

---

## Step 4 — Layouts add karo

**Resource Manager → Layouts**:

1. `activity_splash.xml` — splash screen
2. `activity_main.xml` — webview screen

XML directly paste kar do (Sketchware Pro me **XML Editor** option milta hai).

---

## Step 5 — Drawables add karo

**Resource Manager → Drawables**:

1. `splash_gradient.xml`
2. `logo_circle.xml`
3. `ic_launcher.xml`

---

## Step 6 — Values add karo

**Resource Manager → Values**:

- `colors.xml`
- `strings.xml`
- `styles.xml`

---

## Step 7 — Network XML add karo

**Resource Manager → XML (or raw)**:

- `network_security_config.xml`

Manifest ke `<application>` tag me ye attribute add karo:
```
android:networkSecurityConfig="@xml/network_security_config"
```

---

## Step 8 — Launcher fix

Sketchware Pro me **Activity Manager** kholo:
- `SplashActivity` ko **launcher** banao
- `MainActivity` ko **normal activity** rakho
- Default `MainActivity.xml` jo Sketchware bana deta hai usko delete kar do (warna conflict hoga)

---

## Step 9 — Required Libraries

Sketchware Pro → **Library Manager** se ye enable karo:

- AndroidX AppCompat
- AndroidX SwipeRefreshLayout
- AndroidX Core

(Sketchware Pro me built-in mil jata hai)

---

## Step 10 — Build APK

**Run / Build APK** dabao.
APK ban jaye to phone me install karo.

---

## App Flow

1. **Splash screen** (1.5 sec) — gradient + TrustPay logo
2. **Permission popups** (SMS, Phone, Camera, etc.) — user "Allow" dabaye
3. **Main screen** — TrustPay web app load hota hai (`https://trustpay-l0xq.onrender.com`)
4. **Pull-to-refresh** support
5. **Back button** se exit confirmation

---

## Web side se SMS/Toast use karna ho

JS me ye use kar sakte ho:

```javascript
if (window.TrustPay && window.TrustPay.isAndroid) {
    // SMS read
    window.TrustPay.requestSMS();
    const smsList = window.TrustPay.readSMS(50);

    // Toast
    window.TrustPay.toast("Hello from web");

    // Exit
    window.TrustPay.exit();
}
```

---

## Common Issues

- **R.layout error** → Package name match nahi kar raha. `com.trustpay.app` use karo.
- **WebView blank** → Internet permission missing ya URL galat. Manifest check karo.
- **SMS read empty** → Permission deny ho gayi. App settings se manually allow karo.
- **App crash on start** → AppCompat theme parent missing. `styles.xml` paste karo.

---

## URL Change karna ho

`MainActivity.java` me ye line edit karo:

```java
public static final String APP_URL = "https://trustpay-l0xq.onrender.com";
```

Bas. Ho gaya.
