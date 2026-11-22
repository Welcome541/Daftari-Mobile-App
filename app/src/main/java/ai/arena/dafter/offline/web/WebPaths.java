package ai.arena.dafter.offline.web;

/**
 * Path safety for every file the WebView asks for.
 *
 * All paths are relative to a web root and must never escape it, and the
 * resolver is also used to police the contents of update packages, where
 * a malicious archive could otherwise try to write outside the target
 * directory ("zip slip").
 */
public final class WebPaths {

    private WebPaths() { }

    /**
     * Normalise a relative path.
     *
     * @return the cleaned path, or {@code null} when the path is unsafe
     *         (absolute, drive-qualified, empty, or containing a traversal).
     */
    public static String normalize(String raw) {
        if (raw == null) return null;
        String s = raw.replace('\\', '/');
        if (s.isEmpty()) return null;
        if (s.charAt(0) == '/') return null;
        if (s.length() > 1 && s.charAt(1) == ':') return null;      // C:\...
        if (s.indexOf('\0') >= 0) return null;
        StringBuilder out = new StringBuilder();
        int segments = 0;
        for (String part : s.split("/")) {
            if (part.isEmpty() || part.equals(".")) continue;
            if (part.equals("..")) return null;                      // traversal
            if (out.length() > 0) out.append('/');
            out.append(part);
            segments++;
        }
        return segments == 0 ? null : out.toString();
    }

    /** True when the relative path stays inside its root. */
    public static boolean isSafe(String raw) {
        return normalize(raw) != null;
    }

    /**
     * Resolve a relative path inside a root directory and prove the result
     * is still inside it. The canonical comparison closes the symlink and
     * normalisation loopholes that a plain string check would miss.
     *
     * @return the resolved file, or {@code null} when the path is unsafe.
     */
    public static java.io.File resolveInside(java.io.File root, String raw) {
        String rel = normalize(raw);
        if (rel == null) return null;
        try {
            java.io.File canonicalRoot = root.getCanonicalFile();
            java.io.File target = new java.io.File(canonicalRoot, rel).getCanonicalFile();
            String rootPath = canonicalRoot.getPath();
            String targetPath = target.getPath();
            if (!targetPath.equals(rootPath) && !targetPath.startsWith(rootPath + java.io.File.separator)) {
                return null;
            }
            return target;
        } catch (java.io.IOException e) {
            return null;
        }
    }
}
