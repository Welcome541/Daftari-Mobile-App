package ai.arena.dafter.offline.web;

import android.content.Context;
import android.net.Uri;
import android.webkit.WebResourceResponse;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Serves the interface to the WebView.
 *
 * Every request is answered from a synthetic https origin
 * ({@code https://appassets.androidplatform.net/assets/www/...}), which
 * gives the page a secure context - required for WebAssembly and
 * SharedArrayBuffer - while keeping the app completely offline.
 *
 * Resolution order for a request:
 *   1. the active overlay (an installed update), when it provides the file
 *   2. the imported models / libraries / projects
 *   3. the assets bundled in the APK
 */
public final class WebAssetServer {

    public static final String HOST = "appassets.androidplatform.net";
    public static final String PREFIX = "/assets/www/";

    private final Context context;
    private final WebRoot root;
    private final File importRoot;
    private final File modelDir;
    private final File libDir;
    private final File projectDir;

    public WebAssetServer(Context context, WebRoot root, File importRoot) {
        this.context = context.getApplicationContext();
        this.root = root;
        this.importRoot = importRoot;
        this.modelDir = new File(importRoot, "model-ar");
        this.libDir = new File(importRoot, "lib");
        this.projectDir = new File(importRoot, "proj");
    }

    /* ------------------------------------------------------------------ */
    /* request handling                                                    */
    /* ------------------------------------------------------------------ */

    public WebResourceResponse serve(Uri uri) {
        if (uri == null || !HOST.equals(uri.getHost()) || !"https".equalsIgnoreCase(uri.getScheme())) {
            return reply(403, "Forbidden", "text/plain", new ByteArrayInputStream(new byte[0]));
        }
        String path = uri.getPath();
        if (path == null || "/".equals(path)) path = PREFIX + "index.html";
        if (path.contains("..")) {
            return reply(404, "Not Found", "text/plain", new ByteArrayInputStream(new byte[0]));
        }

        String rel;
        if (path.startsWith(PREFIX)) {
            rel = path.substring(PREFIX.length());
        } else if (path.startsWith("/model-ar/") || path.startsWith("/lib/") || path.startsWith("/proj/")) {
            rel = path.substring(1);
        } else {
            return reply(404, "Not Found", "text/plain", new ByteArrayInputStream(new byte[0]));
        }
        if (rel.isEmpty()) rel = "index.html";

        String safe = WebPaths.normalize(rel);
        if (safe == null) {
            return reply(404, "Not Found", "text/plain", new ByteArrayInputStream(new byte[0]));
        }

        // 1. content the user imported explicitly always wins
        try {
            File imported = imported(safe);
            if (imported != null && imported.isFile()) {
                return reply(200, "OK", mime(safe), new FileInputStream(imported));
            }
        } catch (IOException ignored) {
            // fall through to the bundle
        }

        // 2. an installed update takes precedence over the assets in the APK
        File overlay = root.resolve(safe);
        if (overlay != null) {
            try {
                return reply(200, "OK", mime(safe), new FileInputStream(overlay));
            } catch (IOException ignored) {
                // fall through to the bundled copy
            }
        }

        // 3. the assets bundled in the APK
        try {
            return reply(200, "OK", mime(safe), context.getAssets().open("www/" + safe));
        } catch (IOException | RuntimeException e) {
            return reply(404, "Not Found", "text/plain", new ByteArrayInputStream(new byte[0]));
        }
    }

    /** Resolve a request against the imported content directories. */
    private File imported(String rel) {
        File base;
        String child;
        if (rel.startsWith("model-ar/")) {
            base = modelDir;
            child = rel.substring("model-ar/".length());
        } else if (rel.startsWith("lib/")) {
            base = libDir;
            child = rel.substring("lib/".length());
        } else if (rel.startsWith("proj/")) {
            base = projectDir;
            child = rel.substring("proj/".length());
        } else {
            return null;
        }
        return WebPaths.resolveInside(base, child);
    }

    private static WebResourceResponse reply(int code, String reason, String type, InputStream body) {
        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-store");
        headers.put("Cross-Origin-Opener-Policy", "same-origin");
        headers.put("Cross-Origin-Embedder-Policy", "require-corp");
        headers.put("Cross-Origin-Resource-Policy", "same-origin");
        headers.put("Access-Control-Allow-Origin", "https://" + HOST);
        return new WebResourceResponse(type, "UTF-8", code, reason, headers, body);
    }

    /* ------------------------------------------------------------------ */
    /* content types                                                       */
    /* ------------------------------------------------------------------ */

    public static String mime(String path) {
        String p = path.toLowerCase(Locale.ROOT);
        if (p.endsWith(".html") || p.endsWith(".htm")) return "text/html";
        if (p.endsWith(".js") || p.endsWith(".mjs")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".wasm")) return "application/wasm";
        if (p.endsWith(".json") || p.endsWith(".webmanifest")) return "application/json";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".woff")) return "font/woff";
        if (p.endsWith(".ico")) return "image/x-icon";
        if (p.endsWith(".txt") || p.endsWith(".md")) return "text/plain";
        if (p.endsWith(".zip")) return "application/zip";
        return "application/octet-stream";
    }
}
