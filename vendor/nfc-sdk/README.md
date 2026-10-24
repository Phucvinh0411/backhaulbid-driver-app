# Vendored Android NFC SDK

This directory contains the published Android SDK artifacts consumed by the driver app.

- Maven repository: `maven/vn/backhaulbid/identity/`
- Pinned version: `0.2.4-dev`. `0.2.3-dev`, `0.2.2-dev`, `0.2.1-dev` and `0.2.0-dev` stay in this tree for rollback (`backup-0.2.0-dev/` holds the older copy): point the module's `build.gradle` back to one of them.
- `0.2.3-dev` drops the residence presence flag (`dg13Fields.residenceRead` and the "Nơi ở" row). No chip source for residence has been confirmed in the NFC code.
- `0.2.4-dev` takes the citizen ID from the front-image OCR (twelve digits, `DemoDocumentFields.citizenIdFromImage`), not from DG13. Production no longer reads DG13. The driver sends the value as a plain form field in the upload body (never a header or URL). The OCR value is not signed by the chip.
- `0.2.1-dev` adds the optional DG13 evidence part (`LdsEvidencePart.DG13`) and `LdsEvidence.has`. It was built from the `feature/ekyc-sdk-sync` worktree, not from `NFC/cccd-bac-android`, which is unchanged.
- `0.2.2-dev` adds `NfcDocumentResult.dg13Fields`, which tells the release overview whether DG13 carried the citizen ID and the address. The overview shows only "Đã đọc" or "Chưa có thông tin", never a value. `nfc-core` stays at `0.2.1-dev`. Built from the same worktree.
- `ekyc-android` is the Android AAR; its Gradle metadata references the required `nfc-core` JAR and transitive dependencies.
- `debug-assets/` contains development-only ONNX model assets wired into the Android debug source set by the Expo config plugin.

The app resolves this repository from `plugins/withBackHaulBidEkyc.js`. Keep both Maven modules and their `.module`/POM metadata together; copying only the AAR omits `nfc-core` and dependency metadata.

The canonical SDK source is maintained in `NFC/cccd-bac-android`. To refresh the vendored artifacts, publish `:nfc-core` and `:ekyc-android` to that repository's `build/sdk-maven`, then copy the matching version directories here. The mobile app build itself uses only the vendored files in this directory.
