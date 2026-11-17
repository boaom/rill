package one.rill.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 必须在 BridgeActivity.onCreate 创建 Bridge 之前注册自定义插件。
        registerPlugin(WeiboLoginPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
