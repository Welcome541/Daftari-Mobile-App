package ai.arena.dafter.offline.web;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.webkit.*;
import java.util.Locale;

/** Owns the privileged bundled page, navigation policy and WebView lifecycle. */
public final class WebViewHost {

  private final Activity activity;
  private final WebView view;

  @SuppressLint("SetJavaScriptEnabled")
  public WebViewHost(Activity activity, AssetLoader assets) {
    this.activity = activity;
    view = new WebView(activity);
    WebSettings settings = view.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setDatabaseEnabled(true);
    settings.setMediaPlaybackRequiresUserGesture(false);
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(true);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
    view.setWebViewClient(
      new WebViewClient() {
        @Override
        public WebResourceResponse shouldInterceptRequest(
          WebView v,
          WebResourceRequest r
        ) {
          return assets.serve(r.getUrl());
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(
          WebView v,
          String url
        ) {
          return assets.serve(Uri.parse(url));
        }

        @Override
        public boolean shouldOverrideUrlLoading(
          WebView v,
          WebResourceRequest r
        ) {
          return navigate(r.getUrl());
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView v, String url) {
          return navigate(Uri.parse(url));
        }
      }
    );
  }

  private boolean navigate(Uri uri) {
    // Only the packaged entry page may be a privileged top-level document.
    if (
      "https".equals(uri.getScheme()) &&
      AssetLoader.HOST.equals(uri.getHost()) &&
      uri.getPort() == -1 &&
      (AssetLoader.PREFIX + "index.html").equals(uri.getPath())
    ) return false;
    String scheme = uri.getScheme() == null
      ? ""
      : uri.getScheme().toLowerCase(Locale.ROOT);
    if (
      scheme.equals("tel") || scheme.equals("sms") || scheme.equals("mailto")
    ) {
      try {
        activity.startActivity(new Intent(Intent.ACTION_VIEW, uri));
      } catch (android.content.ActivityNotFoundException e) {
        android.widget.Toast.makeText(
          activity,
          "لا يوجد تطبيق لفتح الرابط",
          android.widget.Toast.LENGTH_LONG
        ).show();
      }
    }
    return true;
  }

  public WebView getView() {
    return view;
  }

  public void loadApp() {
    view.loadUrl(
      "https://" + AssetLoader.HOST + AssetLoader.PREFIX + "index.html"
    );
  }

  public void pause() {
    // Explicit lifecycle signal complements document.visibilitychange in WebView.
    view.evaluateJavascript(
      "window.dispatchEvent(new Event('daftari-background'))",
      null
    );
    view.onPause();
  }

  public void resume() {
    view.onResume();
  }

  public void close() {
    view.stopLoading();
    view.removeJavascriptInterface("Daftari");
    view.destroy();
  }
}
