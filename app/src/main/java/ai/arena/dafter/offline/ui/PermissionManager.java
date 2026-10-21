package ai.arena.dafter.offline.ui;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Build;
import android.webkit.PermissionRequest;
import java.util.ArrayList;

/** One outstanding OS permission dialog; only the bundled HTTPS origin is trusted. */
public final class PermissionManager {

  private static final int WEB = 91,
    CONTACTS = 93;
  private final Activity activity;

  public interface ContactResult {
    void complete(boolean granted);
  }

  private ContactResult contactResult;
  private PermissionRequest pending;
  private boolean systemPending;
  private boolean closed;

  public PermissionManager(Activity activity) {
    this.activity = activity;
  }

  private boolean hasPermission(String permission) {
    return (
      Build.VERSION.SDK_INT < 23 ||
      activity.checkSelfPermission(permission) ==
      PackageManager.PERMISSION_GRANTED
    );
  }

  public void requestWebPermission(PermissionRequest request) {
    if (
      closed ||
      systemPending ||
      !"https://appassets.androidplatform.net".equals(
        request.getOrigin().toString().replaceAll("/$", "")
      )
    ) {
      request.deny();
      return;
    }
    ArrayList<String> needed = new ArrayList<>();
    if (request.getResources().length == 0) {
      request.deny();
      return;
    }
    for (String resource : request.getResources()) {
      String permission;
      if (
        PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)
      ) permission = Manifest.permission.RECORD_AUDIO;
      else if (
        PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)
      ) permission = Manifest.permission.CAMERA;
      else {
        request.deny();
        return;
      }
      if (
        !hasPermission(permission) && !needed.contains(permission)
      ) needed.add(permission);
    }
    if (needed.isEmpty()) {
      request.grant(request.getResources());
      return;
    }
    pending = request;
    systemPending = true;
    if (Build.VERSION.SDK_INT >= 23) {
      try {
        activity.requestPermissions(needed.toArray(new String[0]), WEB);
      } catch (RuntimeException error) {
        systemPending = false;
        pending = null;
        request.deny();
      }
    }
  }

  public void requestContacts(ContactResult result) {
    if (closed || systemPending) {
      result.complete(false);
      return;
    }
    if (hasPermission(Manifest.permission.READ_CONTACTS)) {
      result.complete(true);
      return;
    }
    if (Build.VERSION.SDK_INT >= 23) {
      systemPending = true;
      contactResult = result;
      try {
        activity.requestPermissions(
          new String[] { Manifest.permission.READ_CONTACTS },
          CONTACTS
        );
      } catch (RuntimeException error) {
        systemPending = false;
        contactResult = null;
        result.complete(false);
      }
    }
  }

  public void cancel(PermissionRequest request) {
    // Do not clear systemPending: an OS dialog may still return after WebView cancellation.
    if (pending == request) pending = null;
  }

  public void onResult(int code, int[] results) {
    if (code != WEB && code != CONTACTS) return;
    systemPending = false;
    if (closed) return;
    boolean granted = results.length > 0;
    for (int result : results)
      if (result != PackageManager.PERMISSION_GRANTED) granted = false;
    if (code == WEB && pending != null) {
      PermissionRequest request = pending;
      pending = null;
      for (String resource : request.getResources()) {
        if (
          !hasPermission(
            PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)
              ? Manifest.permission.RECORD_AUDIO
              : Manifest.permission.CAMERA
          )
        ) granted = false;
      }
      if (granted) request.grant(request.getResources());
      else request.deny();
    } else if (code == CONTACTS && contactResult != null) {
      ContactResult result = contactResult;
      contactResult = null;
      result.complete(
        granted && hasPermission(Manifest.permission.READ_CONTACTS)
      );
    }
  }

  public void close() {
    closed = true;
    if (contactResult != null) {
      ContactResult result = contactResult;
      contactResult = null;
      result.complete(false);
    }
    if (pending != null) {
      pending.deny();
      pending = null;
    }
  }
}
