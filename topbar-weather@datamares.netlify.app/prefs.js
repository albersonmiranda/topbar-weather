"use strict";

import Gtk from "gi://Gtk";
import Gio from "gi://Gio";
import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export default class WeatherOClockPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    window._settings = this.getSettings();
    window.set_default_size(360, 200);

    const builder = new Gtk.Builder();
    builder.add_from_file(`${this.path}/prefs.ui`);

    const weatherAfterClock = builder.get_object("WeatherAfterClock");
    weatherAfterClock.set_active(window._settings.get_boolean("weather-after-clock"));

    window._settings.bind(
      "weather-after-clock",
      weatherAfterClock,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    const showApparentTemp = builder.get_object("ShowApparentTemp");
    showApparentTemp.set_active(window._settings.get_boolean("show-apparent-temp"));
    window._settings.bind(
      "show-apparent-temp",
      showApparentTemp,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    const hideUnits = builder.get_object("HideUnits");
    hideUnits.set_active(window._settings.get_boolean("hide-units"));
    window._settings.bind(
      "hide-units",
      hideUnits,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    const page = builder.get_object("MainWidget");
    window.add(page);
  }
}
