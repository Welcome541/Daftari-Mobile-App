import ai.arena.dafter.offline.bridge.RequestRegistry;
import ai.arena.dafter.offline.ui.OperationGate;
import java.util.*;

public class BridgeLifecycleTest {
    static int checks;
    static void check(boolean condition, String reason) { checks++; if (!condition) throw new AssertionError(reason); }
    public static void main(String[] args) {
        List<String> frames = new ArrayList<>();
        RequestRegistry registry = new RequestRegistry((id,type,data,code,message)->frames.add(id+":"+type+":"+code));
        check(!RequestRegistry.validId("../escape"), "Reject unsafe ID");
        check(!RequestRegistry.validId(null), "Reject null ID");
        RequestRegistry.Request first = registry.begin("page-1");
        check(registry.begin("page-1") == null, "Ignore duplicate active ID");
        first.progress("copying"); first.succeed("done"); first.fail("LATE", "ignored");
        check(frames.size()==2 && frames.get(1).contains(":success:"), "Exactly one terminal response");
        check(registry.begin("page-1")==null, "Ignore replay of recently completed ID");
        int[] cancelled = {0};
        RequestRegistry.Request cancel = registry.begin("page-2");
        cancel.onCancel(()->{cancelled[0]++;cancel.succeed("late success");});
        registry.cancel("page-2");registry.cancel("page-2");
        check(cancelled[0]==1, "Cancel once");check(frames.size()==3 && frames.get(2).endsWith("CANCELLED"), "Late success suppressed");
        RequestRegistry.Request throwing = registry.begin("throwing");
        throwing.onCancel(()->{throw new RuntimeException("bad cleanup");});
        RequestRegistry.Request last = registry.begin("last");last.onCancel(()->cancelled[0]++);
        registry.close();check(last.isDone() && cancelled[0]==2, "Close continues despite cleanup failure");
        check(registry.begin("after-close")==null, "Closed registry refuses new requests");
        registry.cancel("unknown");
        RequestRegistry bounded = new RequestRegistry((id,type,data,code,message)->frames.add(code));
        for(int i=0;i<16;i++)check(bounded.begin("r"+i)!=null,"Accept bounded slot");
        check(bounded.begin("overflow")==null && frames.get(frames.size()-1).equals("BUSY"), "Enforce capacity");
        bounded.close();

        OperationGate gate = new OperationGate();
        OperationGate.Lease picker = gate.acquire();check(picker!=null,"Acquire picker");
        check(picker.claimResult(), "Claim Android result once");check(!picker.claimResult(), "Reject duplicate Android result");
        picker.cancel();check(picker.isCancelled(),"Cancel marks lease");
        check(gate.acquire()==null,"Cancellation must not reuse outstanding Android result code");
        picker.finish();OperationGate.Lease next=gate.acquire();check(next!=null,"Drain allows next operation");
        picker.finish();check(gate.acquire()==null,"Late finish cannot release newer lease");
        next.enterWorker();next.cancel();check(Thread.currentThread().isInterrupted(),"Interrupt live import worker");
        next.leaveWorker();check(!Thread.currentThread().isInterrupted(),"Clear executor interrupt after cleanup");
        check(gate.acquire()==null,"Wait for worker completion before releasing lease");next.finish();
        OperationGate.Lease queued=gate.acquire();queued.cancel();queued.enterWorker();
        check(Thread.currentThread().isInterrupted(),"Cancellation before worker starts is honored");queued.leaveWorker();queued.finish();
        check(gate.acquire()!=null,"Lease available after cleanup");
        System.out.println("Bridge lifecycle checks passed: "+checks);
    }
}
