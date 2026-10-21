package ai.arena.dafter.offline.storage;

import java.io.*;

/** Private storage primitives shared by both import types (Android API 21 compatible). */
public final class StorageFiles {

  private StorageFiles() {}

  public static void mkdir(File directory) throws IOException {
    if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException(
      "تعذّر إنشاء مجلد التخزين"
    );
  }

  public static void checkInterrupted() throws InterruptedIOException {
    if (
      Thread.currentThread().isInterrupted()
    ) throw new InterruptedIOException("أُلغي الاستيراد");
  }

  public static void requireSpace(File directory, long bytes)
    throws IOException {
    // Leave space for app data and filesystem metadata; fail closed on unknown capacity.
    if (
      bytes < 0 ||
      bytes > Long.MAX_VALUE - 16L * 1024 * 1024 ||
      directory.getUsableSpace() < bytes + 16L * 1024 * 1024
    ) throw new IOException("المساحة المتاحة لا تكفي للاستيراد مع هامش أمان");
  }

  public static long copy(InputStream input, File destination, long limit)
    throws IOException {
    long total = 0;
    byte[] buffer = new byte[65536];
    try (FileOutputStream output = new FileOutputStream(destination)) {
      int n;
      while ((n = input.read(buffer)) != -1) {
        checkInterrupted();
        total += n;
        if (total > limit) throw new IOException(
          "حجم الملف يتجاوز الحد المسموح"
        );
        requireSpace(destination.getParentFile(), n);
        output.write(buffer, 0, n);
      }
      output.getFD().sync();
    }
    return total;
  }

  public static void deleteTree(File file) throws IOException {
    // Only application-owned paths are passed here. Never follow a planted symlink.
    if (
      !file.getCanonicalFile().equals(file.getAbsoluteFile())
    ) throw new IOException("رفض تنظيف رابط رمزي");
    if (!file.exists()) return;
    if (file.isDirectory()) {
      File[] children = file.listFiles();
      if (children == null) throw new IOException("تعذّر قراءة مجلد التنظيف");
      for (File child : children) deleteTree(child);
    }
    if (!file.delete()) throw new IOException("تعذّر تنظيف الملفات المؤقتة");
  }

  public static void syncTree(File directory) throws IOException {
    File[] children = directory.listFiles();
    if (children == null) throw new IOException("تعذّر قراءة ملفات التثبيت");
    for (File file : children) {
      checkInterrupted();
      if (file.isDirectory()) syncTree(file);
      else try (FileOutputStream out = new FileOutputStream(file, true)) {
        out.getFD().sync();
      }
    }
  }
}
