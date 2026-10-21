package ai.arena.dafter.offline.ui;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;

/** Owns the exactly-once file input callback. */
public final class DocumentPicker {

  private static final int REQUEST = 52;
  private final Activity activity;
  private ValueCallback<Uri[]> pending;

  public DocumentPicker(Activity activity) {
    this.activity = activity;
  }

  public boolean open(
    ValueCallback<Uri[]> callback,
    WebChromeClient.FileChooserParams params
  ) {
    close();
    pending = callback;
    try {
      Intent intent = params.createIntent();
      intent.addCategory(Intent.CATEGORY_OPENABLE);
      activity.startActivityForResult(intent, REQUEST);
    } catch (Exception e) {
      close();
    }
    return true;
  }

  public boolean onResult(int request, int result, Intent data) {
    if (request != REQUEST) return false;
    ValueCallback<Uri[]> callback = pending;
    pending = null;
    if (callback != null) callback.onReceiveValue(
      WebChromeClient.FileChooserParams.parseResult(result, data)
    );
    return true;
  }

  public void close() {
    ValueCallback<Uri[]> callback = pending;
    pending = null;
    if (callback != null) callback.onReceiveValue(null);
  }
}
