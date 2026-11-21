# reinstall: installs the built package over itself, so its preinst/postinst run as on an upgrade.
reinstall() {
	if command -v apk > /dev/null; then
		apk fix --allow-untrusted --reinstall we1ssconnect 2>&1 || apk add --allow-untrusted --force-overwrite /pkgs/we1ssconnect-openwrt-*.apk 2>&1
	else
		opkg install --force-reinstall /pkgs/we1ssconnect-openwrt-*.ipk 2>&1
	fi
}
