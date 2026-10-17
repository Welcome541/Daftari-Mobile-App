package ai.arena.dafter.offline;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.ContactsContract;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import ai.arena.dafter.offline.bridge.NativeBridge;
import ai.arena.dafter.offline.bridge.UpdateBridge;
import ai.arena.dafter.offline.model.ModelImporter;
import ai.arena.dafter.offline.update.UpdateInstaller;
import ai.arena.dafter.offline.web.WebAssetServer;
import ai.arena.dafter.offline.web.WebRoot;

import java.io.File;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Locale;

/**
 * The hosting activity.
 *
 * Daftari is a hybrid application: a local, offline interface served to a
 * WebView from a synthetic secure origin, plus a thin native layer for the
 * things a web page cannot do on its own (files, contacts, permissions and
 * installing interface updates).
 *
 * The class is deliberately limited to wiring and lifecycle. The pieces it
 * uses live in dedicated classes:
 *
 *   web.WebAssetServer   serves the interface (overlay first, then assets)
 *   web.WebRoot          the overlay directories and their state
 *   update.UpdateInstaller  installs, activates and rolls back updates
 *   model.ModelImporter  unpacks models and projects brought in by the user
 *   bridge.*             the JavaScript facing API
 */
public final class MainActivity extends Activity
        implements NativeBridge.Host, UpdateBridge.Host {

    /* request codes */
    private static final int REQ_VOSK = 42;
    private static final int REQ_PROJECT = 43;
    private static final int REQ_CONTACT = 44;
    private static final int REQ_FILE = 52;
    private static final int REQ_UPDATE = 53;
    private static final int REQ_MIC = 91;
    private static final int REQ_CAMERA = 92;
    private static final int REQ_CONTACTS = 93;

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private PermissionRequest pendingPermission;

    private ModelImporter importer;
    private UpdateInstaller installer;
    private UpdateBridge updateBridge;

    private boolean contactPending;

    /* ------------------------------------------------------------------ */
    /* lifecycle                                                           */
    /* ------------------------------------------------------------------ */

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(0xfff5f5f2);
        getWindow().setNavigationBarColor(0xfff5f5f2);

        File filesDir = getFilesDir();
        File importRoot = new File(filesDir, "imports");
        importer = new ModelImporter(getContentResolver(), filesDir, importRoot);
        importer.prepare();

        WebRoot root = new WebRoot(filesDir);
        installer = new UpdateInstaller(root);
        updateBridge = new UpdateBridge(installer, this);

        WebAssetServer server = new WebAssetServer(this, root, importRoot);

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);

        webView.addJavascriptInterface(new NativeBridge(importer, this), "Daftari");
        webView.addJavascriptInterface(updateBridge, "DaftariUpdate");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return server.serve(request.getUrl());
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                return server.serve(Uri.parse(url));
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (WebAssetServer.HOST.equals(uri.getHost())
                        && "https".equalsIgnoreCase(uri.getScheme())) {
                    return false;
                }
                String scheme = uri.getScheme() == null
                        ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
                if ("tel".equals(scheme) || "sms".equals(scheme) || "mailto".equals(scheme)) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (Exception ignored) {
                        // no handler for this scheme
                    }
                }
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    Intent intent = params.createIntent();
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    startActivityForResult(intent, REQ_FILE);
                    return true;
                } catch (Exception e) {
                    fileCallback = null;
                    callback.onReceiveValue(null);
                    notifyUser("تعذّر فتح مدير الملفات");
                    return true;
                }
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> requestWebPermission(request));
            }

            @Override
            public void onPermissionRequestCanceled(PermissionRequest request) {
                if (pendingPermission == request) pendingPermission = null;
            }
        });

        setContentView(webView);
        webView.loadUrl("https://" + WebAssetServer.HOST + WebAssetServer.PREFIX + "index.html");
    }

    /* ------------------------------------------------------------------ */
    /* NativeBridge.Host                                                   */
    /* ------------------------------------------------------------------ */

    @Override
    public void pickVoskModel() {
        runOnUiThread(() -> pick(REQ_VOSK, true));
    }

    @Override
    public void pickProjectFile() {
        runOnUiThread(() -> pick(REQ_PROJECT, false));
    }

    @Override
    public void pickContact() {
        runOnUiThread(() -> {
            if (hasPermission(Manifest.permission.READ_CONTACTS)) {
                try {
                    startActivityForResult(new Intent(Intent.ACTION_PICK,
                            ContactsContract.CommonDataKinds.Phone.CONTENT_URI), REQ_CONTACT);
                } catch (Exception e) {
                    notifyUser("جهات الاتصال غير متاحة");
                }
            } else if (Build.VERSION.SDK_INT >= 23) {
                requestPermissions(new String[]{Manifest.permission.READ_CONTACTS}, REQ_CONTACTS);
            }
        });
    }

    @Override
    public void notifyUser(String message) {
        runOnUiThread(() -> Toast.makeText(this, message, Toast.LENGTH_LONG).show());
    }

    /* ------------------------------------------------------------------ */
    /* UpdateBridge.Host                                                    */
    /* ------------------------------------------------------------------ */

    @Override
    public void requestUpdatePackage(UpdateBridge bridge) {
        runOnUiThread(() -> {
            try {
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES,
                        new String[]{"application/zip", "application/octet-stream"});
                startActivityForResult(intent, REQ_UPDATE);
            } catch (Exception e) {
                bridge.deliver("{\"ok\":false,\"error\":\"picker-unavailable\"}");
            }
        });
    }

    @Override
    public void reloadInterface() {
        runOnUiThread(() -> {
            if (webView != null) {
                webView.loadUrl("https://" + WebAssetServer.HOST
                        + WebAssetServer.PREFIX + "index.html");
            }
        });
    }

    @Override
    public void deliverUpdateResult(String json) {
        runOnUiThread(() -> {
            if (webView == null) return;
            webView.evaluateJavascript(
                    "window.__dafterUpdateResult&&window.__dafterUpdateResult(" + json + ")", null);
        });
    }

    /* ------------------------------------------------------------------ */
    /* permissions                                                         */
    /* ------------------------------------------------------------------ */

    private boolean hasPermission(String permission) {
        return Build.VERSION.SDK_INT < 23
                || checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED;
    }

    private void requestWebPermission(PermissionRequest request) {
        boolean audio = false;
        boolean video = false;
        boolean valid = true;
        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) audio = true;
            else if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) video = true;
            else valid = false;
        }
        if (!valid || (!audio && !video)) {
            request.deny();
            return;
        }
        if (pendingPermission != null && pendingPermission != request) pendingPermission.deny();
        pendingPermission = request;

        if (Build.VERSION.SDK_INT < 23) {
            pendingPermission = null;
            request.grant(request.getResources());
            return;
        }
        ArrayList<String> needed = new ArrayList<>();
        if (audio && !hasPermission(Manifest.permission.RECORD_AUDIO)) {
            needed.add(Manifest.permission.RECORD_AUDIO);
        }
        if (video && !hasPermission(Manifest.permission.CAMERA)) {
            needed.add(Manifest.permission.CAMERA);
        }
        if (needed.isEmpty()) {
            pendingPermission = null;
            request.grant(request.getResources());
        } else {
            requestPermissions(needed.toArray(new String[0]), audio ? REQ_MIC : REQ_CAMERA);
        }
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if ((code == REQ_MIC || code == REQ_CAMERA) && pendingPermission != null) {
            PermissionRequest request = pendingPermission;
            pendingPermission = null;
            boolean granted = results.length > 0;
            for (int result : results) {
                if (result != PackageManager.PERMISSION_GRANTED) granted = false;
            }
            if (granted) request.grant(request.getResources());
            else request.deny();
        } else if (code == REQ_CONTACTS && results.length > 0
                && results[0] == PackageManager.PERMISSION_GRANTED) {
            try {
                startActivityForResult(new Intent(Intent.ACTION_PICK,
                        ContactsContract.CommonDataKinds.Phone.CONTENT_URI), REQ_CONTACT);
            } catch (Exception e) {
                notifyUser("جهات الاتصال غير متاحة");
            }
        }
    }

    /* ------------------------------------------------------------------ */
    /* file picking                                                        */
    /* ------------------------------------------------------------------ */

    private void pick(int request, boolean multiple) {
        try {
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("*/*");
            intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, multiple);
            startActivityForResult(intent, request);
        } catch (Exception e) {
            notifyUser("تعذّر فتح مدير الملفات");
        }
    }

    @Override
    protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);

        if (request == REQ_FILE) {
            if (fileCallback != null) {
                Uri[] uris = (result == RESULT_OK && data != null)
                        ? WebChromeClient.FileChooserParams.parseResult(result, data) : null;
                fileCallback.onReceiveValue(uris);
                fileCallback = null;
            }
            return;
        }

        if (request == REQ_UPDATE) {
            handleUpdateResult(result, data);
            return;
        }

        if (request == REQ_CONTACT) {
            if (result == RESULT_OK && data != null) contactResult(data.getData());
            return;
        }

        if (result != RESULT_OK || data == null
                || (request != REQ_VOSK && request != REQ_PROJECT)) {
            return;
        }

        ArrayList<Uri> selection = new ArrayList<>(NativeBridge.uris(data));
        boolean project = request == REQ_PROJECT;
        new Thread(() -> {
            String error = null;
            int count = 0;
            try {
                count = importer.importAll(selection, project);
            } catch (Exception e) {
                error = e.getMessage() == null ? "فشل استيراد الملفات" : e.getMessage();
            }
            final String err = error;
            final int imported = count;
            runOnUiThread(() -> {
                if (project) {
                    if (err == null) {
                        webView.loadUrl("https://" + WebAssetServer.HOST
                                + WebAssetServer.PREFIX + "index.html");
                    } else {
                        notifyUser(err);
                    }
                } else if (err != null) {
                    runJs("toastMsg(" + js(err) + ")");
                } else {
                    runJs("toastMsg(window.voskImpMsg?voskImpMsg(false,true):'تم استيراد نموذج Vosk');"
                            + "window.voskReinit&&voskReinit(true)");
                }
            });
        }).start();
    }

    /** Install the update package the user just picked. */
    private void handleUpdateResult(int result, Intent data) {
        if (result != RESULT_OK || data == null || data.getData() == null) {
            updateBridge.deliverResult(null);
            return;
        }
        InputStream stream = null;
        try {
            stream = getContentResolver().openInputStream(data.getData());
        } catch (Exception ignored) {
            stream = null;
        }
        if (stream == null) {
            updateBridge.deliver("{\"ok\":false,\"error\":\"unreadable\"}");
            return;
        }
        new Thread(() -> updateBridge.deliverResult(stream)).start();
    }

    /* ------------------------------------------------------------------ */
    /* contacts                                                            */
    /* ------------------------------------------------------------------ */

    private void contactResult(Uri uri) {
        String name = "";
        String phone = "";
        try (Cursor cursor = getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int nameIndex = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME);
                int phoneIndex = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER);
                if (nameIndex >= 0 && cursor.getString(nameIndex) != null) name = cursor.getString(nameIndex);
                if (phoneIndex >= 0 && cursor.getString(phoneIndex) != null) phone = cursor.getString(phoneIndex);
            }
        } catch (Exception ignored) {
            // a contact without a name or number is not an error
        }
        runJs("window.contactPicked&&contactPicked(" + js(name) + "," + js(phone) + ")");
    }

    /* ------------------------------------------------------------------ */
    /* helpers                                                             */
    /* ------------------------------------------------------------------ */

    private void runJs(String script) {
        runOnUiThread(() -> {
            if (webView != null) webView.evaluateJavascript(script, null);
        });
    }

    /** Quote a string for safe inclusion in a JavaScript expression. */
    private static String js(String value) {
        return "'" + (value == null ? "" : value
                .replace("\\", "\\\\")
                .replace("'", "\\'")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("<", "\\u003c")) + "'";
    }

    /* ------------------------------------------------------------------ */
    /* back navigation                                                     */
    /* ------------------------------------------------------------------ */

    @Override
    public void onBackPressed() {
        if (webView == null) {
            super.onBackPressed();
            return;
        }
        webView.evaluateJavascript(
                "(function(){try{"
                        + "if(window.stack&&stack.length>1){back();return 1}"
                        + "if(document.getElementById('sheetWrap')"
                        + "&&document.getElementById('sheetWrap').classList.contains('open'))"
                        + "{closeSheet();return 1}"
                        + "}catch(e){}return 0})()",
                value -> {
                    if (value == null || value.startsWith("0")) finish();
                });
    }

    @Override
    protected void onDestroy() {
        if (pendingPermission != null) {
            pendingPermission.deny();
            pendingPermission = null;
        }
        if (fileCallback != null) {
            fileCallback.onReceiveValue(null);
            fileCallback = null;
        }
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
