package ai.arena.dafter.offline.storage;

import ai.arena.dafter.offline.util.SecurityUtils;
import java.io.*;
import java.util.*;
import java.util.zip.*;

/** Bounded streaming extraction; metadata is advisory, actual bytes are counted. */
public final class ArchiveExtractor {

  private final long maxBytes;
  private final int maxEntries;

  public ArchiveExtractor() {
    this(ImportValidator.MAX_BYTES, ImportValidator.MAX_ENTRIES);
  }

  public ArchiveExtractor(long maxBytes, int maxEntries) {
    if (maxBytes < 1 || maxEntries < 1) throw new IllegalArgumentException(
      "Invalid archive limits"
    );
    this.maxBytes = maxBytes;
    this.maxEntries = maxEntries;
  }

  public int extract(File zip, File directory, String root) throws IOException {
    StorageFiles.mkdir(directory);
    Set<String> names = new HashSet<>();
    long total = 0;
    int entries = 0,
      files = 0;
    byte[] buffer = new byte[65536];
    try (ZipInputStream input = new ZipInputStream(new FileInputStream(zip))) {
      ZipEntry entry;
      while ((entry = input.getNextEntry()) != null) {
        StorageFiles.checkInterrupted();
        if (++entries > maxEntries) throw new IOException(
          "ZIP يحتوي عناصر كثيرة"
        );
        String relative = SecurityUtils.normalizeRelativePath(entry.getName());
        if (!names.add(relative)) throw new IOException(
          "ZIP يحتوي أسماء مكررة بعد التطبيع"
        );
        if (root != null && !root.isEmpty()) {
          if (relative.startsWith(root + "/")) relative = relative.substring(
            root.length() + 1
          );
          else if (
            entry.isDirectory() &&
            (relative.equals(root) || root.startsWith(relative + "/"))
          ) {
            if (input.read() != -1) throw new IOException(
              "عنصر مجلد ZIP يحتوي بيانات"
            );
            input.closeEntry();
            continue;
          } else throw new IOException("ZIP يحتوي ملفات خارج جذر النموذج");
        }
        if (relative.isEmpty()) throw new IOException("اسم ZIP فارغ");
        File target = SecurityUtils.resolveInside(directory, relative);
        if (entry.isDirectory()) {
          if (input.read() != -1) throw new IOException(
            "عنصر مجلد ZIP يحتوي بيانات"
          );
          StorageFiles.mkdir(target);
        } else {
          StorageFiles.mkdir(target.getParentFile());
          try (FileOutputStream output = new FileOutputStream(target)) {
            int n;
            while ((n = input.read(buffer)) != -1) {
              StorageFiles.checkInterrupted();
              total += n;
              if (total > maxBytes) throw new IOException(
                "حجم ZIP المفكوك يتجاوز الحد"
              );
              StorageFiles.requireSpace(directory, n);
              output.write(buffer, 0, n);
            }
          }
          files++;
        }
        input.closeEntry();
      }
    }
    return files;
  }
}
