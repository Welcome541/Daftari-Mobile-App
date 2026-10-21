package ai.arena.dafter.offline.storage;

import java.io.*;
import java.util.*;

/** Owns the currently installed Vosk slot. Whisper's IndexedDB model is not duplicated here. */
public final class ModelManager {

  private final ImportTransaction transaction;
  private volatile List<ModelRecord> records = Collections.emptyList();

  public ModelManager(File imports) throws IOException {
    transaction = new ImportTransaction(imports, "model-ar");
  }

  public void recover() throws IOException {
    synchronized (ImportTransaction.LOCK) {
      transaction.recover();
      refreshRecords();
    }
  }

  public int importVosk(InputStream input) throws Exception {
    synchronized (ImportTransaction.LOCK) {
      transaction.begin();
      try {
        File zip = new File(transaction.work, "input.zip");
        StorageFiles.copy(input, zip, ImportValidator.MAX_BYTES);
        ImportValidator validator = new ImportValidator();
        ImportValidator.ArchiveInfo info = validator.inspect(zip, true);
        if (info.voskRoot == null) throw new IllegalArgumentException(
          "ZIP ليس نموذج Vosk؛ am/final.mdl غير موجود"
        );
        // Keep input + extraction + worst-case gzip/TAR overhead within available disk.
        StorageFiles.requireSpace(
          transaction.work,
          info.expandedBytes * 2 + info.entries * 1024L + 1024 * 1024
        );
        File expanded = new File(transaction.work, "expanded");
        int count = new ArchiveExtractor().extract(
          zip,
          expanded,
          info.voskRoot
        );
        validator.validateVosk(expanded);
        new TarArchiveWriter().write(
          expanded,
          new File(transaction.ready, "model.tar.gz"),
          "vosk-model"
        );
        transaction.commit();
        refreshRecords();
        return count;
      } catch (Exception failure) {
        try {
          transaction.recover();
          refreshRecords();
        } catch (IOException recovery) {
          failure.addSuppressed(recovery);
        }
        throw failure;
      }
    }
  }

  // Immutable snapshot: JS queries never wait for a multi-minute import lock.
  public List<ModelRecord> list() {
    return records;
  }

  private void refreshRecords() {
    File archive = new File(transaction.destination(), "model.tar.gz");
    records = !archive.isFile() || archive.length() == 0
      ? Collections.emptyList()
      : Collections.singletonList(
        new ModelRecord(
          "vosk-active",
          "Vosk",
          "vosk",
          "model-ar/model.tar.gz",
          archive.length(),
          "installed"
        )
      );
  }

  public InputStream openArchive() throws IOException {
    synchronized (ImportTransaction.LOCK) {
      // Open under the transaction lock. An existing stream survives rename/unlink on Android.
      return new FileInputStream(
        new File(transaction.destination(), "model.tar.gz")
      );
    }
  }
}
