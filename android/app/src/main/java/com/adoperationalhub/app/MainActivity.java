package com.adoperationalhub.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeAlarmPlugin.class);
        registerPlugin(AuthBrowserPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
