package com.adoperationalhub.app;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import java.util.List;
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
        PackageManager packageManager = getContext().getPackageManager();

        for (String browserPackage : BROWSER_PACKAGES) {
            Intent intent = createBrowserIntent(uri);
            intent.setPackage(browserPackage);

            if (!hasBrowserActivity(packageManager, intent)) {
                continue;
            }

            try {
                getContext().startActivity(intent);
                JSObject result = new JSObject();
                result.put("packageName", browserPackage);
                call.resolve(result);
                return;
            } catch (SecurityException exception) {
                // Try the next trusted browser package.
            }
        }

        call.reject("No trusted browser app is available for Google sign-in.");
    }

    private Intent createBrowserIntent(Uri uri) {
        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        return intent;
    }

    private boolean hasBrowserActivity(PackageManager packageManager, Intent intent) {
        List<ResolveInfo> activities = packageManager.queryIntentActivities(
            intent,
            PackageManager.MATCH_DEFAULT_ONLY
        );

        return activities != null && !activities.isEmpty();
    }
}
