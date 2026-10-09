const path = require('node:path');
const { withProjectBuildGradle, withAppBuildGradle, withGradleProperties, withAndroidManifest } = require('@expo/config-plugins');

module.exports = (config, { sdkRepositoryPath = 'vendor/nfc-sdk/maven', developmentModelAssetsPath } = {}) => {
  config = withGradleProperties(config, (mod) => {
    const key = 'android.minSdkVersion';
    mod.modResults = mod.modResults.filter((entry) => entry.key !== key);
    mod.modResults.push({ type: 'property', key, value: '26' });
    return mod;
  });
  config = withProjectBuildGradle(config, (mod) => {
    const repository = path.resolve(mod.modRequest.projectRoot, sdkRepositoryPath).replace(/\\/g, '/');
    if (repository.includes("'") || repository.includes('\n')) throw new Error('Invalid SDK repository path');
    const marker = '// BackHaulBid NFC SDK repository';
    if (!mod.modResults.contents.includes(marker)) {
      mod.modResults.contents += `\n${marker}\nallprojects { repositories { maven { url = uri('${repository}') } } }\n`;
    }
    return mod;
  });
  config = withAppBuildGradle(config, (mod) => {
    // Android does not use this duplicated multi-release OSGi descriptor.
    // Keep service/provider metadata and all other META-INF resources intact.
    const marker = '// BackHaulBid NFC SDK: OSGi resource conflict';
    if (!mod.modResults.contents.includes(marker)) {
      mod.modResults.contents += `\n${marker}\nandroid { packaging { resources { excludes += '/META-INF/versions/9/OSGI-INF/MANIFEST.MF' } } }\n`;
    }
    return mod;
  });
  if (developmentModelAssetsPath) config = withAppBuildGradle(config, (mod) => {
    const assets = path.resolve(mod.modRequest.projectRoot, developmentModelAssetsPath).replace(/\\/g, '/');
    if (assets.includes("'") || assets.includes('\n')) throw new Error('Invalid development model path');
    const marker = '// BackHaulBid development models: debug assets only';
    if (!mod.modResults.contents.includes(marker)) mod.modResults.contents += `\n${marker}\nandroid { sourceSets { debug { assets.srcDirs += ['${assets}'] } } }\n`;
    return mod;
  });
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    manifest['uses-permission'] ||= [];
    for (const permission of ['android.permission.NFC', 'android.permission.CAMERA']) {
      if (!manifest['uses-permission'].some((item) => item.$['android:name'] === permission)) {
        manifest['uses-permission'].push({ $: { 'android:name': permission } });
      }
    }
    manifest['uses-feature'] ||= [];
    const nfc = manifest['uses-feature'].find((item) => item.$['android:name'] === 'android.hardware.nfc');
    if (nfc) nfc.$['android:required'] = 'false';
    else manifest['uses-feature'].push({ $: { 'android:name': 'android.hardware.nfc', 'android:required': 'false' } });
    return mod;
  });
};
