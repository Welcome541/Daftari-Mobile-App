package ai.arena.dafter.offline.bridge;

import android.app.Activity;
import android.webkit.WebView;
import org.json.JSONObject;

/** All asynchronous callbacks are marshalled to the UI thread and stop on destruction. */
public final class JsCallback {

  private final Activity activity;
  private WebView view;

  public JsCallback(Activity activity, WebView view) {
    this.activity = activity;
    this.view = view;
  }

  public void evaluate(String script) {
    activity.runOnUiThread(() -> {
      if (view != null) view.evaluateJavascript(script, null);
    });
  }

  public void event(String type, String message) {
    evaluate(
      "window.DaftariBridge&&window.DaftariBridge.receive(" +
        quote(type) +
        "," +
        quote(message) +
        ")"
    );
  }

  public void reply(
    String id,
    String type,
    Object data,
    String code,
    String message
  ) {
    try {
      JSONObject frame = new JSONObject()
        .put("version", 2)
        .put("id", id)
        .put("type", type);
      if ("success".equals(type)) frame.put(
        "data",
        data == null ? JSONObject.NULL : data
      );
      else if ("progress".equals(type)) frame.put(
        "message",
        message == null ? "" : message
      );
      else frame.put(
        "error",
        new JSONObject().put("code", code).put("message", message)
      );
      evaluate(
        "window.DaftariBridge&&window.DaftariBridge.onResponse(JSON.parse(" +
          quote(frame.toString()) +
          "))"
      );
    } catch (org.json.JSONException error) {
      android.util.Log.e(
        "DaftariBridge",
        "Could not serialize response",
        error
      );
    }
  }

  public static String quote(String value) {
    return JSONObject.quote(value == null ? "" : value)
      .replace("<", "\\u003c")
      .replace("\u2028", "\\u2028")
      .replace("\u2029", "\\u2029");
  }

  public void close() {
    view = null;
  }
}
