package ai.arena.dafter.offline.storage;

import ai.arena.dafter.offline.util.SecurityUtils;
import java.io.File;
import java.util.zip.ZipEntry;

/** Metadata preflight; extraction separately enforces actual expanded bytes. */
public final class ImportValidator {

  public static final long MAX_BYTES = 1024L * 1024 * 1024;
  public static final int MAX_ENTRIES = 30000;

  public static final class ArchiveInfo {

    public final String voskRoot;
    public final long expandedBytes;
    public final int entries;

    ArchiveInfo(String root, long bytes, int entries) {
      this.voskRoot = root;
      this.expandedBytes = bytes;
      this.entries = entries;
    }
  }

  public String findVoskRoot(File zip) throws Exception {
    return inspect(zip, true).voskRoot;
  }

  public ArchiveInfo inspect(File zip, boolean detectModel) throws Exception {
    String root = null;
    long total = 0;
    int count = 0;
    java.util.Set<String> names = new java.util.HashSet<>();
    try (java.util.zip.ZipFile archive = new java.util.zip.ZipFile(zip)) {
      java.util.Enumeration<? extends ZipEntry> entries = archive.entries();
      while (entries.hasMoreElements()) {
        StorageFiles.checkInterrupted();
        ZipEntry entry = entries.nextElement();
        if (++count > MAX_ENTRIES) throw new IllegalArgumentException(
          "ZIP يحتوي عناصر كثيرة"
        );
        String name = SecurityUtils.normalizeRelativePath(entry.getName());
        if (
          name.isEmpty() || !names.add(name)
        ) throw new IllegalArgumentException(
          "ZIP يحتوي اسمًا فارغًا أو مكررًا"
        );
        long size = entry.getSize();
        if (
          size < 0 || size > MAX_BYTES || total > MAX_BYTES - size
        ) throw new IllegalArgumentException(
          "ZIP يتجاوز حد الفك أو حجمه غير معروف"
        );
        total += size;
        if (entry.isDirectory()) {
          if (size != 0) throw new IllegalArgumentException(
            "عنصر مجلد ZIP يحتوي بيانات"
          );
          continue;
        }
        String suffix = "am/final.mdl";
        if (
          detectModel && (name.equals(suffix) || name.endsWith("/" + suffix))
        ) {
          String candidate = name.equals(suffix)
            ? ""
            : name.substring(0, name.length() - suffix.length() - 1);
          if (
            root != null && !root.equals(candidate)
          ) throw new IllegalArgumentException(
            "ZIP يحتوي أكثر من جذر لنموذج Vosk"
          );
          root = candidate;
        }
      }
    }
    return new ArchiveInfo(root, total, count);
  }

  public void validateVosk(File directory) {
    File acousticModel = new File(directory, "am/final.mdl");
    if (!acousticModel.isFile() || acousticModel.length() == 0) {
      throw new IllegalArgumentException(
        "ZIP ليس نموذج Vosk كاملًا؛ am/final.mdl مفقود أو فارغ"
      );
    }
  }

  public void validateProject(File directory) {
    if (
      !new File(directory, "index.html").isFile() &&
      !new File(directory, "app.html").isFile()
    ) {
      throw new IllegalArgumentException("ZIP المشروع لا يحتوي صفحة HTML");
    }
  }
}
