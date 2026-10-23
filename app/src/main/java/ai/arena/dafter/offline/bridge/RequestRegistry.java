package ai.arena.dafter.offline.bridge;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/** UI-thread-owned request lifecycle, independent of Android and JSON. */
public final class RequestRegistry {

  public interface Sink {
    void send(String id, String type, Object data, String code, String message);
  }

  private final Sink sink;
  private final Map<String, Request> pending = new LinkedHashMap<>();
  private final Set<String> completed = new LinkedHashSet<>();
  private boolean closed;

  public RequestRegistry(Sink sink) {
    this.sink = sink;
  }

  public static boolean validId(String id) {
    return id != null && id.matches("[A-Za-z0-9_-]{1,80}");
  }

  public Request begin(String id) {
    if (!validId(id)) throw new IllegalArgumentException("Invalid request ID");
    // A duplicate must not send an error with the original ID and reject the original caller.
    if (pending.containsKey(id) || completed.contains(id)) return null;
    if (closed || pending.size() >= 16) {
      remember(id);
      sink.send(
        id,
        "error",
        null,
        closed ? "CLOSED" : "BUSY",
        "الجسر مغلق أو مشغول"
      );
      return null;
    }
    Request request = new Request(id);
    pending.put(id, request);
    return request;
  }

  public void cancel(String id) {
    Request request = pending.get(id);
    if (request != null) request.abort(
      "CANCELLED",
      "أُلغي انتظار الطلب؛ قد تكون العملية اكتملت قبل الإلغاء"
    );
  }

  public void close() {
    closed = true;
    for (Request request : new ArrayList<>(pending.values()))
      request.abort("CLOSED", "أُغلقت واجهة التطبيق");
  }

  private void remember(String id) {
    completed.add(id);
    if (completed.size() > 256) completed.remove(completed.iterator().next());
  }

  public final class Request {

    public final String id;
    private boolean done, cancelled;
    private Runnable cancellation;

    private Request(String id) {
      this.id = id;
    }

    public boolean isDone() {
      return done;
    }

    public void onCancel(Runnable action) {
      if (cancelled) action.run();
      else if (!done) cancellation = action;
    }

    public void progress(String message) {
      if (!done) sink.send(id, "progress", null, null, message);
    }

    public void succeed(Object data) {
      finish("success", data, null, null);
    }

    public void fail(String code, String message) {
      finish("error", null, code, message);
    }

    private void finish(String type, Object data, String code, String message) {
      if (done) return;
      done = true;
      cancellation = null;
      pending.remove(id);
      remember(id);
      sink.send(id, type, data, code, message);
    }

    private void abort(String code, String message) {
      if (done) return;
      Runnable action = cancellation;
      cancelled = true;
      // Mark terminal before invoking user code, including synchronous completion.
      finish("error", null, code, message);
      if (action != null) {
        try {
          action.run();
        } catch (RuntimeException ignored) {
          /* Terminal reply already sent; keep closing other requests. */
        }
      }
    }
  }
}
