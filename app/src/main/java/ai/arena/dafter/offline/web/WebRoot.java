package ai.arena.dafter.offline.web;

import java.io.File;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * The web root: where the interface bundle is read from.
 *
 * Daftari ships one bundle inside the APK, but the running interface can be
 * replaced at runtime. Three directories live side by side inside the app's
 * private storage:
 *
 *   webroot        the bundle that is currently active
 *   webroot.staged a freshly installed bundle waiting to be switched on
 *   webroot.prev   the bundle that was active before, kept for rollback
 *
 * The resolver always prefers the active overlay and falls back to the
 * bundled assets, so a missing or partially removed overlay can never leave
 * the app without an interface.
 */
public final class WebRoot {

    public static final String OVERLAY_DIR = "webroot";
    public static final String STAGED_DIR = "webroot.staged";
    public static final String PREVIOUS_DIR = "webroot.prev";
    public static final String MANIFEST = "version.json";

    private final File overlay;
    private final File staged;
    private final File previous;

    public WebRoot(File filesDir) {
        this.overlay = new File(filesDir, OVERLAY_DIR);
        this.staged = new File(filesDir, STAGED_DIR);
        this.previous = new File(filesDir, PREVIOUS_DIR);
    }

    public File overlay() { return overlay; }
    public File staged() { return staged; }
    public File previous() { return previous; }

    /** True when an installed overlay is present and looks complete. */
    public boolean hasOverlay() {
        return overlay.isDirectory() && new File(overlay, "index.html").isFile();
    }

    /** True when a bundle has been installed and is waiting to be activated. */
    public boolean hasStaged() {
        return staged.isDirectory() && new File(staged, "index.html").isFile();
    }

    /** True when a previous bundle is kept and can be restored. */
    public boolean hasPrevious() {
        return previous.isDirectory() && new File(previous, "index.html").isFile();
    }

    /**
     * Resolve a request path inside the active overlay.
     *
     * @return the file, or {@code null} when the overlay does not provide it.
     */
    public File resolve(String rel) {
        if (!hasOverlay()) return null;
        File file = WebPaths.resolveInside(overlay, rel);
        if (file == null || !file.isFile()) return null;
        return file;
    }

    /** Read the manifest of the active overlay, when there is one. */
    public Map<String, Object> overlayManifest() {
        return readManifest(overlay);
    }

    /** Read the manifest of the staged bundle, when there is one. */
    public Map<String, Object> stagedManifest() {
        return readManifest(staged);
    }

    /** Read the manifest of the previous bundle, when there is one. */
    public Map<String, Object> previousManifest() {
        return readManifest(previous);
    }

    private static Map<String, Object> readManifest(File dir) {
        File file = new File(dir, MANIFEST);
        if (!file.isFile()) return null;
        try {
            byte[] raw = new byte[(int) Math.min(file.length(), 1 << 20)];
            try (java.io.InputStream in = new java.io.FileInputStream(file)) {
                int read = 0;
                while (read < raw.length) {
                    int n = in.read(raw, read, raw.length - read);
                    if (n < 0) break;
                    read += n;
                }
                if (read < raw.length) {
                    byte[] exact = new byte[read];
                    System.arraycopy(raw, 0, exact, 0, read);
                    raw = exact;
                }
            }
            return ai.arena.dafter.offline.util.Json.parseObject(new String(raw, "UTF-8"));
        } catch (IOException | IllegalArgumentException e) {
            return null;
        }
    }

    /** The version string of a manifest, or {@code null}. */
    public static String versionOf(Map<String, Object> manifest) {
        return manifest == null ? null : ai.arena.dafter.offline.util.Json.str(manifest, "version", null);
    }

    /** A short, human readable description of the current state. */
    public Map<String, Object> describe() {
        Map<String, Object> out = new LinkedHashMap<>();
        Map<String, Object> manifest = overlayManifest();
        out.put("hasOverlay", hasOverlay());
        out.put("hasStaged", hasStaged());
        out.put("hasPrevious", hasPrevious());
        out.put("version", versionOf(manifest));
        out.put("build", manifest == null ? 0 : ai.arena.dafter.offline.util.Json.num(manifest, "build", 0));
        out.put("channel", manifest == null ? null : ai.arena.dafter.offline.util.Json.str(manifest, "channel", null));
        return out;
    }
}
