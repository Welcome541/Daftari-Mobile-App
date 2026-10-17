package ai.arena.dafter.offline.util;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Minimal, dependency-free JSON reader.
 *
 * The application ships without third-party libraries on purpose: the whole
 * point of the offline build is that it installs and runs anywhere, with no
 * network and no extra weight. The update manifest is the only JSON the
 * native layer has to understand, so a small reader is enough.
 *
 * Supported: objects, arrays, strings (with escapes), numbers, true/false/null.
 */
public final class Json {

    private final String src;
    private int pos;

    private Json(String src) {
        this.src = src;
        this.pos = 0;
    }

    /* ------------------------------------------------------------------ */
    /* parsing                                                             */
    /* ------------------------------------------------------------------ */

    public static Object parse(String text) {
        if (text == null) throw new IllegalArgumentException("json: null input");
        Json p = new Json(text);
        p.skipWhitespace();
        Object value = p.readValue();
        p.skipWhitespace();
        if (p.pos < p.src.length()) {
            throw new IllegalArgumentException("json: trailing data at " + p.pos);
        }
        return value;
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> parseObject(String text) {
        Object value = parse(text);
        if (!(value instanceof Map)) throw new IllegalArgumentException("json: root is not an object");
        return (Map<String, Object>) value;
    }

    @SuppressWarnings("unchecked")
    public static List<Object> parseArray(String text) {
        Object value = parse(text);
        if (!(value instanceof List)) throw new IllegalArgumentException("json: root is not an array");
        return (List<Object>) value;
    }

    /** Convenience: read a nested string, or {@code fallback} when absent. */
    public static String str(Map<String, Object> obj, String key, String fallback) {
        Object v = obj == null ? null : obj.get(key);
        return (v instanceof String) ? (String) v : fallback;
    }

    public static int num(Map<String, Object> obj, String key, int fallback) {
        Object v = obj == null ? null : obj.get(key);
        if (v instanceof Number) return ((Number) v).intValue();
        if (v instanceof String) {
            try {
                return Integer.parseInt(((String) v).trim());
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> obj(Map<String, Object> parent, String key) {
        Object v = parent == null ? null : parent.get(key);
        return (v instanceof Map) ? (Map<String, Object>) v : null;
    }

    /* ------------------------------------------------------------------ */
    /* writing                                                             */
    /* ------------------------------------------------------------------ */

    /** Escape a string for inclusion in JSON output. */
    public static String quote(String value) {
        if (value == null) return "null";
        StringBuilder b = new StringBuilder(value.length() + 8).append('"');
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"': b.append("\\\""); break;
                case '\\': b.append("\\\\"); break;
                case '\n': b.append("\\n"); break;
                case '\r': b.append("\\r"); break;
                case '\t': b.append("\\t"); break;
                case '\b': b.append("\\b"); break;
                case '\f': b.append("\\f"); break;
                default:
                    if (c < 0x20) {
                        b.append(String.format("\\u%04x", (int) c));
                    } else {
                        b.append(c);
                    }
            }
        }
        return b.append('"').toString();
    }

    /* ------------------------------------------------------------------ */
    /* internals                                                           */
    /* ------------------------------------------------------------------ */

    private void skipWhitespace() {
        while (pos < src.length()) {
            char c = src.charAt(pos);
            if (c == ' ' || c == '\t' || c == '\n' || c == '\r') pos++;
            else break;
        }
    }

    private Object readValue() {
        skipWhitespace();
        if (pos >= src.length()) throw new IllegalArgumentException("json: unexpected end of input");
        char c = src.charAt(pos);
        switch (c) {
            case '{': return readObject();
            case '[': return readArray();
            case '"': return readString();
            case 't': expect("true"); return Boolean.TRUE;
            case 'f': expect("false"); return Boolean.FALSE;
            case 'n': expect("null"); return null;
            default: return readNumber();
        }
    }

    private void expect(String literal) {
        if (!src.startsWith(literal, pos)) {
            throw new IllegalArgumentException("json: expected " + literal + " at " + pos);
        }
        pos += literal.length();
    }

    private Map<String, Object> readObject() {
        Map<String, Object> out = new LinkedHashMap<>();
        pos++; // {
        skipWhitespace();
        if (peek() == '}') { pos++; return out; }
        while (true) {
            skipWhitespace();
            String key = readString();
            skipWhitespace();
            if (peek() != ':') throw new IllegalArgumentException("json: expected ':' at " + pos);
            pos++;
            out.put(key, readValue());
            skipWhitespace();
            char c = peek();
            if (c == ',') { pos++; continue; }
            if (c == '}') { pos++; return out; }
            throw new IllegalArgumentException("json: expected ',' or '}' at " + pos);
        }
    }

    private List<Object> readArray() {
        List<Object> out = new ArrayList<>();
        pos++; // [
        skipWhitespace();
        if (peek() == ']') { pos++; return out; }
        while (true) {
            out.add(readValue());
            skipWhitespace();
            char c = peek();
            if (c == ',') { pos++; continue; }
            if (c == ']') { pos++; return out; }
            throw new IllegalArgumentException("json: expected ',' or ']' at " + pos);
        }
    }

    private String readString() {
        if (peek() != '"') throw new IllegalArgumentException("json: expected string at " + pos);
        pos++;
        StringBuilder b = new StringBuilder();
        while (true) {
            if (pos >= src.length()) throw new IllegalArgumentException("json: unterminated string");
            char c = src.charAt(pos++);
            if (c == '"') return b.toString();
            if (c != '\\') { b.append(c); continue; }
            if (pos >= src.length()) throw new IllegalArgumentException("json: bad escape");
            char e = src.charAt(pos++);
            switch (e) {
                case '"': b.append('"'); break;
                case '\\': b.append('\\'); break;
                case '/': b.append('/'); break;
                case 'b': b.append('\b'); break;
                case 'f': b.append('\f'); break;
                case 'n': b.append('\n'); break;
                case 'r': b.append('\r'); break;
                case 't': b.append('\t'); break;
                case 'u':
                    if (pos + 4 > src.length()) throw new IllegalArgumentException("json: bad \\u escape");
                    b.append((char) Integer.parseInt(src.substring(pos, pos + 4), 16));
                    pos += 4;
                    break;
                default: throw new IllegalArgumentException("json: unknown escape \\" + e);
            }
        }
    }

    private Double readNumber() {
        int start = pos;
        if (peek() == '-' || peek() == '+') pos++;
        while (pos < src.length()) {
            char c = src.charAt(pos);
            if ((c >= '0' && c <= '9') || c == '.' || c == 'e' || c == 'E' || c == '+' || c == '-') pos++;
            else break;
        }
        if (start == pos) throw new IllegalArgumentException("json: expected number at " + pos);
        try {
            return Double.valueOf(src.substring(start, pos));
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("json: bad number at " + start);
        }
    }

    private char peek() {
        if (pos >= src.length()) throw new IllegalArgumentException("json: unexpected end of input");
        return src.charAt(pos);
    }
}
