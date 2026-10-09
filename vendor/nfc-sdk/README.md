# Vendored Android NFC SDK

This directory contains the published Android SDK artifacts consumed by the driver app.

- Maven repository: `maven/vn/backhaulbid/identity/`
- Pinned version: `0.2.0-dev`
- `ekyc-android` is the Android AAR; its Gradle metadata references the required `nfc-core` JAR and transitive dependencies.
- `debug-assets/` contains development-only ONNX model assets wired into the Android debug source set by the Expo config plugin.

The app resolves this repository from `plugins/withBackHaulBidEkyc.js`. Keep both Maven modules and their `.module`/POM metadata together; copying only the AAR omits `nfc-core` and dependency metadata.

The canonical SDK source is maintained in `NFC/cccd-bac-android`. To refresh the vendored artifacts, publish `:nfc-core` and `:ekyc-android` to that repository's `build/sdk-maven`, then copy the matching version directories here. The mobile app build itself uses only the vendored files in this directory.
