package com.piovuelo.game;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.media.AudioManager;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JsResult;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.google.android.libraries.ads.mobile.sdk.MobileAds;
import com.google.android.libraries.ads.mobile.sdk.h5.H5AdsWebViewClient;
import com.google.android.libraries.ads.mobile.sdk.initialization.InitializationConfig;
import com.google.android.libraries.ads.mobile.sdk.initialization.InitializationStatus;
import com.google.android.libraries.ads.mobile.sdk.initialization.OnAdapterInitializationCompleteListener;

public class MainActivity extends Activity {

    private WebView web;
    private volatile boolean adsReady = false;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        setVolumeControlStream(AudioManager.STREAM_MUSIC);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setLoadWithOverviewMode(false);
        s.setUseWideViewPort(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setBackgroundColor(0xFF0B1020);

        // Los anuncios necesitan cookies de terceros dentro del WebView
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        // El juego (nuestro cliente) sigue gestionando la navegación. Cuando el SDK
        // de ads complete su inicialización se envuelve con H5AdsWebViewClient, en el
        // orden que exige el SDK (initialize -> register) para no lanzar
        // "MobileAds.initialize must be called before using the Google Mobile Ads SDK".
        final WebViewClient juego = new WebViewClient();
        web.setWebViewClient(juego);
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
                result.confirm();
                return true;
            }
        });

        // Arranca el SDK de Google Mobile Ads con el App ID de AdMob
        // (res/values/strings.xml -> admob_app_id). El juego carga de inmediato;
        // los anuncios se activan cuando el SDK reporte inicialización completa.
        try {
            MobileAds.initialize(this,
                    new InitializationConfig.Builder(getString(R.string.admob_app_id)).build(),
                    new OnAdapterInitializationCompleteListener() {
                        @Override
                        public void onAdapterInitializationComplete(InitializationStatus status) {
                            enableAds(juego);
                        }
                    });
        } catch (Throwable t) {
            // sin SDK inicializado el juego sigue funcionando, solo no hay anuncios
        }

        web.loadUrl("file:///android_asset/index.html");
        setContentView(web);
        hideSystemUI();
    }

    // Activa el cliente de anuncios envolviendo al cliente del juego y registra el
    // puente JS según el orden requerido por el SDK. Se ejecuta en el main thread
    // (el WebView ya está en uso, así que se postea a su looper).
    private void enableAds(final WebViewClient juego) {
        web.post(new Runnable() {
            @Override
            public void run() {
                if (adsReady) return;
                try {
                    H5AdsWebViewClient ads = new H5AdsWebViewClient(web);
                    ads.setDelegateWebViewClient(juego);
                    web.setWebViewClient(ads);
                    MobileAds.registerWebView(web);
                    adsReady = true;
                } catch (Throwable t) {
                    // si el puente de ads falla, el juego sigue con su cliente propio
                }
            }
        });
    }

    private void hideSystemUI() {
        View decor = getWindow().getDecorView();
        int flags = View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE;
        decor.setSystemUiVisibility(flags);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUI();
    }

    @Override
    public void onBackPressed() {
        if (web != null) {
            web.evaluateJavascript(
                "(function(){try{return window.__appShouldExit ? window.__appShouldExit() : false}catch(e){return false}})()",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        boolean exit = value != null && (value.contains("true"));
                        if (exit) {
                            moveTaskToBack(true);
                        } else {
                            web.evaluateJavascript(
                                "(function(){try{if(window.__appBack)window.__appBack()}catch(e){return}})()", null);
                        }
                    }
                });
        } else {
            moveTaskToBack(true);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        hideSystemUI();
        if (web != null) web.onResume();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) web.onPause();
    }
}
