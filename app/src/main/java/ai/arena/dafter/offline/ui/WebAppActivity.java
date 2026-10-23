package ai.arena.dafter.offline.ui;

import ai.arena.dafter.offline.bridge.AppBridge;
import ai.arena.dafter.offline.bridge.JsCallback;
import ai.arena.dafter.offline.storage.FileStorageManager;
import ai.arena.dafter.offline.web.AssetLoader;
import ai.arena.dafter.offline.web.WebViewHost;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.*;

/** Composition root only: domain work belongs to the injected components. */
public class WebAppActivity extends Activity {

  private WebViewHost host;
  private PermissionManager permissions;
  private DocumentPicker documents;
  private ContactPicker contacts;
  private ImportCoordinator imports;
  private JsCallback callbacks;
  private AppBridge bridge;
  private final java.util.concurrent.ExecutorService startup =
    java.util.concurrent.Executors.newSingleThreadExecutor();
  private boolean destroyed;
  private boolean resumed;

  @Override
  protected void onCreate(Bundle state) {
    super.onCreate(state);
    getWindow().setStatusBarColor(0xfff5f5f2);
    getWindow().setNavigationBarColor(0xfff5f5f2);
    android.widget.TextView loading = new android.widget.TextView(this);
    loading.setText("جارٍ فحص التخزين واسترجاع الاستيراد…");
    loading.setGravity(android.view.Gravity.CENTER);
    setContentView(loading);
    startup.execute(() -> {
      try {
        FileStorageManager storage = new FileStorageManager(
          getApplicationContext()
        );
        runOnUiThread(() -> {
          if (!destroyed && !isFinishing()) attachApp(storage);
        });
      } catch (Exception error) {
        android.util.Log.e("DaftariStorage", "Startup recovery failed", error);
        runOnUiThread(() -> {
          if (destroyed || isFinishing()) return;
          loading.setText(
            "تعذّر فتح التخزين بأمان. أعد تشغيل التطبيق للمحاولة مجددًا. لم تُحذف النسخة السابقة.\n" +
              error.getMessage()
          );
        });
      }
    });
  }

  private void attachApp(FileStorageManager storage) {
    host = new WebViewHost(
      this,
      new AssetLoader(getApplicationContext(), storage)
    );
    callbacks = new JsCallback(this, host.getView());
    OperationGate pickerGate = new OperationGate();
    permissions = new PermissionManager(this);
    contacts = new ContactPicker(this, permissions, pickerGate);
    documents = new DocumentPicker(this);
    imports = new ImportCoordinator(this, storage, pickerGate);
    bridge = new AppBridge(
      this,
      new AppBridge.Actions() {
        public void pickModel(
          ai.arena.dafter.offline.bridge.RequestRegistry.Request request
        ) {
          imports.pick(false, request);
        }

        public void pickProject(
          ai.arena.dafter.offline.bridge.RequestRegistry.Request request
        ) {
          imports.pick(true, request);
        }

        public void pickContact(
          ai.arena.dafter.offline.bridge.RequestRegistry.Request request
        ) {
          contacts.pick(request);
        }

        public String importedList() {
          return storage.importedList();
        }

        public String getModelList() {
          return storage.getModelList();
        }
      },
      callbacks
    );
    host.getView().addJavascriptInterface(bridge, "Daftari");
    host
      .getView()
      .setWebChromeClient(
        new WebChromeClient() {
          @Override
          public boolean onShowFileChooser(
            WebView v,
            ValueCallback<Uri[]> cb,
            FileChooserParams params
          ) {
            return documents.open(cb, params);
          }

          @Override
          public void onPermissionRequest(PermissionRequest request) {
            runOnUiThread(() -> permissions.requestWebPermission(request));
          }

          @Override
          public void onPermissionRequestCanceled(PermissionRequest request) {
            runOnUiThread(() -> permissions.cancel(request));
          }
        }
      );
    setContentView(host.getView());
    host.loadApp();
    if (!resumed) host.pause();
  }

  @Override
  protected void onActivityResult(int request, int result, Intent data) {
    super.onActivityResult(request, result, data);
    if (documents == null) return;
    if (
      !documents.onResult(request, result, data) &&
      !contacts.onResult(request, result, data)
    ) imports.onResult(request, result, data);
  }

  @Override
  public void onRequestPermissionsResult(
    int code,
    String[] names,
    int[] results
  ) {
    super.onRequestPermissionsResult(code, names, results);
    if (permissions != null) permissions.onResult(code, results);
  }

  @Override
  public void onBackPressed() {
    if (host == null) {
      finish();
      return;
    }
    host
      .getView()
      .evaluateJavascript(
        "(function(){try{if(window.stack&&stack.length>1){back();return 1}if(document.getElementById('sheetWrap')&&document.getElementById('sheetWrap').classList.contains('open')){closeSheet();return 1}}catch(e){}return 0})()",
        value -> {
          if (
            !isFinishing() && (value == null || value.startsWith("0"))
          ) finish();
        }
      );
  }

  @Override
  protected void onPause() {
    resumed = false;
    if (host != null) host.pause();
    super.onPause();
  }

  @Override
  protected void onResume() {
    resumed = true;
    super.onResume();
    if (host != null) host.resume();
  }

  @Override
  protected void onDestroy() {
    destroyed = true;
    startup.shutdownNow();
    if (bridge != null) bridge.close();
    if (imports != null) imports.close();
    if (contacts != null) contacts.close();
    if (permissions != null) permissions.close();
    if (documents != null) documents.close();
    if (callbacks != null) callbacks.close();
    if (host != null) host.close();
    super.onDestroy();
  }
}
