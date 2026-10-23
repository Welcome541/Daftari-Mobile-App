package ai.arena.dafter.offline.storage;

import java.io.*;
import java.util.*;
import java.util.zip.GZIPOutputStream;

/** Converts a validated Vosk directory to the archive expected by vosk-browser. */
public final class TarArchiveWriter {

  public void write(File root, File archive, String tarRoot) throws Exception {
    ArrayList<File> files = new ArrayList<>();
    collectFiles(root, root, files);
    final String base = root.getAbsolutePath() + File.separator;
    Collections.sort(files, (left, right) ->
      left.getAbsolutePath().compareTo(right.getAbsolutePath())
    );
    byte[] buf = new byte[65536],
      zeros = new byte[1024];
    try (
      OutputStream out = new BufferedOutputStream(
        new GZIPOutputStream(new FileOutputStream(archive), 65536)
      )
    ) {
      for (File file : files) {
        String name =
          tarRoot +
          "/" +
          file
            .getAbsolutePath()
            .substring(base.length())
            .replace(File.separatorChar, '/');
        long size = file.length();
        out.write(tarHeader(name, size));
        long copied = 0;
        try (InputStream in = new FileInputStream(file)) {
          int n;
          while ((n = in.read(buf)) != -1) {
            if (
              Thread.currentThread().isInterrupted()
            ) throw new InterruptedIOException("أُلغي الاستيراد");
            out.write(buf, 0, n);
            copied += n;
          }
        }
        if (copied != size) throw new IOException(
          "تغير حجم الملف أثناء تجهيز نموذج Vosk"
        );
        int padding = (int) ((512 - (size % 512)) % 512);
        if (padding > 0) out.write(zeros, 0, padding);
      }
      out.write(zeros, 0, 1024);
    }
  }

  private void collectFiles(File root, File dir, List<File> out)
    throws IOException {
    File[] children = dir.listFiles();
    if (children == null) throw new IOException("تعذّر قراءة ملفات النموذج");
    for (File f : children) {
      if (f.isDirectory()) collectFiles(root, f, out);
      else if (f.isFile()) out.add(f);
      else throw new IOException("عنصر نموذج غير مدعوم");
    }
  }

  private byte[] tarHeader(String path, long size) throws IOException {
    byte[] h = new byte[512];
    String name = path,
      prefix = "";
    byte[] nb = name.getBytes(java.nio.charset.StandardCharsets.UTF_8);
    if (nb.length > 100) {
      boolean split = false;
      for (
        int i = path.lastIndexOf('/');
        i > 0;
        i = path.lastIndexOf('/', i - 1)
      ) {
        String p = path.substring(0, i),
          n = path.substring(i + 1);
        if (
          p.getBytes(java.nio.charset.StandardCharsets.UTF_8).length <= 155 &&
          n.getBytes(java.nio.charset.StandardCharsets.UTF_8).length <= 100
        ) {
          prefix = p;
          name = n;
          split = true;
          break;
        }
      }
      if (!split) throw new IOException("اسم ملف النموذج طويل أكثر من حد TAR");
    }
    tarString(h, 0, 100, name);
    tarOctal(h, 100, 8, 0644);
    tarOctal(h, 108, 8, 0);
    tarOctal(h, 116, 8, 0);
    tarOctal(h, 124, 12, size);
    tarOctal(h, 136, 12, 0);
    for (int i = 148; i < 156; i++) h[i] = ' ';
    h[156] = '0';
    tarString(h, 257, 6, "ustar");
    h[262] = 0;
    tarString(h, 263, 2, "00");
    tarString(h, 345, 155, prefix);
    long sum = 0;
    for (byte x : h) sum += x & 255;
    String check = String.format(Locale.US, "%06o", sum);
    byte[] c = check.getBytes(java.nio.charset.StandardCharsets.US_ASCII);
    System.arraycopy(c, 0, h, 148, c.length);
    h[154] = 0;
    h[155] = ' ';
    return h;
  }

  private void tarString(byte[] h, int off, int len, String s)
    throws IOException {
    byte[] b = s.getBytes(java.nio.charset.StandardCharsets.UTF_8);
    if (b.length > len) throw new IOException("مسار نموذج Vosk طويل");
    System.arraycopy(b, 0, h, off, b.length);
  }

  private void tarOctal(byte[] h, int off, int len, long value)
    throws IOException {
    String s = String.format(Locale.US, "%0" + (len - 1) + "o", value);
    byte[] b = s.getBytes(java.nio.charset.StandardCharsets.US_ASCII);
    if (b.length > len - 1) throw new IOException("حجم TAR خارج النطاق");
    System.arraycopy(b, 0, h, off + len - 1 - b.length, b.length);
    h[off + len - 1] = 0;
  }
}
