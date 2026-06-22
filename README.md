# ESP32 Weather Terminal PWA

Minimal black and white PWA for the ESP32 BME280 Firebase project.

## Setup

1. Copy the Firebase web app config into `firebase-config.js`.
2. Push this folder to a GitHub repository.
3. In GitHub, enable Pages for the repository.
4. Open the Pages URL on mobile and add it to the home screen.

The app reads:

```text
devices/esp32-bme280-01/latest
```

It refreshes once per minute and stores local chart history in the browser.
