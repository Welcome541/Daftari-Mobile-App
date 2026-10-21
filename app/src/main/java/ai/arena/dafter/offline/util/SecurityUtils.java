package ai.arena.dafter.offline.util;

import java.io.File;
import java.io.IOException;

/** Shared path policy for archives and private storage. No Android dependency. */
public final class SecurityUtils {

  private SecurityUtils() {}

  public static String normalizeRelativePath(String input) {
    if (input == null || input.indexOf('\0') >= 0) throw new SecurityException(
      "Invalid path"
    );
    String path = input.replace('\\', '/');
    if (
      path.startsWith("/") || path.indexOf(':') >= 0
    ) throw new SecurityException("Absolute path rejected");
    StringBuilder normalized = new StringBuilder();
    int depth = 0;
    for (String part : path.split("/")) {
      if (part.equals("..")) throw new SecurityException(
        "Path traversal rejected"
      );
      if (part.isEmpty() || part.equals(".")) continue;
      if (++depth > 64) throw new SecurityException(
        "Path nesting limit exceeded"
      );
      if (normalized.length() > 0) normalized.append('/');
      normalized.append(part);
    }
    return normalized.toString();
  }

  public static File resolveInside(File root, String relativePath)
    throws IOException {
    String path = normalizeRelativePath(relativePath);
    if (path.isEmpty()) throw new SecurityException("Empty path rejected");
    File canonicalRoot = root.getCanonicalFile();
    File target = new File(canonicalRoot, path).getCanonicalFile();
    if (
      !target.getPath().startsWith(canonicalRoot.getPath() + File.separator)
    ) {
      throw new SecurityException("Path escapes storage root");
    }
    return target;
  }
}
