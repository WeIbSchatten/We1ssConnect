// libXray.aar lives in a file-based Maven repository inside the xray-vpn module
// (a plain local .aar dependency breaks the module's AAR build). Every project
// resolving the module's dependencies needs to see that repository.
const { withProjectBuildGradle } = require('expo/config-plugins');

const MARKER = '// we1ssconnect: libXray repository';
const REPO = `${MARKER}
allprojects {
  repositories {
    maven { url = uri("\${rootDir}/../modules/xray-vpn/android/libs/maven") }
  }
}
`;

module.exports = function withLibXray(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(MARKER)) {
      cfg.modResults.contents += `\n${REPO}`;
    }
    return cfg;
  });
};
