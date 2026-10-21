import ai.arena.dafter.offline.storage.ImportValidator;
import ai.arena.dafter.offline.storage.TarArchiveWriter;
import ai.arena.dafter.offline.util.SecurityUtils;
import java.io.*;
import java.nio.file.*;
import java.util.zip.*;

/** Standalone JVM regression suite: tools/test-storage.sh (JDK 17+, no Android SDK). */
public class StorageSafetyTest {
    interface Checked { void run() throws Exception; }
    static int checks;
    static void check(boolean value) { checks++; if (!value) throw new AssertionError("Check " + checks); }
    static void rejected(Checked action) throws Exception {
        try { action.run(); } catch (SecurityException | IllegalArgumentException expected) { checks++; return; }
        throw new AssertionError("Expected rejection");
    }
    static File zip(Path dir, String... entries) throws Exception {
        File file = Files.createTempFile(dir, "model-", ".zip").toFile();
        try (ZipOutputStream out = new ZipOutputStream(new FileOutputStream(file))) {
            for (String name : entries) {
                out.putNextEntry(new ZipEntry(name)); out.write(1); out.closeEntry();
            }
        }
        return file;
    }
    public static void main(String[] args) throws Exception {
        Path dir = Files.createTempDirectory("daftari-storage-test-");
        try {
            for (String path : new String[]{"../a", "a/../../b", "a/..", "/tmp/a", "C:\\a", "\\\\server\\share", "a\0b"}) {
                rejected(() -> SecurityUtils.resolveInside(dir.toFile(), path));
            }
            rejected(() -> SecurityUtils.resolveInside(dir.toFile(), ""));
            check(SecurityUtils.normalizeRelativePath("a\\b/./c").equals("a/b/c"));
            check(SecurityUtils.resolveInside(dir.toFile(), "model/am/final.mdl").getCanonicalPath().startsWith(dir.toFile().getCanonicalPath()+File.separator));
            Path outside = Files.createTempDirectory("daftari-outside-");
            try {
                Files.createSymbolicLink(dir.resolve("escape"), outside);
                rejected(() -> SecurityUtils.resolveInside(dir.toFile(), "escape/model.bin"));
            } finally { Files.deleteIfExists(dir.resolve("escape")); Files.delete(outside); }
            ImportValidator validator = new ImportValidator();
            check(validator.findVoskRoot(zip(dir, "arabic/am/final.mdl", "arabic/conf/model.conf")).equals("arabic"));
            check(validator.findVoskRoot(zip(dir, "am/final.mdl")).equals(""));
            check(validator.findVoskRoot(zip(dir, "other.txt")) == null);
            rejected(() -> validator.findVoskRoot(zip(dir, "am/final.mdl", "nested/am/final.mdl")));
            rejected(() -> validator.findVoskRoot(zip(dir, "model/am/final.mdl", "../escape")));
            rejected(() -> validator.validateVosk(dir.toFile()));
            Path model = Files.createDirectory(dir.resolve("model"));
            Files.createDirectories(model.resolve("am"));
            Files.write(model.resolve("am/final.mdl"), new byte[]{1, 2, 3});
            validator.validateVosk(model.toFile()); checks++;
            File tar = dir.resolve("model.tar.gz").toFile();
            new TarArchiveWriter().write(model.toFile(), tar, "vosk-model");
            try (InputStream in = new GZIPInputStream(new FileInputStream(tar))) {
                byte[] content = in.readAllBytes();
                check(content.length % 512 == 0);
                check(new String(content, 0, 23, java.nio.charset.StandardCharsets.UTF_8).equals("vosk-model/am/final.mdl"));
                check(content[512] == 1 && content[514] == 3);
                for (int i=content.length-1024; i<content.length; i++) check(content[i] == 0);
            }
            System.out.println("Storage safety checks passed: " + checks);
        } finally {
            try (java.util.stream.Stream<Path> paths = Files.walk(dir)) {
                paths.sorted(java.util.Comparator.reverseOrder()).forEach(p -> { try { Files.delete(p); } catch (IOException e) { throw new RuntimeException(e); } });
            }
        }
    }
}
