package com.trustpay.app;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

public class PaymentNotificationService extends NotificationListenerService {

    private static PaymentNotificationService sInstance;
    private static volatile NotifCallback sCallback;

    public interface NotifCallback {
        void onPaymentNotif(String title, String body, String pkg);
    }

    public static void setCallback(NotifCallback cb) { sCallback = cb; }

    public static boolean isConnected() { return sInstance != null; }

    @Override
    public void onCreate() {
        super.onCreate();
        sInstance = this;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        sInstance = null;
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null || sCallback == null) return;
        String pkg = sbn.getPackageName();
        if (!isPaymentPkg(pkg)) return;

        Notification n = sbn.getNotification();
        if (n == null) return;
        Bundle ex = n.extras;
        if (ex == null) return;

        CharSequence t = ex.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence b = ex.getCharSequence(Notification.EXTRA_TEXT);
        String title = t != null ? t.toString() : "";
        String body  = b != null ? b.toString() : "";

        if (!title.isEmpty() || !body.isEmpty()) {
            sCallback.onPaymentNotif(title, body, pkg);
        }
    }

    private static boolean isPaymentPkg(String p) {
        if (p == null) return false;
        return p.contains("phonepe")
            || p.contains("google.android.apps.nbu")
            || p.contains("gpay")
            || p.contains("paytm")
            || p.contains("amazon")
            || p.contains("bhim")
            || p.contains("mobikwik")
            || p.contains("whatsapp")
            || p.contains("sbi")
            || p.contains("hdfcbank")
            || p.contains("icicibankltd")
            || p.contains("axisbank")
            || p.contains("kotak")
            || p.contains("yesbank")
            || p.contains("ola")
            || p.contains("freecharge")
            || p.contains("airtel")
            || p.contains("jio")
            || p.contains("upi");
    }
}
