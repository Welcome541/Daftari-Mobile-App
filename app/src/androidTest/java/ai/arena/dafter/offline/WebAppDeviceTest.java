package ai.arena.dafter.offline;

import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONTokener;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Runs against a real Android WebView, not JSDOM. */
@RunWith(AndroidJUnit4.class)
public class WebAppDeviceTest {
    private WebView findWebView(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i=0;i<group.getChildCount();i++) {
                WebView found=findWebView(group.getChildAt(i));
                if(found!=null)return found;
            }
        }
        return null;
    }
    private String evaluate(ActivityScenario<MainActivity> scenario, String script) throws Exception {
        CountDownLatch done=new CountDownLatch(1);
        AtomicReference<String> answer=new AtomicReference<>();
        scenario.onActivity(activity -> {
            WebView web=findWebView(activity.getWindow().getDecorView());
            // Storage recovery attaches WebView asynchronously after onCreate.
            // Activity RESUMED alone does not mean that the WebView exists yet.
            if(web==null){answer.set("false");done.countDown();return;}
            web.evaluateJavascript(script,value->{answer.set(value);done.countDown();});
        });
        assertTrue("WebView JS callback timed out",done.await(15,TimeUnit.SECONDS));
        return answer.get();
    }
    private void waitFor(ActivityScenario<MainActivity> scenario,String expression) throws Exception {
        long until=System.currentTimeMillis()+45000;
        String result="";
        while(System.currentTimeMillis()<until) {
            result=evaluate(scenario,"(function(){try{return !!("+expression+")}catch(e){return false}})()");
            if("true".equals(result))return;
            Thread.sleep(200);
        }
        fail("Timed out: "+expression+"; DOM="+evaluate(scenario,"document.body.innerText.slice(0,2000)"));
    }
    private void ready(ActivityScenario<MainActivity> scenario) throws Exception {
        waitFor(scenario,"typeof db!=='undefined' && db && db.accounts && !locked && document.getElementById('app').children.length>0");
    }
    @Test public void bootLedgerBackupCryptoAndRelaunch() throws Exception {
        assertEquals("ai.arena.dafter.next.trial20261023",InstrumentationRegistry.getInstrumentation().getTargetContext().getPackageName());
        String marker="device-"+System.currentTimeMillis();
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            ready(scenario);
            evaluate(scenario,"window.deviceResult=null;(async()=>{try{"
                +"await LedgerEdits.commit((d,x)=>{x.accounts.find(a=>a.id===x.active).name='"+marker+"';"
                +"d.customers.push({id:'devicec',name:'Device customer'});"
                +"d.invoices.push({id:'devicei',code:'T1',cust:'devicec',ts:Date.now(),amount:1250});"
                +"d.payments.push({id:'devicep',cust:'devicec',ts:Date.now(),amount:250,alloc:[{inv:'devicei',amt:250}]});});"
                +"if(Ledger.bal(DD(),'devicec')!==1000)throw Error('balance');"
                +"const backup=await Backup.obj();if(await Backup.verify(backup))throw Error('backup');"
                +"const key=await newMaster();const encrypted=await encJSON({probe:42},key);"
                +"if((await decJSON(encrypted,key)).probe!==42)throw Error('crypto');"
                +"stack=[{s:'settings'}];render();window.deviceResult='ok';"
                +"}catch(e){window.deviceResult='error:'+e.message}})();");
            waitFor(scenario,"window.deviceResult!==null");
            assertEquals("ok",new JSONTokener(evaluate(scenario,"window.deviceResult")).nextValue());
            scenario.recreate();
            ready(scenario);
            assertEquals(marker,new JSONTokener(evaluate(scenario,"db.accounts.find(a=>a.id===db.active).name")).nextValue());
            assertEquals("1000",evaluate(scenario,"Ledger.bal(DD(),'devicec')"));
        }
        // A new Activity/WebView must read the committed IndexedDB data too.
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            ready(scenario);
            assertEquals(marker,new JSONTokener(evaluate(scenario,"db.accounts.find(a=>a.id===db.active).name")).nextValue());
            assertEquals("1000",evaluate(scenario,"Ledger.bal(DD(),'devicec')"));
        }
    }
}
