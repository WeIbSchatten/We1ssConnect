# reinstall: installs the built package over itself, so its preinst/postinst run as on an upgrade.
# apk reinstalls only from a repository, so the local files get an index first.
reinstall() {
	if command -v apk > /dev/null; then
		apk mkndx --allow-untrusted -o /tmp/we1ss-pkgs.adb /pkgs/*.apk 2>&1 &&
			apk fix --allow-untrusted --reinstall --repository /tmp/we1ss-pkgs.adb we1ssconnect 2>&1
	else
		opkg install --force-reinstall /pkgs/we1ssconnect-openwrt-*.ipk 2>&1
	fi
}
