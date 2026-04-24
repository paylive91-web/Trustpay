package com.trustpay.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.telephony.SmsMessage;

public class SmsReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        if (!"android.provider.Telephony.SMS_RECEIVED".equals(intent.getAction())) return;

        Bundle bundle = intent.getExtras();
        if (bundle == null) return;

        try {
            Object[] pdus = (Object[]) bundle.get("pdus");
            if (pdus == null) return;

            String format = bundle.getString("format");
            StringBuilder body = new StringBuilder();
            String sender = "";

            for (Object pdu : pdus) {
                SmsMessage msg;
                if (android.os.Build.VERSION.SDK_INT >= 23) {
                    msg = SmsMessage.createFromPdu((byte[]) pdu, format);
                } else {
                    msg = SmsMessage.createFromPdu((byte[]) pdu);
                }
                if (msg == null) continue;
                sender = msg.getOriginatingAddress();
                body.append(msg.getMessageBody());
            }

            Intent local = new Intent("com.trustpay.app.SMS_RECEIVED");
            local.putExtra("from", sender);
            local.putExtra("body", body.toString());
            context.sendBroadcast(local);
        } catch (Exception ignored) {
        }
    }
}
