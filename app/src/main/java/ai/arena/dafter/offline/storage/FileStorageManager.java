package ai.arena.dafter.offline.storage;

import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import java.io.*;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/** Android URI adapter and storage facade. Archive/domain work belongs to managers. */
public final class FileStorageManager {

  private final Context context;
  private final ModelManager models;
  private final ProjectManager projects;

  /** Call on a worker: interrupted imports are recovered before exposing the app. */
  public FileStorageManager(Context context) throws IOException {
    this.context = context.getApplicationContext();
    File imports = new File(context.getFilesDir(), "imports");
    models = new ModelManager(imports);
    projects = new ProjectManager(imports);
    models.recover();
    projects.recover();
  }

  public boolean hasVoskModel() {
    return !models.list().isEmpty();
  }

  public String importedList() {
    StringBuilder text = new StringBuilder();
    for (ModelRecord model : models.list())
      text
        .append(model.assetUrl)
        .append(" (")
        .append(model.size)
        .append("B)\n");
    return text.toString();
  }

  public String getModelList() {
    try {
      JSONArray records = new JSONArray();
      for (ModelRecord model : models.list()) {
        records.put(
          new JSONObject()
            .put("id", model.id)
            .put("name", model.name)
            .put("engine", model.engine)
            .put("assetUrl", model.assetUrl)
            .put("size", model.size)
            .put("state", model.state)
        );
      }
      return new JSONObject()
        .put("version", 1)
        .put("models", records)
        .toString();
    } catch (org.json.JSONException error) {
      return "{\"version\":1,\"models\":[],\"error\":\"MODEL_LIST_FAILED\"}";
    }
  }

  public InputStream openImported(String relative) throws IOException {
    if (!"model-ar/model.tar.gz".equals(relative)) return null;
    return models.openArchive();
  }

  public int importOne(Uri uri, boolean project) throws Exception {
    StorageFiles.checkInterrupted();
    if (!displayName(uri).toLowerCase(Locale.ROOT).endsWith(".zip")) {
      throw new IllegalArgumentException(
        project
          ? "استيراد المشروع يتطلب ZIP"
          : "استيراد Vosk يتطلب ZIP نموذج كامل"
      );
    }
    try (
      InputStream input = context.getContentResolver().openInputStream(uri)
    ) {
      if (input == null) throw new IOException("تعذّرت قراءة الملف المختار");
      return project ? projects.importArchive(input) : models.importVosk(input);
    }
  }

  private String displayName(Uri uri) {
    try (
      Cursor cursor = context
        .getContentResolver()
        .query(
          uri,
          new String[] { OpenableColumns.DISPLAY_NAME },
          null,
          null,
          null
        )
    ) {
      if (cursor != null && cursor.moveToFirst()) {
        int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
        if (
          index >= 0 && cursor.getString(index) != null
        ) return cursor.getString(index);
      }
    } catch (RuntimeException ignored) {
      /* Some document providers omit metadata. */
    }
    String fallback = uri.getLastPathSegment();
    return fallback == null ? "" : fallback;
  }
}
