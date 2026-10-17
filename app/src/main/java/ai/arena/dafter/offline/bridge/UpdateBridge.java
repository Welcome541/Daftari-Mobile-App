package ai.arena.dafter.offline.bridge;

import android.webkit.JavascriptInterface;

import ai.arena.dafter.offline.update.UpdateInstaller;

/**
 * The {@code DaftariUpdate} bridge - the device side of the update system.
 *
 * The JavaScript side of the application ({@code js/72-update.js}) talks to
 * this object. Everything that must survive a process restart (the staged
 * bundle, the rollback copy) lives in the app's private storage, so the
 * native layer owns the whole lifecycle.
 *
 * The bridge is intentionally small:
 *   version()          state description as JSON
 *   installedVersion() version of the running bundle
 *   canRollback()      whether a previous bundle is available
 *   pickUpdate()       opens the file picker; the result is delivered
 *                      asynchronously through window.__dafterUpdateResult
 *   activate()         switch the staged bundle on
 *   rollback()         restore the previous bundle
 *   reload()           restart the interface
 */
public final class UpdateBridge {

    /** Callbacks the bridge needs from the hosting activity. */
    public interface Host {
        /** Ask the user for an update package; the host reports back through
         *  {@link #deliverResult}. */
        void requestUpdatePackage(UpdateBridge bridge);

        /** Restart the interface so a new bundle takes effect. */
        void reloadInterface();

        /** Show a short message to the user. */
        void notifyUser(String message);

        /** Hand a result back to the JavaScript side. */
        void deliverUpdateResult(String json);
    }

    private final UpdateInstaller installer;
    private final Host host;

    public UpdateBridge(UpdateInstaller installer, Host host) {
        this.installer = installer;
        this.host = host;
    }

    /* ------------------------------------------------------------------ */
    /* state                                                               */
    /* ------------------------------------------------------------------ */

    @JavascriptInterface
    public String version() {
        return installer.describeJson();
    }

    @JavascriptInterface
    public String installedVersion() {
        String version = ai.arena.dafter.offline.web.WebRoot.versionOf(
                installer.describeManifest());
        return version == null ? "" : version;
    }

    @JavascriptInterface
    public boolean canRollback() {
        return installer.canRollback();
    }

    /* ------------------------------------------------------------------ */
    /* installation                                                        */
    /* ------------------------------------------------------------------ */

    /**
     * Open the file picker so the user can choose an update package.
     * The outcome is delivered later through {@link #deliverResult}.
     */
    @JavascriptInterface
    public void pickUpdate() {
        host.requestUpdatePackage(this);
    }

    /**
     * Called by the host once the user has chosen a file.
     *
     * @param stream the package content, or {@code null} when the user
     *               cancelled the picker
     */
    public void deliverResult(java.io.InputStream stream) {
        if (stream == null) {
            deliver("{\"ok\":false,\"cancelled\":true}");
            return;
        }
        UpdateInstaller.Result result;
        try (java.io.InputStream in = stream) {
            result = installer.install(in);
        } catch (java.io.IOException e) {
            result = UpdateInstaller.Result.fail("read-failed");
        }
        deliver(result.toJson());
    }

    /** Push a result back into the interface. */
    public void deliver(String json) {
        host.deliverUpdateResult(json);
    }

    /* ------------------------------------------------------------------ */
    /* activation                                                          */
    /* ------------------------------------------------------------------ */

    @JavascriptInterface
    public String activate() {
        boolean ok = installer.activate();
        return ok ? "{\"ok\":true}" : "{\"ok\":false,\"error\":\"activate-failed\"}";
    }

    @JavascriptInterface
    public String rollback() {
        boolean ok = installer.rollback();
        if (ok) host.notifyUser("update-rolled-back");
        return ok ? "{\"ok\":true}" : "{\"ok\":false,\"error\":\"rollback-failed\"}";
    }

    @JavascriptInterface
    public void reload() {
        host.reloadInterface();
    }

    @JavascriptInterface
    public void discard() {
        installer.discardStaged();
    }
}
