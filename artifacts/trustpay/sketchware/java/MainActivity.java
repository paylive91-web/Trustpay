package com.trustpay.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
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
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import org.json.JSONObject;

public class MainActivity extends AppCompatActivity {

    public static final String APP_URL = "https://trustpay-l0xq.onrender.com";

    private WebView webView;
    private ProgressBar progressBar;
    private SwipeRefreshLayout swipeRefresh;

    private ValueCallback<Uri[]> filePathCallback;
    private static final int FILE_CHOOSER_REQ = 2001;

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
        setupNotificationListener();
        webView.loadUrl(APP_URL);
    }

    private void setupNotificationListener() {
        PaymentNotificationService.setCallback(new PaymentNotificationService.NotifCallback() {
            @Override
            public void onPaymentNotif(String title, String body, String pkg) {
                pushNotifToWeb(title, body, pkg);
            }
        });
    }

    private void pushNotifToWeb(final String title, final String body, final String pkg) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    String safeTitle = title.replace("\\", "\\\\").replace("\"", "\\\"")
                            .replace("\n", " ").replace("\r", "");
                    String safeBody  = body.replace("\\", "\\\\").replace("\"", "\\\"")
                            .replace("\n", " ").replace("\r", "");
                    String safePkg   = pkg.replace("\\", "\\\\").replace("\"", "\\\"");
                    String js = "if(window.TrustPayNative && window.TrustPayNative.onNotifReceived)" +
                            "{ window.TrustPayNative.onNotifReceived(\"" + safeTitle + "\",\"" +
                            safeBody + "\",\"" + safePkg + "\"); }";
                    webView.evaluateJavascript(js, null);
                } catch (Exception ignored) {}
            }
        });
    }

    private boolean isNotificationAccessEnabled() {
        String flat = Settings.Secure.getString(getContentResolver(),
                "enabled_notification_listeners");
        if (flat == null || flat.isEmpty()) return false;
        String cmp = new ComponentName(this, PaymentNotificationService.class).flattenToString();
        return flat.contains(getPackageName()) || flat.contains(cmp);
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
        public boolean isNotifPermissionGranted() {
            return isNotificationAccessEnabled();
        }

        @JavascriptInterface
        public void requestSmsPermission() {
            requestNotifPermission();
        }

        @JavascriptInterface
        public void requestSMSPermission() {
            requestNotifPermission();
        }

        @JavascriptInterface
        public void requestNotifPermission() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Intent i = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
                        startActivity(i);
                        Toast.makeText(MainActivity.this,
                                "TrustPay ko 'Allow' karo", Toast.LENGTH_LONG).show();
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this,
                                "Settings open nahi hui", Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }
    }
}
