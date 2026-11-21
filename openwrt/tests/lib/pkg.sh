# reinstall: upgrades the installed package to the next of the .1/.2/.3 builds in /pkgs/up, so
# its scripts run as on a real upgrade (opkg's --force-reinstall removes it first, running prerm).
reinstall() {
	if command -v apk > /dev/null; then
		have="$(apk list -I we1ssconnect 2>/dev/null)"
	else
		have="$(opkg list-installed we1ssconnect)"
	fi
	k="$(echo "$have" | sed -nE 's/.*[0-9]+\.[0-9]+\.[0-9]+\.([0-9]+)-r.*/\1/p')"
	k=$(( ${k:-0} + 1 ))
	if command -v apk > /dev/null; then
		apk add --allow-untrusted /pkgs/up/we1ssconnect-*."$k"-r*.apk 2>&1
	else
		opkg install /pkgs/up/we1ssconnect_*."$k"-r*.ipk 2>&1
	fi
}
