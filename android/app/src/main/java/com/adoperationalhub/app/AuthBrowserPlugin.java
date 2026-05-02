package com.adoperationalhub.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AuthBrowser")
public class AuthBrowserPlugin extends Plugin {
    private static final String[] BROWSER_PACKAGES = {
        "com.sec.android.app.sbrowser",
        "com.android.chrome",
        "com.chrome.beta",
        "com.microsoft.emmx",
        "org.mozilla.firefox",
        "com.brave.browser",
        "com.opera.browser",
        "com.duckduckgo.mobile.android"
    };

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");

        if (url == null || (!url.startsWith("https://") && !url.startsWith("http://"))) {
            call.reject("A valid browser URL is required for Google sign-in.");
            return;
        }

        Uri uri = Uri.parse(url);

        for (String browserPackage : BROWSER_PACKAGES) {
            Intent intent = createBrowserIntent(uri);
            intent.setPackage(browserPackage);

            try {
                getContext().startActivity(intent);
                JSObject result = new JSObject();
                result.put("packageName", browserPackage);
                call.resolve(result);
                return;
            } catch (ActivityNotFoundException | SecurityException exception) {
                // Try the next installed browser before falling back to Android's resolver.
            }
        }

        try {
            getContext().startActivity(createBrowserIntent(uri));
            call.resolve();
        } catch (ActivityNotFoundException | SecurityException exception) {
            call.reject("Android could not open a browser for Google sign-in.", exception);
        }
    }

    private Intent createBrowserIntent(Uri uri) {
        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        return intent;
    }
}
