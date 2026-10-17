package ai.arena.dafter.offline.model;

import android.content.ContentResolver;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;

import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.zip.GZIPOutputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Imports the files the user brings in from the device.
 *
 * Two kinds of content are supported:
 *   - a Vosk model, either as a .zip archive or as loose files
 *   - a project bundle (.zip with an HTML page, or a single .html file)
 *
 * Everything is unpacked into the app's private storage. Archives are
 * treated as untrusted: entry names are validated, traversal is refused,
 * and the total size is capped.
 */
public final class ModelImporter {

    private static final long MAX_ZIP = 1024L * 1024 * 1024;
    private static final long MAX_OUT = 1024L * 1024 * 1024;
    private static final int MAX_ENTRIES = 30000;

    private final ContentResolver resolver;
    private final File filesDir;
    private final File importRoot;
    private final File modelDir;
    private final File libDir;
    private final File projectDir;

    public ModelImporter(ContentResolver resolver, File filesDir, File importRoot) {
        this.resolver = resolver;
        this.filesDir = filesDir;
        this.importRoot = importRoot;
        this.modelDir = new File(importRoot, "model-ar");
        this.libDir = new File(importRoot, "lib");
        this.projectDir = new File(importRoot, "proj");
    }

    public File importRoot() { return importRoot; }
    public File modelDir() { return modelDir; }
    public File libDir() { return libDir; }
    public File projectDir() { return projectDir; }

    /** Create the import directories if they do not exist yet. */
    public void prepare() {
        mkdirs(importRoot);
        mkdirs(modelDir);
        mkdirs(libDir);
        mkdirs(projectDir);
    }

    /* ------------------------------------------------------------------ */
    /* public API                                                          */
    /* ------------------------------------------------------------------ */

    /**
     * Import one or more selected items.
     *
     * @param project true when the selection belongs to the project importer
     * @return the number of files that were written
     */
    public int importAll(List<Uri> selection, boolean project) throws Exception {
        int count = 0;
        for (Uri uri : selection) {
            count += importOne(uri, project);
        }
        if (!project) {
            File packed = new File(modelDir, "model.tar.gz");
            if (!packed.isFile()) {
                throw new IllegalArgumentException(
                        "لم يُنتج أرشيف تشغيل Vosk؛ اختر ZIP نموذج Vosk كاملًا.");
            }
        }
        return count;
    }

    /** Import a single item: a .zip archive or a loose file. */
    public int importOne(Uri uri, boolean project) throws Exception {
        String name = displayName(uri);
        if (name.toLowerCase(Locale.ROOT).endsWith(".zip")) {
            return importZip(uri, project);
        }
        File root = project ? projectDir
                : (name.toLowerCase(Locale.ROOT).contains("vosk")
                   && (name.endsWith(".js") || name.endsWith(".wasm")) ? libDir : modelDir);
        File target = safeResolve(root, name);
        if (target == null) throw new SecurityException("مسار ملف غير صالح");
        try (InputStream in = resolver.openInputStream(uri);
             FileOutputStream out = new FileOutputStream(target)) {
            if (in == null) throw new IllegalArgumentException("تعذّرت قراءة الملف");
            copy(in, out, MAX_OUT);
        }
        return 1;
    }

    /* ------------------------------------------------------------------ */
    /* archive handling                                                    */
    /* ------------------------------------------------------------------ */

    private int importZip(Uri uri, boolean project) throws Exception {
        File tmp = File.createTempFile("dafter-", ".zip", filesDir);
        File stage = new File(filesDir, "stage-" + System.nanoTime());
        File dest = project ? projectDir : modelDir;
        File packed = null;
        try {
            try (InputStream in = resolver.openInputStream(uri);
                 FileOutputStream out = new FileOutputStream(tmp)) {
                if (in == null) throw new IllegalArgumentException("تعذّرت قراءة ZIP");
                copy(in, out, MAX_ZIP);
            }
            String root = findRoot(tmp);
            mkdirs(stage);
            Set<String> names = new HashSet<>();
            byte[] buffer = new byte[65536];
            long total = 0;
            int entries = 0;
            try (ZipInputStream zip = new ZipInputStream(new FileInputStream(tmp))) {
                ZipEntry entry;
                while ((entry = zip.getNextEntry()) != null) {
                    if (++entries > MAX_ENTRIES) {
                        throw new IllegalArgumentException("ملف ZIP يحتوي عناصر كثيرة جدًا");
                    }
                    String raw = entry.getName().replace('\\', '/');
                    if (raw.startsWith("/") || raw.indexOf('\0') >= 0) {
                        throw new SecurityException("مسار ZIP غير آمن");
                    }
                    String rel = (root != null && raw.startsWith(root + "/"))
                            ? raw.substring(root.length() + 1) : raw;
                    rel = normalize(rel);
                    if (rel.isEmpty() || entry.isDirectory()) {
                        zip.closeEntry();
                        continue;
                    }
                    if (rel.equals("..") || rel.startsWith("../") || rel.contains("/../")) {
                        throw new SecurityException("مسار ZIP غير آمن");
                    }
                    File file = safeResolve(stage, rel);
                    if (file == null) throw new SecurityException("مسار ZIP خارج المجلد");
                    if (!names.add(rel)) {
                        throw new IllegalArgumentException("ZIP يحتوي اسمًا مكررًا");
                    }
                    File parent = file.getParentFile();
                    if (parent != null) mkdirs(parent);
                    try (FileOutputStream out = new FileOutputStream(file)) {
                        int n;
                        while ((n = zip.read(buffer)) > 0) {
                            total += n;
                            if (total > MAX_OUT) {
                                throw new IllegalArgumentException("الملف المفكوك يتجاوز الحد 1 GB");
                            }
                            out.write(buffer, 0, n);
                        }
                    }
                    zip.closeEntry();
                }
            }

            if (!project && !new File(stage, "am/final.mdl").isFile()) {
                throw new IllegalArgumentException("ZIP ليس نموذج Vosk كاملًا؛ am/final.mdl غير موجود.");
            }
            if (project && !new File(stage, "index.html").isFile()
                    && !new File(stage, "app.html").isFile()) {
                throw new IllegalArgumentException("ZIP المشروع لا يحتوي صفحة HTML.");
            }

            if (!project) {
                packed = new File(filesDir, "packed-" + System.nanoTime());
                if (!packed.mkdirs()) {
                    throw new IOException("تعذّر تجهيز مساحة نموذج Vosk");
                }
                String tarRoot = (root == null || root.isEmpty())
                        ? "vosk-model" : root.substring(root.lastIndexOf('/') + 1);
                writeTarGz(stage, new File(packed, "model.tar.gz"), tarRoot);
                deleteTree(stage);
                stage = packed;
            }

            File backup = new File(filesDir, "backup-" + System.nanoTime());
            boolean had = dest.exists();
            if (had && !dest.renameTo(backup)) {
                throw new IllegalStateException("تعذّر حفظ النموذج السابق");
            }
            if (!stage.renameTo(dest)) {
                if (had) backup.renameTo(dest);
                throw new IllegalStateException("تعذّر تثبيت الملفات الجديدة");
            }
            if (had) deleteTree(backup);
            return names.size();
        } finally {
            deleteTree(stage);
            if (packed != null) deleteTree(packed);
            tmp.delete();
        }
    }

    /** Detect the single top-level directory a Vosk archive wraps its model in. */
    private String findRoot(File zip) throws Exception {
        String root = null;
        try (ZipInputStream in = new ZipInputStream(new FileInputStream(zip))) {
            ZipEntry entry;
            int count = 0;
            while ((entry = in.getNextEntry()) != null) {
                if (++count > MAX_ENTRIES) {
                    throw new IllegalArgumentException("ZIP يحتوي عناصر كثيرة");
                }
                if (entry.isDirectory()) continue;
                String name = entry.getName().replace('\\', '/');
                if (name.startsWith("/") || name.contains("../") || name.equals("..")) {
                    throw new SecurityException("مسار ZIP غير آمن");
                }
                String suffix = "am/final.mdl";
                if (name.equals(suffix)) return "";
                if (name.endsWith("/" + suffix)) {
                    String candidate = name.substring(0, name.length() - suffix.length() - 1);
                    if (root != null && !root.equals(candidate)) {
                        throw new IllegalArgumentException("ZIP يحتوي أكثر من جذر لنموذج Vosk");
                    }
                    root = candidate;
                }
            }
        }
        return root;
    }

    /* ------------------------------------------------------------------ */
    /* tar.gz writer (the Vosk runtime expects this layout)               */
    /* ------------------------------------------------------------------ */

    private void writeTarGz(File root, File archive, String tarRoot) throws Exception {
        List<File> files = new ArrayList<>();
        collectFiles(root, files);
        final String base = root.getAbsolutePath() + File.separator;
        Collections.sort(files, Comparator.comparing(f -> f.getAbsolutePath().substring(base.length())));

        byte[] buffer = new byte[65536];
        byte[] zeros = new byte[1024];
        try (OutputStream out = new BufferedOutputStream(
                new GZIPOutputStream(new FileOutputStream(archive), 65536))) {
            for (File file : files) {
                String name = tarRoot + "/" + file.getAbsolutePath()
                        .substring(base.length()).replace(File.separatorChar, '/');
                long size = file.length();
                out.write(tarHeader(name, size));
                long copied = 0;
                try (InputStream in = new FileInputStream(file)) {
                    int n;
                    while ((n = in.read(buffer)) != -1) {
                        out.write(buffer, 0, n);
                        copied += n;
                    }
                }
                if (copied != size) {
                    throw new IOException("تغير حجم الملف أثناء تجهيز نموذج Vosk");
                }
                int padding = (int) ((512 - (size % 512)) % 512);
                if (padding > 0) out.write(zeros, 0, padding);
            }
            out.write(zeros, 0, 1024);
        }
    }

    private void collectFiles(File dir, List<File> out) throws IOException {
        File[] children = dir.listFiles();
        if (children == null) throw new IOException("تعذّر قراءة ملفات النموذج");
        for (File file : children) {
            if (file.isDirectory()) collectFiles(file, out);
            else if (file.isFile()) out.add(file);
            else throw new IOException("عنصر نموذج غير مدعوم");
        }
    }

    private byte[] tarHeader(String path, long size) throws IOException {
        byte[] header = new byte[512];
        String name = path;
        String prefix = "";
        byte[] nameBytes = name.getBytes("UTF-8");
        if (nameBytes.length > 100) {
            boolean split = false;
            for (int i = path.lastIndexOf('/'); i > 0; i = path.lastIndexOf('/', i - 1)) {
                String p = path.substring(0, i);
                String n = path.substring(i + 1);
                if (p.getBytes("UTF-8").length <= 155 && n.getBytes("UTF-8").length <= 100) {
                    prefix = p;
                    name = n;
                    split = true;
                    break;
                }
            }
            if (!split) throw new IOException("اسم ملف النموذج طويل أكثر من حد TAR");
        }
        tarString(header, 0, 100, name);
        tarOctal(header, 100, 8, 0644);
        tarOctal(header, 108, 8, 0);
        tarOctal(header, 116, 8, 0);
        tarOctal(header, 124, 12, size);
        tarOctal(header, 136, 12, 0);
        for (int i = 148; i < 156; i++) header[i] = ' ';
        header[156] = '0';
        tarString(header, 257, 6, "ustar");
        header[262] = 0;
        tarString(header, 263, 2, "00");
        tarString(header, 345, 155, prefix);
        long sum = 0;
        for (byte b : header) sum += b & 255;
        String check = String.format(Locale.US, "%06o", sum);
        byte[] digits = check.getBytes("US-ASCII");
        System.arraycopy(digits, 0, header, 148, digits.length);
        header[154] = 0;
        header[155] = ' ';
        return header;
    }

    private void tarString(byte[] header, int offset, int length, String value) throws IOException {
        byte[] bytes = value.getBytes("UTF-8");
        if (bytes.length > length) throw new IOException("مسار نموذج Vosk طويل");
        System.arraycopy(bytes, 0, header, offset, bytes.length);
    }

    private void tarOctal(byte[] header, int offset, int length, long value) throws IOException {
        String text = String.format(Locale.US, "%0" + (length - 1) + "o", value);
        byte[] bytes = text.getBytes("US-ASCII");
        if (bytes.length > length - 1) throw new IOException("حجم TAR خارج النطاق");
        System.arraycopy(bytes, 0, header, offset + length - 1 - bytes.length, bytes.length);
        header[offset + length - 1] = 0;
    }

    /* ------------------------------------------------------------------ */
    /* helpers                                                             */
    /* ------------------------------------------------------------------ */

    /** Resolve a relative path inside a root, refusing anything that escapes it. */
    private static File safeResolve(File root, String rel) {
        try {
            File canonicalRoot = root.getCanonicalFile();
            File target = new File(canonicalRoot, rel).getCanonicalFile();
            String rootPath = canonicalRoot.getPath();
            String targetPath = target.getPath();
            if (targetPath.equals(rootPath) || !targetPath.startsWith(rootPath + File.separator)) {
                return null;
            }
            return target;
        } catch (IOException e) {
            return null;
        }
    }

    private static String normalize(String path) {
        StringBuilder out = new StringBuilder();
        for (String part : path.split("/")) {
            if (part.isEmpty() || part.equals(".")) continue;
            if (part.equals("..")) return "../" + out;
            if (out.length() > 0) out.append('/');
            out.append(part);
        }
        return out.toString();
    }

    private static void copy(InputStream in, FileOutputStream out, long limit) throws Exception {
        byte[] buffer = new byte[65536];
        long total = 0;
        int n;
        while ((n = in.read(buffer)) != -1) {
            total += n;
            if (total > limit) throw new IllegalArgumentException("حجم الملف يتجاوز 1 GB");
            out.write(buffer, 0, n);
        }
        out.flush();
    }

    /** The display name of a content URI, sanitised for use as a file name. */
    public String displayName(Uri uri) {
        try (Cursor cursor = resolver.query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (index >= 0 && cursor.getString(index) != null) {
                    return sanitize(cursor.getString(index));
                }
            }
        } catch (Exception ignored) {
            // fall through to the last path segment
        }
        String name = uri.getLastPathSegment();
        return sanitize(name == null ? "imported" : name);
    }

    public static String sanitize(String value) {
        return value.replaceAll("[^A-Za-z0-9._\\-\\u0600-\\u06FF]", "_");
    }

    /** List the imported files, for the settings screen. */
    public String listImported() {
        StringBuilder out = new StringBuilder();
        list(importRoot, "", out);
        return out.toString();
    }

    private void list(File dir, String prefix, StringBuilder out) {
        File[] children = dir.listFiles();
        if (children == null) return;
        for (File child : children) {
            if (child.isDirectory()) list(child, prefix + child.getName() + "/", out);
            else out.append(prefix).append(child.getName())
                    .append(" (").append(child.length()).append("B)\n");
        }
    }

    public static void deleteTree(File file) {
        if (file == null || !file.exists()) return;
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) deleteTree(child);
            }
        }
        file.delete();
    }

    private static void mkdirs(File dir) {
        if (dir != null && !dir.exists()) dir.mkdirs();
    }
}
