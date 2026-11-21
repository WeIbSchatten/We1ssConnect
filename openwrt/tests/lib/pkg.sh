# reinstall: upgrades the built package to itself under a higher version, so preinst/postinst
# run as on a real upgrade (opkg's --force-reinstall removes it first, running prerm).
reinstall() {
	n=$(( $(cat /tmp/we1ss-bump 2> /dev/null || echo 0) + 1 ))
	echo $n > /tmp/we1ss-bump
	if command -v apk > /dev/null; then
		# apk reinstalls the same version as an upgrade, but only from a repository index.
		apk mkndx --allow-untrusted --output /tmp/we1ss-pkgs.adb /pkgs/*.apk 2>&1 &&
			apk fix --allow-untrusted --reinstall --repository /tmp/we1ss-pkgs.adb we1ssconnect 2>&1
	else
		d="$(mktemp -d)"
		( cd "$d" && tar -xzf /pkgs/we1ssconnect-openwrt-*.ipk && mkdir c && tar -xzf control.tar.gz -C c &&
			sed -i "s/^Version: .*/&.$n/" c/control && (cd c && tar -czf ../control.tar.gz ./*) &&
			tar -czf /tmp/we1ss-up.ipk ./debian-binary ./data.tar.gz ./control.tar.gz ) 2>&1 &&
			opkg install /tmp/we1ss-up.ipk 2>&1
		rm -rf "$d"
	fi
}
