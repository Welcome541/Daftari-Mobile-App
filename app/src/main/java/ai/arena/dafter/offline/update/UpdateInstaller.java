package ai.arena.dafter.offline.update;

import ai.arena.dafter.offline.util.Json;
import ai.arena.dafter.offline.util.Sha256;
import ai.arena.dafter.offline.web.WebPaths;
import ai.arena.dafter.offline.web.WebRoot;

import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Installs, activates and rolls back interface updates.
 *
 * The flow is deliberately conservative: a package is only ever installed
 * after every single file it contains has been proved, byte for byte, to
 * match the manifest that travels with it. A bundle that fails the check is
 * discarded and the running interface is left untouched.
 *
 *   stage()     extract + verify into webroot.staged
 *   activate()  webroot.staged becomes webroot, the old bundle becomes webroot.prev
 *   rollback()  webroot.prev becomes webroot again
 */
public final class UpdateInstaller {

    /** Guard rails for untrusted archives. */
    private static final int MAX_ENTRIES = 30000;
    private static final long MAX_TOTAL = 512L * 1024 * 1024;
    private static final long MAX_FILE = 128L * 1024 * 1024;

    private final WebRoot root;

    public UpdateInstaller(WebRoot root) {
        this.root = root;
    }

    /* ------------------------------------------------------------------ */
    /* results                                                             */
    /* ------------------------------------------------------------------ */

    /** The outcome of an installation attempt. */
    public static final class Result {
        public final boolean ok;
        public final boolean cancelled;
        public final String version;
        public final int build;
        public final String channel;
        public final int files;
        public final String error;

        Result(boolean ok, boolean cancelled, String version, int build, String channel, int files, String error) {
            this.ok = ok;
            this.cancelled = cancelled;
            this.version = version;
            this.build = build;
            this.channel = channel;
            this.files = files;
            this.error = error;
        }

        public static Result ok(String version, int build, String channel, int files) {
            return new Result(true, false, version, build, channel, files, null);
        }

        public static Result fail(String error) {
            return new Result(false, false, null, 0, null, 0, error);
        }

        public static Result cancel() {
            return new Result(false, true, null, 0, null, 0, null);
        }

        /** Serialise for the JavaScript bridge. */
        public String toJson() {
            StringBuilder b = new StringBuilder("{");
            b.append("\"ok\":").append(ok);
            b.append(",\"cancelled\":").append(cancelled);
            b.append(",\"version\":").append(Json.quote(version));
            b.append(",\"build\":").append(build);
            b.append(",\"channel\":").append(Json.quote(channel));
            b.append(",\"files\":").append(files);
            b.append(",\"error\":").append(Json.quote(error));
            return b.append('}').toString();
        }
    }

    /* ------------------------------------------------------------------ */
    /* installation                                                        */
    /* ------------------------------------------------------------------ */

    /**
     * Install a package from a stream. The stream is fully consumed; the
     * caller owns closing it.
     */
    public Result install(InputStream source) {
        File staging = root.staged();
        if (staging.exists()) deleteTree(staging);
        if (!staging.mkdirs()) return Result.fail("cannot-create-staging");

        try {
            int extracted = extract(source, staging);
            if (extracted < 0) {
                deleteTree(staging);
                return Result.fail("archive-invalid");
            }
            Map<String, Object> manifest = readManifest(staging);
            if (manifest == null) {
                deleteTree(staging);
                return Result.fail("no-manifest");
            }
            String version = Json.str(manifest, "version", null);
            int build = Json.num(manifest, "build", 0);
            String channel = Json.str(manifest, "channel", null);
            if (version == null) {
                deleteTree(staging);
                return Result.fail("manifest-invalid");
            }
            String problem = verify(staging, manifest);
            if (problem != null) {
                deleteTree(staging);
                return Result.fail(problem);
            }
            return Result.ok(version, build, channel, extracted);
        } catch (IOException | RuntimeException e) {
            deleteTree(staging);
            return Result.fail("install-failed");
        }
    }

    /**
     * Unpack the archive into the staging directory.
     *
     * @return the number of files written, or -1 when the archive is unsafe.
     */
    private int extract(InputStream source, File staging) throws IOException {
        int entries = 0;
        long total = 0;
        byte[] buffer = new byte[65536];
        try (ZipInputStream zip = new ZipInputStream(source)) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (++entries > MAX_ENTRIES) return -1;
                if (entry.isDirectory()) {
                    zip.closeEntry();
                    continue;
                }
                File target = WebPaths.resolveInside(staging, entry.getName());
                if (target == null) return -1;                 // zip slip attempt
                File parent = target.getParentFile();
                if (parent != null && !parent.exists() && !parent.mkdirs()) return -1;
                long written = 0;
                try (OutputStream out = new BufferedOutputStream(new FileOutputStream(target))) {
                    int n;
                    while ((n = zip.read(buffer)) > 0) {
                        written += n;
                        total += n;
                        if (written > MAX_FILE || total > MAX_TOTAL) return -1;
                        out.write(buffer, 0, n);
                    }
                }
                zip.closeEntry();
            }
        }
        return entries;
    }

    /**
     * Prove the staged bundle against its own manifest.
     *
     * @return {@code null} when everything matches, otherwise a short reason.
     */
    private String verify(File staging, Map<String, Object> manifest) {
        Map<String, Object> files = Json.obj(manifest, "files");
        if (files == null) return "no-files";
        for (Map.Entry<String, Object> entry : files.entrySet()) {
            String rel = entry.getKey();
            Map<String, Object> spec = (entry.getValue() instanceof Map)
                    ? castMap(entry.getValue()) : null;
            if (spec == null) return "bad-file-entry";
            File file = WebPaths.resolveInside(staging, rel);
            if (file == null || !file.isFile()) return "missing:" + rel;
            int size = Json.num(spec, "size", -1);
            if (size >= 0 && file.length() != size) return "size:" + rel;
            String expected = Json.str(spec, "sha256", null);
            if (expected == null) return "no-hash:" + rel;
            try {
                if (!expected.equalsIgnoreCase(Sha256.hexOfFile(file))) return "hash:" + rel;
            } catch (IOException e) {
                return "unreadable:" + rel;
            }
        }
        // nothing may ride along that the manifest does not describe
        File[] all = staging.listFiles();
        if (all != null) {
            for (File f : all) {
                if (f.isFile()) {
                    String rel = f.getName();
                    if (WebRoot.MANIFEST.equals(rel)) continue;
                    if (!files.containsKey(rel)) return "undeclared:" + rel;
                } else {
                    List<String> extra = listFiles(f, "");
                    for (String rel : extra) {
                        if (!files.containsKey(rel)) return "undeclared:" + rel;
                    }
                }
            }
        }
        return null;
    }

    private static List<String> listFiles(File dir, String prefix) {
        List<String> out = new ArrayList<>();
        File[] children = dir.listFiles();
        if (children == null) return out;
        for (File child : children) {
            if (child.isDirectory()) out.addAll(listFiles(child, prefix + child.getName() + "/"));
            else out.add(prefix + child.getName());
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> castMap(Object value) {
        return (Map<String, Object>) value;
    }

    private static Map<String, Object> readManifest(File dir) {
        File file = new File(dir, WebRoot.MANIFEST);
        if (!file.isFile()) return null;
        try (InputStream in = new java.io.FileInputStream(file)) {
            byte[] raw = new byte[(int) Math.min(file.length(), 1 << 20)];
            int read = 0;
            while (read < raw.length) {
                int n = in.read(raw, read, raw.length - read);
                if (n < 0) break;
                read += n;
            }
            String text = new String(raw, 0, read, "UTF-8");
            return Json.parseObject(text);
        } catch (IOException | IllegalArgumentException e) {
            return null;
        }
    }

    /* ------------------------------------------------------------------ */
    /* activation                                                          */
    /* ------------------------------------------------------------------ */

    /** Switch the staged bundle on. Returns true on success. */
    public boolean activate() {
        if (!root.hasStaged()) return false;
        if (!root.overlay().exists() && !root.overlay().mkdirs()) return false;
        try {
            // keep the running bundle so a failed boot can be rolled back
            if (root.hasOverlay()) {
                if (root.previous().exists()) deleteTree(root.previous());
                if (!root.overlay().renameTo(root.previous())) {
                    copyTree(root.overlay(), root.previous());
                    deleteTree(root.overlay());
                }
            }
            if (!root.staged().renameTo(root.overlay())) {
                if (!copyTree(root.staged(), root.overlay())) return false;
                deleteTree(root.staged());
            }
            return root.hasOverlay();
        } catch (RuntimeException e) {
            return false;
        }
    }

    /** Restore the previous bundle. Returns true on success. */
    public boolean rollback() {
        if (!root.hasPrevious()) return false;
        try {
            if (root.overlay().exists()) deleteTree(root.overlay());
            if (!root.previous().renameTo(root.overlay())) {
                if (!copyTree(root.previous(), root.overlay())) return false;
                deleteTree(root.previous());
            }
            return root.hasOverlay();
        } catch (RuntimeException e) {
            return false;
        }
    }

    /** Discard a staged bundle without installing it. */
    public void discardStaged() {
        deleteTree(root.staged());
    }

    /** Remove every installed overlay, returning the app to the bundled bundle. */
    public void clearAll() {
        deleteTree(root.staged());
        deleteTree(root.overlay());
        deleteTree(root.previous());
    }

    /* ------------------------------------------------------------------ */
    /* state                                                               */
    /* ------------------------------------------------------------------ */

    /** A JSON description of the update state, for the JavaScript bridge. */
    public String describeJson() {
        Map<String, Object> state = root.describe();
        StringBuilder b = new StringBuilder("{");
        b.append("\"hasOverlay\":").append(Boolean.TRUE.equals(state.get("hasOverlay")));
        b.append(",\"hasStaged\":").append(Boolean.TRUE.equals(state.get("hasStaged")));
        b.append(",\"hasPrevious\":").append(Boolean.TRUE.equals(state.get("hasPrevious")));
        b.append(",\"version\":").append(Json.quote((String) state.get("version")));
        b.append(",\"build\":").append(state.get("build") == null ? 0 : state.get("build"));
        b.append(",\"channel\":").append(Json.quote((String) state.get("channel")));
        b.append(",\"stagedVersion\":").append(Json.quote(WebRoot.versionOf(root.stagedManifest())));
        b.append(",\"previousVersion\":").append(Json.quote(WebRoot.versionOf(root.previousManifest())));
        return b.append('}').toString();
    }

    /** The manifest of the bundle that is currently active. */
    public Map<String, Object> describeManifest() {
        return root.overlayManifest();
    }

    /** Whether a previous bundle is kept and can be restored. */
    public boolean canRollback() {
        return root.hasPrevious();
    }

    /* ------------------------------------------------------------------ */
    /* file helpers                                                        */
    /* ------------------------------------------------------------------ */

    static void deleteTree(File file) {
        if (file == null || !file.exists()) return;
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) deleteTree(child);
            }
        }
        file.delete();
    }

    private static boolean copyTree(File from, File to) {
        if (from == null || !from.exists()) return false;
        if (from.isDirectory()) {
            if (!to.exists() && !to.mkdirs()) return false;
            File[] children = from.listFiles();
            if (children == null) return false;
            for (File child : children) {
                if (!copyTree(child, new File(to, child.getName()))) return false;
            }
            return true;
        }
        File parent = to.getParentFile();
        if (parent != null && !parent.exists() && !parent.mkdirs()) return false;
        try (InputStream in = new java.io.FileInputStream(from);
             OutputStream out = new FileOutputStream(to)) {
            byte[] buffer = new byte[65536];
            int n;
            while ((n = in.read(buffer)) > 0) out.write(buffer, 0, n);
        } catch (IOException e) {
            return false;
        }
        return true;
    }
}
