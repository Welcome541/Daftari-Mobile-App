package ai.arena.dafter.offline.ui;

import ai.arena.dafter.offline.bridge.RequestRegistry;
import ai.arena.dafter.offline.storage.FileStorageManager;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Log;
import java.util.ArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

/** One picker/import lease; cancellation never reuses its result slot before draining it. */
public final class ImportCoordinator {

  public static final int MODEL = 42,
    PROJECT = 43;
  private final Activity activity;
  private final FileStorageManager storage;
  private final OperationGate gate;
  private final ExecutorService worker = Executors.newSingleThreadExecutor();
  private Flow active;
  private boolean closed;

  private static final class Flow {

    final boolean project;
    final RequestRegistry.Request request;
    final OperationGate.Lease lease;

    Flow(
      boolean project,
      RequestRegistry.Request request,
      OperationGate.Lease lease
    ) {
      this.project = project;
      this.request = request;
      this.lease = lease;
    }
  }

  public ImportCoordinator(
    Activity activity,
    FileStorageManager storage,
    OperationGate gate
  ) {
    this.activity = activity;
    this.storage = storage;
    this.gate = gate;
  }

  public void pick(boolean project, RequestRegistry.Request request) {
    if (closed) {
      request.fail("CLOSED", "أُغلقت الواجهة");
      return;
    }
    OperationGate.Lease lease = gate.acquire();
    if (lease == null) {
      request.fail("BUSY", "انتظر إغلاق المنتقي أو اكتمال العملية الحالية");
      return;
    }
    Flow flow = new Flow(project, request, lease);
    active = flow;
    request.onCancel(lease::cancel);
    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
    intent.addCategory(Intent.CATEGORY_OPENABLE);
    intent.setType("*/*");
    intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false);
    try {
      activity.startActivityForResult(intent, project ? PROJECT : MODEL);
    } catch (Exception error) {
      finish(flow);
      request.fail("PICKER_UNAVAILABLE", "تعذّر فتح مدير الملفات");
    }
  }

  private void finish(Flow flow) {
    flow.lease.finish();
    if (active == flow) active = null;
  }

  public boolean onResult(int requestCode, int result, Intent data) {
    if (requestCode != MODEL && requestCode != PROJECT) return false;
    Flow flow = active;
    if (
      closed || flow == null || requestCode != (flow.project ? PROJECT : MODEL)
    ) return true;
    if (!flow.lease.claimResult()) return true;
    if (flow.lease.isCancelled()) {
      finish(flow);
      return true;
    }
    if (result != Activity.RESULT_OK || data == null) {
      finish(flow);
      flow.request.fail("CANCELLED", "أُلغي اختيار الملف");
      return true;
    }
    ArrayList<Uri> selected = new ArrayList<>();
    if (data.getClipData() != null) {
      for (int i = 0; i < data.getClipData().getItemCount(); i++) selected.add(
        data.getClipData().getItemAt(i).getUri()
      );
    } else if (data.getData() != null) selected.add(data.getData());
    if (selected.size() != 1) {
      finish(flow);
      flow.request.fail("INVALID_SELECTION", "اختر ملف ZIP واحدًا");
      return true;
    }
    flow.request.progress("جارٍ التحقق والاستيراد…");
    worker.execute(() -> {
      String error = null;
      int count = 0;
      flow.lease.enterWorker();
      try {
        count = storage.importOne(selected.get(0), flow.project);
        if (
          !flow.project && !storage.hasVoskModel()
        ) throw new IllegalArgumentException("لم يتم تجهيز نموذج Vosk");
      } catch (Exception failure) {
        Log.e("DaftariImport", "Import failed", failure);
        error = failure.getMessage() == null
          ? "فشل الاستيراد"
          : failure.getMessage();
      } finally {
        flow.lease.leaveWorker();
      }
      final String message = error;
      final int importedCount = count;
      activity.runOnUiThread(() -> {
        finish(flow);
        if (closed || flow.request.isDone()) return;
        if (message != null) {
          flow.request.fail("IMPORT_FAILED", message);
          return;
        }
        try {
          flow.request.succeed(
            new JSONObject()
              .put("kind", flow.project ? "project" : "vosk")
              .put("files", importedCount)
          );
        } catch (org.json.JSONException failure) {
          flow.request.fail("RESPONSE_FAILED", "تعذّر تجهيز نتيجة الاستيراد");
        }
      });
    });
    return true;
  }

  public void close() {
    closed = true;
    if (active != null) active.lease.cancel();
    worker.shutdownNow();
  }
}
