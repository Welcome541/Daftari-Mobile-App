package ai.arena.dafter.offline.bridge;

import android.content.ContentResolver;
import android.net.Uri;
import android.webkit.JavascriptInterface;

import ai.arena.dafter.offline.model.ModelImporter;

import java.util.List;

/**
 * The {@code Daftari} bridge - the device capabilities the interface uses.
 *
 * Everything here is a thin, well-named adapter over the Android APIs; the
 * behaviour lives in the classes it delegates to ({@link ModelImporter} and
 * the hosting activity), so the bridge stays small enough to audit.
 */
public final class NativeBridge {

    /** Callbacks the bridge needs from the hosting activity. */
    public interface Host {
        /** Open the document picker for a Vosk model import. */
        void pickVoskModel();

        /** Open the document picker for a project import. */
        void pickProjectFile();

        /** Open the contacts picker. */
        void pickContact();

        /** Show a short message to the user. */
        void notifyUser(String message);
    }

    private final ModelImporter importer;
    private final Host host;

    public NativeBridge(ModelImporter importer, Host host) {
        this.importer = importer;
        this.host = host;
    }

    /* ------------------------------------------------------------------ */
    /* import                                                              */
    /* ------------------------------------------------------------------ */

    @JavascriptInterface
    public void pickVosk() {
        host.pickVoskModel();
    }

    @JavascriptInterface
    public void pickProject() {
        host.pickProjectFile();
    }

    @JavascriptInterface
    public String importedList() {
        return importer.listImported();
    }

    /* ------------------------------------------------------------------ */
    /* contacts                                                            */
    /* ------------------------------------------------------------------ */

    @JavascriptInterface
    public void pickContact() {
        host.pickContact();
    }

    /* ------------------------------------------------------------------ */
    /* helpers                                                             */
    /* ------------------------------------------------------------------ */

    /** Read a content URI as a stream - used by the activity after a pick. */
    public static java.io.InputStream open(ContentResolver resolver, Uri uri) {
        try {
            return resolver.openInputStream(uri);
        } catch (Exception e) {
            return null;
        }
    }

    /** The URIs contained in an intent result. */
    public static List<Uri> uris(android.content.Intent data) {
        java.util.ArrayList<Uri> out = new java.util.ArrayList<>();
        if (data == null) return out;
        if (data.getClipData() != null) {
            for (int i = 0; i < data.getClipData().getItemCount(); i++) {
                out.add(data.getClipData().getItemAt(i).getUri());
            }
        } else if (data.getData() != null) {
            out.add(data.getData());
        }
        return out;
    }
}
