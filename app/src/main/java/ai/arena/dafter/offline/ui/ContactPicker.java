package ai.arena.dafter.offline.ui;

import ai.arena.dafter.offline.bridge.RequestRegistry;
import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.provider.ContactsContract;
import org.json.JSONObject;

public final class ContactPicker {

  private static final int REQUEST = 44;
  private final Activity activity;
  private final PermissionManager permissions;
  private final OperationGate gate;
  private RequestRegistry.Request pending;
  private OperationGate.Lease lease;
  private boolean closed;

  public ContactPicker(
    Activity activity,
    PermissionManager permissions,
    OperationGate gate
  ) {
    this.activity = activity;
    this.permissions = permissions;
    this.gate = gate;
  }

  public void pick(RequestRegistry.Request request) {
    if (closed) {
      request.fail("CLOSED", "أُغلقت الواجهة");
      return;
    }
    OperationGate.Lease acquired = gate.acquire();
    if (acquired == null) {
      request.fail("BUSY", "انتظر إغلاق المنتقي الحالي");
      return;
    }
    pending = request;
    lease = acquired;
    request.onCancel(acquired::cancel);
    permissions.requestContacts(granted -> {
      if (closed || acquired.isCancelled()) {
        finish();
        return;
      }
      if (!granted) {
        finish();
        request.fail(
          "PERMISSION_DENIED",
          "لم يُمنح إذن جهات الاتصال أو يوجد طلب إذن آخر"
        );
        return;
      }
      try {
        activity.startActivityForResult(
          new Intent(
            Intent.ACTION_PICK,
            ContactsContract.CommonDataKinds.Phone.CONTENT_URI
          ),
          REQUEST
        );
      } catch (Exception error) {
        finish();
        request.fail("PICKER_UNAVAILABLE", "جهات الاتصال غير متاحة");
      }
    });
  }

  private void finish() {
    if (lease != null) lease.finish();
    lease = null;
    pending = null;
  }

  public boolean onResult(int code, int result, Intent data) {
    if (code != REQUEST) return false;
    if (closed || pending == null) return true;
    RequestRegistry.Request request = pending;
    boolean cancelled = lease.isCancelled();
    finish();
    if (cancelled) return true;
    if (
      result != Activity.RESULT_OK || data == null || data.getData() == null
    ) {
      request.fail("CANCELLED", "أُلغي اختيار جهة الاتصال");
      return true;
    }
    String[] projection = {
      ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
      ContactsContract.CommonDataKinds.Phone.NUMBER,
    };
    try (
      Cursor cursor = activity
        .getContentResolver()
        .query(data.getData(), projection, null, null, null)
    ) {
      if (cursor == null || !cursor.moveToFirst()) {
        request.fail("CONTACT_NOT_FOUND", "لم تُعثر على جهة الاتصال");
        return true;
      }
      request.succeed(
        new JSONObject()
          .put("name", cursor.isNull(0) ? "" : cursor.getString(0))
          .put("phone", cursor.isNull(1) ? "" : cursor.getString(1))
      );
    } catch (Exception error) {
      request.fail("CONTACT_READ_FAILED", "تعذّرت قراءة جهة الاتصال");
    }
    return true;
  }

  public void close() {
    closed = true;
    if (lease != null) lease.cancel();
    finish();
  }
}
