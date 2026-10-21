package ai.arena.dafter.offline.storage;

import java.io.*;

/** Stores legacy HTML project bundles as inert files, never as privileged app code. */
public final class ProjectManager {

  private final ImportTransaction transaction;

  public ProjectManager(File imports) throws IOException {
    transaction = new ImportTransaction(imports, "proj");
  }

  public void recover() throws IOException {
    synchronized (ImportTransaction.LOCK) {
      transaction.recover();
    }
  }

  public int importArchive(InputStream input) throws Exception {
    synchronized (ImportTransaction.LOCK) {
      transaction.begin();
      try {
        File zip = new File(transaction.work, "input.zip");
        StorageFiles.copy(input, zip, ImportValidator.MAX_BYTES);
        ImportValidator validator = new ImportValidator();
        ImportValidator.ArchiveInfo info = validator.inspect(zip, false);
        StorageFiles.requireSpace(
          transaction.work,
          info.expandedBytes + info.entries * 4096L
        );
        int count = new ArchiveExtractor().extract(
          zip,
          transaction.ready,
          null
        );
        validator.validateProject(transaction.ready);
        transaction.commit();
        return count;
      } catch (Exception failure) {
        try {
          transaction.recover();
        } catch (IOException recovery) {
          failure.addSuppressed(recovery);
        }
        throw failure;
      }
    }
  }
}
