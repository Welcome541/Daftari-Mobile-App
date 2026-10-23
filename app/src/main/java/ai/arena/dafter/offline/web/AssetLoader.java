package ai.arena.dafter.offline.web;

import android.net.Uri;
import android.webkit.WebResourceResponse;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

public final class AssetLoader {

  public static final String HOST = "appassets.androidplatform.net",
    PREFIX = "/assets/www/";
  private final android.content.Context context;
  private final ai.arena.dafter.offline.storage.FileStorageManager storage;

  public AssetLoader(
    android.content.Context context,
    ai.arena.dafter.offline.storage.FileStorageManager storage
  ) {
    this.context = context;
    this.storage = storage;
  }

  public WebResourceResponse serve(Uri u) {
    if (
      u == null ||
      u.getPort() != -1 ||
      !HOST.equals(u.getHost()) ||
      !"https".equalsIgnoreCase(u.getScheme())
    ) return reply(
      403,
      "Forbidden",
      "text/plain",
      new ByteArrayInputStream(new byte[0])
    );
    String path = u.getPath();
    if (path == null || "/".equals(path)) path = PREFIX + "index.html";
    if (path.contains("..") || path.contains("\\")) return reply(
      404,
      "Not Found",
      "text/plain",
      new ByteArrayInputStream(new byte[0])
    );
    String rel;
    if (path.startsWith(PREFIX)) rel = path.substring(PREFIX.length());
    else if (
      path.startsWith("/model-ar/") ||
      path.startsWith("/lib/") ||
      path.startsWith("/proj/")
    ) rel = path.substring(1);
    else return reply(
      404,
      "Not Found",
      "text/plain",
      new ByteArrayInputStream(new byte[0])
    );
    if (rel.isEmpty()) rel = "index.html";
    try {
      InputStream imported = storage.openImported(rel);
      if (imported != null) return reply(200, "OK", mime(rel), imported);
      return reply(
        200,
        "OK",
        mime(rel),
        context.getAssets().open("www/" + rel)
      );
    } catch (Exception e) {
      return reply(
        404,
        "Not Found",
        "text/plain",
        new ByteArrayInputStream(new byte[0])
      );
    }
  }

  private WebResourceResponse reply(
    int code,
    String reason,
    String type,
    InputStream body
  ) {
    Map<String, String> h = new HashMap<>();
    h.put("Cache-Control", "no-store");
    h.put("Cross-Origin-Opener-Policy", "same-origin");
    h.put("Cross-Origin-Embedder-Policy", "require-corp");
    h.put("Cross-Origin-Resource-Policy", "same-origin");
    h.put("Access-Control-Allow-Origin", "https://" + HOST);
    return new WebResourceResponse(type, "UTF-8", code, reason, h, body);
  }

  private static String mime(String p) {
    String s = p.toLowerCase(Locale.ROOT);
    if (s.endsWith(".html")) return "text/html";
    if (
      s.endsWith(".js") || s.endsWith(".mjs")
    ) return "application/javascript";
    if (s.endsWith(".css")) return "text/css";
    if (s.endsWith(".wasm")) return "application/wasm";
    if (
      s.endsWith(".json") || s.endsWith(".webmanifest")
    ) return "application/json";
    if (s.endsWith(".png")) return "image/png";
    if (s.endsWith(".svg")) return "image/svg+xml";
    if (s.endsWith(".woff2")) return "font/woff2";
    return "application/octet-stream";
  }
}
