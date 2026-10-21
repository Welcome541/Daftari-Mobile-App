package ai.arena.dafter.offline.ui;

/** A cancelled Android picker still owns its result code until its late result is drained. */
public final class OperationGate {

  private Lease current;

  public synchronized Lease acquire() {
    if (current != null) return null;
    current = new Lease();
    return current;
  }

  public final class Lease {

    private volatile boolean cancelled;
    private Thread runner;
    private boolean finished, resultClaimed;

    public synchronized boolean claimResult() {
      if (resultClaimed) return false;
      resultClaimed = true;
      return true;
    }

    public boolean isCancelled() {
      return cancelled;
    }

    public synchronized void cancel() {
      cancelled = true;
      if (runner != null) runner.interrupt();
    }

    public synchronized void enterWorker() {
      runner = Thread.currentThread();
      if (cancelled) runner.interrupt();
    }

    public synchronized void leaveWorker() {
      runner = null;
      Thread.interrupted(); // Do not poison the executor's next import.
    }

    public void finish() {
      synchronized (OperationGate.this) {
        if (finished) return;
        finished = true;
        if (current == this) current = null;
      }
    }
  }
}
