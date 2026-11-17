package one.rill.app;

import android.app.Activity;
import android.content.Intent;
import android.webkit.CookieManager;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * App 内微博登录：打开一个普通 WebView 让用户自己登录，用户明确点“我已登录完成”后才读取
 * CookieManager。插件不代填账号密码、不注入脚本，也不打印任何 Cookie 值。
 */
@CapacitorPlugin(name = "WeiboLogin")
public class WeiboLoginPlugin extends Plugin {

    @PluginMethod
    public void openLogin(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("UNAVAILABLE", "当前没有可用的 Activity");
            return;
        }
        Intent intent = new Intent(activity, WeiboLoginActivity.class);
        startActivityForResult(call, intent, "loginResult");
    }

    @ActivityCallback
    private void loginResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK) {
            call.reject("CANCELLED", "用户取消或未完成登录");
            return;
        }
        readCookies(call);
    }

    @PluginMethod
    public void readCookies(PluginCall call) {
        CookieManager manager = CookieManager.getInstance();
        manager.flush();
        String cookie = manager.getCookie("https://m.weibo.cn");
        if (cookie == null || cookie.trim().isEmpty()) {
            call.reject("NO_COOKIE", "未读取到微博 Cookie，请确认已登录后重试");
            return;
        }
        JSObject result = new JSObject();
        result.put("cookie", cookie);
        call.resolve(result);
    }
}
