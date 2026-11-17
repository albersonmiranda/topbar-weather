
import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import St from "gi://St";
import * as Weather from "resource:///org/gnome/shell/misc/weather.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class weatherOClock extends Extension {
  constructor(metadata) {
    super(metadata);

    this._topBox = null;
    this._positionChangeListener = null;
    this._settings = null;
    this._panelWeather = null;
    this._dateMenu = null;
  }

  enable() {
    if (this._panelWeather) return;

    const statusArea = Main.panel.statusArea;
    this._dateMenu = statusArea.dateMenu;
    const weather = new Weather.WeatherClient();
    const network = Main.panel._network;
    const networkIcon = network ? network._primaryIndicator : null;
    this._settings = this.getSettings();
    this._panelWeather = new PanelWeather(weather, networkIcon, this._settings);

    this._topBox = new St.BoxLayout({
      style_class: "clock",
    });

    this._dateMenu._clockDisplay.remove_style_class_name("clock");
    this._dateMenu._clockDisplay
      .get_parent()
      .replace_child(this._dateMenu._clockDisplay, this._topBox);


    this._positionChangeListener = this._settings.connect('changed::weather-after-clock', () => this._addWidget());
    this._addWidget();
  }

  disable() {
    if (this._positionChangeListener) {
      this._settings.disconnect(this._positionChangeListener);
      this._positionChangeListener = null;
    }
    if (this._topBox && this._dateMenu) {
      this._topBox.remove_child(this._dateMenu._clockDisplay);
      this._dateMenu._clockDisplay.remove_style_class_name("label-right-margin");
      this._dateMenu._clockDisplay.remove_style_class_name("label-left-margin");
      const parent = this._topBox.get_parent();
      if (parent)
        parent.replace_child(this._topBox, this._dateMenu._clockDisplay);
      this._topBox = null;
    }

    if (this._panelWeather) {
      this._panelWeather.destroy();
      this._panelWeather = null;
    }

    this._settings = null;
    this._dateMenu = null;
  }

  _addWidget() {
    const clockDisplay = this._dateMenu._clockDisplay;
    if (clockDisplay.get_parent() === this._topBox)
      this._topBox.remove_child(clockDisplay);
    if (this._panelWeather.get_parent() === this._topBox)
      this._topBox.remove_child(this._panelWeather);
    clockDisplay.remove_style_class_name("label-right-margin");
    clockDisplay.remove_style_class_name("label-left-margin");

    if (this._settings.get_boolean('weather-after-clock')) {
      this._topBox.add_child(clockDisplay);
      this._topBox.add_child(this._panelWeather);
      clockDisplay.add_style_class_name("label-right-margin");

      return
    }

    this._topBox.add_child(this._panelWeather);
    this._topBox.add_child(clockDisplay);
    clockDisplay.add_style_class_name("label-left-margin");
  }
}

const PanelWeather = GObject.registerClass(
  {
    GTypeName: "PanelWeather",
  },
  class PanelWeather extends St.BoxLayout {
    _init(weather, networkIcon, settings) {
      super._init({
        visible: false,
        y_align: Clutter.ActorAlign.CENTER,
      });

      this._weather = weather;
      this._networkIcon = networkIcon;
      this._settings = settings;

      this._signals = [];
      for (const key of [
        "show-apparent-temp",
        "hide-units",
        "hide-apparent-decimals",
        "show-conditions",
      ]) {
        this._pushSignal(this._settings, `changed::${key}`, () => this._weather.update());
      }

      this._icon = new St.Icon({
        y_align: Clutter.ActorAlign.CENTER,
        style_class: "system-status-icon custom-weather-icon-spacing",
      });

      this.add_child(this._icon);

      this._label = new St.Label({
        y_align: Clutter.ActorAlign.CENTER,
        style_class: "clock-label weather_label",
      });
      this._label.clutter_text.y_align = Clutter.ActorAlign.CENTER;

      this.add_child(this._label);

      this._pushSignal(
        this._weather,
        "changed",
        this._onWeatherInfoUpdate.bind(this),
      );

      if (this._networkIcon) {
        this._pushSignal(
          this._networkIcon,
          "notify::icon-name",
          this._onNetworkIconNotifyEvents.bind(this),
        );
        this._pushSignal(
          this._networkIcon,
          "notify::visible",
          this._onNetworkIconNotifyEvents.bind(this),
        );
        if (this._networkIcon.visible) {
          this._weather.update();
          this._StartLongTermUpdateTimeout();
        }
      } else {
        this._weather.update();
        this._StartLongTermUpdateTimeout();
      }
    }

    _pushSignal(obj, signalName, callback) {
      this._signals.push({
        obj: obj,
        signalId: obj.connect(signalName, callback),
      });
    }

    _onWeatherInfoUpdate(weather) {
      if (!weather.loading) {
        this._icon.icon_name = weather.info.get_symbolic_icon_name();

        let temp = weather.info.get_temp_summary().replace("--", "");

        if (this._settings.get_boolean('hide-units')) {
          temp = temp.replace(/[°CF]/g, "").trim();
        }

        let labelText = temp;

        if (this._settings.get_boolean('show-apparent-temp')) {
          let apparent = weather.info.get_apparent();

          if (this._settings.get_boolean('hide-apparent-decimals')) {
            let numericValue = parseFloat(apparent.replace(/[°CF]/g, "").trim());
            if (!isNaN(numericValue)) {
              let rounded = Math.round(numericValue);
              if (this._settings.get_boolean('hide-units')) {
                apparent = rounded.toString();
              } else {
                let unit = apparent.match(/[°CF]/g);
                apparent = unit ? `${rounded}${unit.join('')}` : rounded.toString();
              }
            }
          } else if (this._settings.get_boolean('hide-units')) {
            apparent = apparent.replace(/[°CF]/g, "").trim();
          }

          labelText += ` (${apparent})`;
        }

        if (this._settings.get_boolean('show-conditions')) {
          let conditions = weather.info.get_conditions();
          if (!conditions || conditions === "-") {
            conditions = weather.info.get_sky();
          }
          if (conditions !== "-") {
            labelText += `, ${conditions}`.toLowerCase();
          }
        }

        this._label.text = labelText;
        this.visible = Boolean(this._icon.icon_name && this._label.text);
      }
    }

    _onNetworkIconNotifyEvents(networkIcon) {
      if (networkIcon.visible && !this.visible) {
        this._weather.update();
        this._StartLongTermUpdateTimeout();
      } else if (!networkIcon.visible) {
        this._cancelLongTermUpdateTimeout();
        this.visible = false;
      }
    }

    _StartLongTermUpdateTimeout() {
      this._cancelLongTermUpdateTimeout();
      this._weatherUpdateTimeout = GLib.timeout_add_seconds(
        GLib.PRIORITY_LOW,
        600,
        () => {
          this._weather.update();
          return GLib.SOURCE_CONTINUE;
        },
      );
    }

    _cancelLongTermUpdateTimeout() {
      if (this._weatherUpdateTimeout) {
        GLib.source_remove(this._weatherUpdateTimeout);
      }
      this._weatherUpdateTimeout = null;
    }

    destroy() {
      this._cancelLongTermUpdateTimeout();
      this._signals.forEach((signal) => signal.obj.disconnect(signal.signalId));
      this._signals = null;
      this._weather = null;
      this._networkIcon = null;
      super.destroy();
    }
  },
);
