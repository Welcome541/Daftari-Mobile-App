package ai.arena.dafter.offline.bridge;

import android.app.Activity;
import android.webkit.JavascriptInterface;
import org.json.JSONObject;

/** Versioned, allowlisted data protocol. No JavaScript text or filesystem path is accepted. */
public final class AppBridge {

  public interface Actions {
    void pickModel(RequestRegistry.Request request);
    void pickProject(RequestRegistry.Request request);
    void pickContact(RequestRegistry.Request request);
    String importedList();
    String getModelList();
  }

  private final Activity activity;
  private final Actions actions;
  private final JsCallback callbacks;
  private final RequestRegistry requests;

  public AppBridge(Activity activity, Actions actions, JsCallback callbacks) {
    this.activity = activity;
    this.actions = actions;
    this.callbacks = callbacks;
    requests = new RequestRegistry(callbacks::reply);
  }

  @JavascriptInterface
  public void dispatch(String message) {
    if (message == null || message.length() > 8192) return;
    activity.runOnUiThread(() -> handle(message));
  }

  private void handle(String message) {
    String id = null;
    RequestRegistry.Request request = null;
    try {
      JSONObject frame = new JSONObject(message);
      Object rawId = frame.opt("id");
      if (
        !(rawId instanceof String) || !RequestRegistry.validId((String) rawId)
      ) return;
      id = (String) rawId;
      if ("cancel".equals(frame.opt("type"))) {
        if (Integer.valueOf(2).equals(frame.opt("version"))) requests.cancel(
          id
        );
        return;
      }
      request = requests.begin(id);
      if (request == null) return;
      if (!Integer.valueOf(2).equals(frame.opt("version"))) {
        request.fail("UNSUPPORTED_VERSION", "نسخة بروتوكول غير مدعومة");
        return;
      }
      if (!"request".equals(frame.opt("type"))) {
        request.fail("INVALID_REQUEST", "نوع رسالة غير صالح");
        return;
      }
      Object params = frame.opt("params");
      if (
        params != null &&
        (!(params instanceof JSONObject) || ((JSONObject) params).length() != 0)
      ) {
        request.fail(
          "INVALID_PARAMS",
          "هذه العمليات لا تقبل مسارات أو معاملات إضافية"
        );
        return;
      }
      Object method = frame.opt("method");
      if ("model.import".equals(method)) actions.pickModel(request);
      else if ("project.import".equals(method)) actions.pickProject(request);
      else if ("contact.pick".equals(method)) actions.pickContact(request);
      else if ("models.list".equals(method)) {
        JSONObject result = new JSONObject(actions.getModelList());
        if (result.has("error")) request.fail(
          "MODEL_LIST_FAILED",
          "تعذّرت قراءة قائمة النماذج"
        );
        else request.succeed(result);
      } else request.fail("UNKNOWN_METHOD", "عملية غير مدعومة");
    } catch (Exception error) {
      android.util.Log.e("DaftariBridge", "Request failed", error);
      if (request != null) request.fail("REQUEST_FAILED", "تعذّر تنفيذ الطلب");
      else if (RequestRegistry.validId(id)) callbacks.reply(
        id,
        "error",
        null,
        "INVALID_REQUEST",
        "رسالة غير صالحة"
      );
    }
  }

  // Read-only v1 compatibility; all new asynchronous actions use dispatch.
  @JavascriptInterface
  public String importedList() {
    return actions.importedList();
  }

  @JavascriptInterface
  public String getModelList() {
    return actions.getModelList();
  }

  public void close() {
    requests.close();
  }
}
