import ai.arena.dafter.offline.storage.*;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.zip.*;

/** Real filesystem tests; simulated process-death states at each rename boundary. */
public class ImportLifecycleTest {
    interface Checked { void run() throws Exception; }
    private static int checks;
    private static void check(boolean condition, String message) {
        checks++;
        if (!condition) throw new AssertionError(message);
    }
    private static void rejected(Checked action) throws Exception {
        try { action.run(); }
        catch (IOException | IllegalArgumentException | SecurityException expected) { checks++; return; }
        throw new AssertionError("Expected import rejection");
    }
    private static byte[] zip(String[] paths, byte[][] contents) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream out = new ZipOutputStream(bytes)) {
            for (int i=0; i<paths.length; i++) {
                out.putNextEntry(new ZipEntry(paths[i])); out.write(contents[i]); out.closeEntry();
            }
        }
        return bytes.toByteArray();
    }
    private static byte[] zip(String... paths) throws IOException {
        byte[][] contents = new byte[paths.length][];
        for (int i=0; i<paths.length; i++) contents[i] = paths[i].endsWith("/") ? new byte[0] : new byte[]{1,2,3};
        return zip(paths, contents);
    }
    private static byte[] corruptCrcZip() throws IOException {
        String name = "am/final.mdl";
        byte[] payload = new byte[]{1,2,3};
        CRC32 crc = new CRC32(); crc.update(payload);
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream out = new ZipOutputStream(bytes)) {
            ZipEntry entry = new ZipEntry(name); entry.setMethod(ZipEntry.STORED);
            entry.setSize(payload.length); entry.setCompressedSize(payload.length); entry.setCrc(crc.getValue());
            out.putNextEntry(entry); out.write(payload); out.closeEntry();
        }
        byte[] result = bytes.toByteArray();
        // Local header: 30 bytes, then file name and payload (no extra fields).
        result[30 + name.length()] ^= 1;
        return result;
    }
    private static void put(File file, String value) throws IOException {
        StorageFiles.mkdir(file.getParentFile()); Files.write(file.toPath(), value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
    private static String read(File file) throws IOException {
        return new String(Files.readAllBytes(file.toPath()), java.nio.charset.StandardCharsets.UTF_8);
    }
    private static void recoveryCases(File root) throws Exception {
        // Startup must not modify an existing installation if there is no transaction.
        File imports = new File(root, "recovery");
        ImportTransaction tx = new ImportTransaction(imports, "model-ar");
        File destination = tx.destination();
        put(new File(destination, "value"), "old");
        tx.recover(); check(read(new File(destination,"value")).equals("old"), "Legacy preserved");
        tx.begin(); put(new File(tx.ready, "value"), "new");
        // Crash while preparing: old destination remains authoritative.
        new ImportTransaction(imports, "model-ar").recover();
        check(read(new File(destination,"value")).equals("old"), "Preparing rolled back");
        check(!tx.work.exists(), "Orphan work removed");

        tx.begin(); put(new File(tx.ready,"value"),"new");
        File backup = new File(new File(new File(imports,".transactions"),"model-ar"),"backup");
        check(destination.renameTo(backup), "Simulate first rename");
        new ImportTransaction(imports,"model-ar").recover();
        check(read(new File(destination,"value")).equals("old"), "Missing destination restored");
        check(!backup.exists(), "Backup restored, not lost");
        tx.recover(); check(read(new File(destination,"value")).equals("old"), "Recovery idempotent");

        tx.begin(); put(new File(tx.ready,"value"),"new");
        check(destination.renameTo(backup), "Move previous install");
        check(tx.ready.renameTo(destination), "Simulate commit rename");
        new ImportTransaction(imports,"model-ar").recover();
        check(read(new File(destination,"value")).equals("new"), "Post-commit keeps new data");
        check(!backup.exists(), "Post-commit backup cleaned");

        tx.begin(); put(new File(tx.ready,"value"),"third"); tx.commit();
        check(read(new File(destination,"value")).equals("third"), "Normal commit");
        check(!tx.work.exists(), "Normal commit cleanup");
        // First installation interrupted before commit must not install partial content.
        ImportTransaction first = new ImportTransaction(new File(root,"first"), "proj");
        first.begin(); put(new File(first.ready,"index.html"),"partial"); first.recover();
        check(!first.destination().exists(), "No partial first installation");
        first.begin(); put(new File(first.ready,"index.html"),"complete"); first.commit(); first.recover();
        check(read(new File(first.destination(),"index.html")).equals("complete"), "First commit persists");
    }
    private static void managerCases(File root) throws Exception {
        File imports = new File(root,"managers");
        ModelManager models = new ModelManager(imports); models.recover();
        check(models.list().isEmpty(), "No invented model record");
        byte[] model = zip("arabic/", "arabic/am/", "arabic/am/final.mdl", "arabic/conf/model.conf");
        check(models.importVosk(new ByteArrayInputStream(model)) == 2, "Vosk file count");
        List<ModelRecord> records = models.list();
        check(records.size() == 1 && records.get(0).engine.equals("vosk"), "Typed Vosk record");
        check(records.get(0).state.equals("installed"), "Installed is not runtime readiness");
        check(records.get(0).assetUrl.equals("model-ar/model.tar.gz"), "No native path exposed");
        byte[] old;
        try (InputStream input = models.openArchive()) { old = input.readAllBytes(); }
        rejected(() -> models.importVosk(new ByteArrayInputStream(zip("not-a-model.txt"))));
        rejected(() -> models.importVosk(new ByteArrayInputStream(zip("am/final.mdl", "../escape"))));
        rejected(() -> models.importVosk(new ByteArrayInputStream(zip("model/am/final.mdl", "outside.txt"))));
        rejected(() -> models.importVosk(new ByteArrayInputStream(new byte[]{1,2,3})));
        rejected(() -> models.importVosk(new ByteArrayInputStream(corruptCrcZip())));
        rejected(() -> models.importVosk(new ByteArrayInputStream(zip(new String[]{"am/final.mdl"}, new byte[][]{new byte[0]}))));
        try (InputStream input = models.openArchive()) { check(Arrays.equals(old,input.readAllBytes()), "Failed imports preserve installed model"); }
        rejected(() -> models.importVosk(new InputStream() { public int read() throws IOException { throw new IOException("provider failed"); } }));
        Thread.currentThread().interrupt();
        try { rejected(() -> models.importVosk(new ByteArrayInputStream(model))); }
        finally { Thread.interrupted(); }
        check(!new File(imports,".transactions/model-ar/work").exists(), "Failure/cancellation cleaned work");
        models.recover();
        try (InputStream input = models.openArchive()) { check(Arrays.equals(old,input.readAllBytes()), "Recovery preserves installed model"); }

        ProjectManager projects = new ProjectManager(imports);
        check(projects.importArchive(new ByteArrayInputStream(zip("index.html", "lib/custom.js"))) == 2, "Project files stored inertly");
        File index = new File(imports,"proj/index.html");
        byte[] previous = Files.readAllBytes(index.toPath());
        rejected(() -> projects.importArchive(new ByteArrayInputStream(zip("missing-page.txt"))));
        check(Arrays.equals(previous,Files.readAllBytes(index.toPath())), "Invalid project preserves previous");
        check(projects.importArchive(new ByteArrayInputStream(zip("app.html"))) == 1, "Alternative project entry accepted");
        check(!index.exists(), "Replacement has no stale files");
        // A project may contain multiple model roots; Vosk-specific rules must not apply.
        check(projects.importArchive(new ByteArrayInputStream(zip("index.html", "one/am/final.mdl", "two/am/final.mdl"))) == 3, "Separate project validation");
    }
    private static void archiveCases(File root) throws Exception {
        File temp = new File(root,"archive.zip");
        Files.write(temp.toPath(), zip("am/final.mdl", "am/./final.mdl"));
        rejected(() -> new ImportValidator().inspect(temp,true));
        rejected(() -> new ArchiveExtractor().extract(temp,new File(root,"duplicates"),null));
        Files.write(temp.toPath(), zip(new String[]{"folder/"}, new byte[][]{new byte[]{1}}));
        rejected(() -> new ImportValidator().inspect(temp,false));
        rejected(() -> new ArchiveExtractor().extract(temp,new File(root,"directory-data"),null));
        Files.write(temp.toPath(), zip(new String[]{"large"}, new byte[][]{new byte[2048]}));
        rejected(() -> new ArchiveExtractor(1024,100).extract(temp,new File(root,"size-limit"),null));
        Files.write(temp.toPath(), zip("a","b"));
        rejected(() -> new ArchiveExtractor(1024,1).extract(temp,new File(root,"entry-limit"),null));
        rejected(() -> StorageFiles.requireSpace(root, Long.MAX_VALUE / 2));
        rejected(() -> StorageFiles.requireSpace(root, Long.MAX_VALUE));
        String deep = String.join("/", Collections.nCopies(65,"a"));
        rejected(() -> ai.arena.dafter.offline.util.SecurityUtils.normalizeRelativePath(deep));
    }
    public static void main(String[] args) throws Exception {
        File root = Files.createTempDirectory("daftari-import-lifecycle-").toFile();
        try {
            synchronized (ImportTransaction.LOCK) { recoveryCases(root); }
            managerCases(root); archiveCases(root);
            System.out.println("Import lifecycle checks passed: " + checks);
        } finally { StorageFiles.deleteTree(root); }
    }
}
