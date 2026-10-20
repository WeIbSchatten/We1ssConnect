// Builds one APK per ABI instead of a universal one: the Go core alone is tens of
// megabytes per ABI. x86_64 is kept for the CI emulator.
const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

const ABIS = ['arm64-v8a', 'armeabi-v7a', 'x86_64'];
const MARKER = '// we1ssconnect: abi splits';

module.exports = function withAbiSplits(config) {
  config = withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter(
      (item) => !(item.type === 'property' && item.key === 'reactNativeArchitectures'),
    );
    cfg.modResults.push({ type: 'property', key: 'reactNativeArchitectures', value: ABIS.join(',') });
    return cfg;
  });
  return withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(MARKER)) {
      cfg.modResults.contents += `
${MARKER}
android {
  splits {
    abi {
      enable true
      reset()
      include ${ABIS.map((a) => `"${a}"`).join(', ')}
      universalApk false
    }
  }
}
`;
    }
    return cfg;
  });
};
