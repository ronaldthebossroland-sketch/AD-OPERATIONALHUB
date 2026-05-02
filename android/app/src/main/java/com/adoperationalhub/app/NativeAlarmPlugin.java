package com.adoperationalhub.app;

import android.content.Intent;
import android.content.ActivityNotFoundException;
import android.provider.AlarmClock;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeAlarm")
public class NativeAlarmPlugin extends Plugin {

    @PluginMethod
    public void setAlarm(PluginCall call) {
        Integer hour = call.getInt("hour");
        Integer minute = call.getInt("minute");
        String title = call.getString("title", "Executive reminder");
        Boolean skipUi = call.getBoolean("skipUi", true);

        if (hour == null || minute == null || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
            call.reject("A valid alarm hour and minute are required.");
            return;
        }

        Intent intent = new Intent(AlarmClock.ACTION_SET_ALARM);
        intent.putExtra(AlarmClock.EXTRA_HOUR, hour);
        intent.putExtra(AlarmClock.EXTRA_MINUTES, minute);
        intent.putExtra(AlarmClock.EXTRA_MESSAGE, title);
        intent.putExtra(AlarmClock.EXTRA_SKIP_UI, skipUi);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        if (intent.resolveActivity(getContext().getPackageManager()) == null) {
            call.reject("No Android clock app is available to set a phone alarm.");
            return;
        }

        try {
            getContext().startActivity(intent);
        } catch (ActivityNotFoundException | SecurityException exception) {
            call.reject("Android could not open the clock app to set this alarm.", exception);
            return;
        }

        JSObject result = new JSObject();
        result.put("scheduled", true);
        result.put("hour", hour);
        result.put("minute", minute);
        result.put("title", title);
        call.resolve(result);
    }

    @PluginMethod
    public void showAlarms(PluginCall call) {
        Intent intent = new Intent(AlarmClock.ACTION_SHOW_ALARMS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        if (intent.resolveActivity(getContext().getPackageManager()) == null) {
            call.reject("No Android clock app is available.");
            return;
        }

        try {
            getContext().startActivity(intent);
        } catch (ActivityNotFoundException | SecurityException exception) {
            call.reject("Android could not open the clock app.", exception);
            return;
        }
        call.resolve();
    }
}
