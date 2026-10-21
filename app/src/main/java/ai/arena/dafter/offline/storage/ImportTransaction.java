package ai.arena.dafter.offline.storage;

import java.io.*;
import java.nio.charset.StandardCharsets;

/**
 * Recoverable directory replacement. All calls must hold LOCK, including readers.
 * The ready -> destination rename is the commit point. Recovery rolls back before
 * that point and keeps the new installation afterwards. Handles process death;
 * directory fsync/power-loss durability is not promised by java.io.File.
 */
public final class ImportTransaction {

  public static final Object LOCK = new Object();
  private final File destination, transaction, backup, journal;
  public final File work, ready;

  public ImportTransaction(File imports, String slot) throws IOException {
    if (
      !slot.equals("model-ar") && !slot.equals("proj")
    ) throw new IllegalArgumentException("Unknown storage slot");
    StorageFiles.mkdir(imports);
    destination = new File(imports, slot);
    transaction = new File(new File(imports, ".transactions"), slot);
    backup = new File(transaction, "backup");
    journal = new File(transaction, "journal-v1");
    work = new File(transaction, "work");
    ready = new File(transaction, "ready");
  }

  public void recover() throws IOException {
    // A backup without a destination means the old directory was moved but
    // the new one was never committed. Never delete that last good copy.
    if (backup.exists() && !destination.exists()) {
      if (!backup.renameTo(destination)) throw new IOException(
        "تعذّر استرجاع التثبيت السابق؛ النسخة محفوظة"
      );
    }
    // destination + backup: commit finished; destination always wins.
    StorageFiles.deleteTree(transaction);
  }

  public void begin() throws IOException {
    recover();
    StorageFiles.mkdir(work);
    StorageFiles.mkdir(ready);
  }

  public File destination() {
    return destination;
  }

  public void commit() throws IOException {
    StorageFiles.checkInterrupted();
    if (!ready.isDirectory()) throw new IOException("ملفات التثبيت غير جاهزة");
    StorageFiles.syncTree(ready);
    try (FileOutputStream out = new FileOutputStream(journal)) {
      out.write(
        "daftari-import-v1\nPREPARED\n".getBytes(StandardCharsets.UTF_8)
      );
      out.getFD().sync();
    }
    StorageFiles.checkInterrupted();
    if (
      destination.exists() && !destination.renameTo(backup)
    ) throw new IOException("تعذّر حفظ التثبيت السابق");
    // Do not check cancellation between these renames: finish or roll back.
    if (!ready.renameTo(destination)) {
      if (
        backup.exists() && !backup.renameTo(destination)
      ) throw new IOException(
        "تعذّر التثبيت والاسترجاع؛ النسخة السابقة محفوظة للاسترجاع عند التشغيل"
      );
      throw new IOException("تعذّر تثبيت الملفات الجديدة");
    }
    // Post-commit cleanup failure must not report a successfully installed
    // model as failed. Startup/begin retries it and preserves destination.
    try {
      recover();
    } catch (IOException ignored) {
      /* Retained for next recovery. */
    }
  }
}
