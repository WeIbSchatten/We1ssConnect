include $(TOPDIR)/rules.mk

PKG_NAME:=we1ssconnect
PKG_VERSION:=$(if $(WE1SS_VERSION),$(WE1SS_VERSION),0.0.0)
PKG_RELEASE:=1
PKG_MAINTAINER:=We1BSchatten

include $(INCLUDE_DIR)/package.mk

define Package/we1ssconnect
  SECTION:=net
  CATEGORY:=Network
  TITLE:=We1ssConnect router client on sing-box
  URL:=https://github.com/WeIbSchatten/We1ssConnect
  DEPENDS:=+sing-box +kmod-nft-tproxy +nftables +curl +ca-bundle +ucode +ucode-mod-fs +ucode-mod-uci
  PKGARCH:=all
endef

define Package/we1ssconnect/description
  Routes LAN traffic through VLESS, VMess, Trojan, Shadowsocks, Hysteria2, TUIC and
  WireGuard servers with sing-box: by lists, all traffic, per device or through the
  router's own VPN interfaces, with an automatic lowest-delay balancer. REALITY servers
  go through Xray, downloaded on first use.
endef

define Package/we1ssconnect/conffiles
/etc/config/we1ssconnect
/etc/we1ssconnect/
endef

define Build/Compile
endef

define Package/we1ssconnect/install
	$(INSTALL_DIR) $(1)/etc/config $(1)/etc/init.d $(1)/usr/bin
	$(INSTALL_CONF) ./files/etc/config/we1ssconnect $(1)/etc/config/we1ssconnect
	$(INSTALL_BIN) ./files/etc/init.d/we1ssconnect $(1)/etc/init.d/we1ssconnect
	$(INSTALL_BIN) ./files/usr/bin/we1ssconnect $(1)/usr/bin/we1ssconnect
	$(INSTALL_DIR) $(1)/usr/share/ucode/we1ssconnect $(1)/usr/share/rpcd/ucode
	$(INSTALL_DATA) ./files/usr/share/ucode/we1ssconnect/*.uc $(1)/usr/share/ucode/we1ssconnect/
	$(INSTALL_DATA) ./files/usr/share/rpcd/ucode/we1ssconnect.uc $(1)/usr/share/rpcd/ucode/
	sed -i "s/^export const VERSION = '.*';/export const VERSION = '$(PKG_VERSION)';/" \
		$(1)/usr/share/ucode/we1ssconnect/service.uc
endef

# An upgrade keeps the service and autostart as the user left them. The notes live in /var/run,
# which only root can write, and are read with grep, never sourced.
define Package/we1ssconnect/preinst
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] && exit 0
s=/var/run/we1ssconnect
mkdir -p $$s
# On opkg the old package's prerm ran first and already noted the state.
if [ ! -f $$s/pkg-state ] && [ -x /etc/init.d/we1ssconnect ]; then
	autostart=0 running=0
	/etc/init.d/we1ssconnect enabled && autostart=1
	[ -e $$s/wanted ] && running=1
	# Up to 1.11.3 the choice lived in uci (Connect), with autostart always on and no wanted flag.
	if grep -q set_enabled /usr/share/rpcd/ucode/we1ssconnect.uc 2> /dev/null; then
		autostart=0 running=0
		[ "$$(uci -q get we1ssconnect.main.enabled)" = 1 ] && autostart=1 running=1
	fi
	echo "autostart=$$autostart running=$$running" > $$s/pkg-state
fi
# OpenWrt's default postinst starts the init script; start_service obeys this hold instead.
if [ -f $$s/pkg-state ]; then cp $$s/pkg-state $$s/hold; else echo "autostart=0 running=0" > $$s/hold; fi
exit 0
endef

define Package/we1ssconnect/postinst
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] && exit 0
s=/var/run/we1ssconnect
/etc/init.d/rpcd reload
autostart=0 running=0 upgrade=
if [ -f $$s/pkg-state ]; then
	upgrade=1
	grep -q 'autostart=1' $$s/pkg-state && autostart=1
	grep -q 'running=1' $$s/pkg-state && running=1
	rm -f $$s/pkg-state
fi
# A config from 1.11.3 or older still holds the user's Connect/Disconnect choice.
legacy="$$(uci -q get we1ssconnect.main.enabled)"
[ -n "$$legacy" ] && autostart="$$legacy" running="$$legacy" && uci delete we1ssconnect.main.enabled && uci commit we1ssconnect
# Not on a stopped upgrade: the user may have gone back to podkop or Passwall on purpose.
if [ -z "$$upgrade" ] || [ "$$running" = 1 ]; then
	stopped="$$(/usr/bin/we1ssconnect take-over | jsonfilter -e '@.stopped[*]' | tr '\n' ' ')"
	[ -n "$$stopped" ] && echo "We1ssConnect: stopped and disabled $${stopped}(nothing was removed)"
fi
if [ "$$autostart" = 1 ]; then /etc/init.d/we1ssconnect enable; else /etc/init.d/we1ssconnect disable; fi
if [ "$$running" = 1 ]; then /etc/init.d/we1ssconnect restart; else /etc/init.d/we1ssconnect stop; fi
# opkg runs this before its own enable and start of the init script; apk runs it after them.
if [ -f /usr/lib/opkg/info/we1ssconnect.list ]; then
	echo "autostart=$$autostart running=$$running" > $$s/hold
else
	rm -f $$s/hold
fi
[ -n "$$upgrade" ] && echo "We1ssConnect: kept autostart=$$autostart running=$$running"
exit 0
endef

define Package/we1ssconnect/prerm
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] && exit 0
# opkg runs this on an upgrade too: note the state for the new package, keep the service and Xray.
if [ "$${PKG_UPGRADE:-}" = 1 ]; then
	s=/var/run/we1ssconnect
	mkdir -p $$s
	autostart=0 running=0
	/etc/init.d/we1ssconnect enabled && autostart=1
	[ -e $$s/wanted ] && running=1
	echo "autostart=$$autostart running=$$running" > $$s/pkg-state
	exit 0
fi
/etc/init.d/we1ssconnect stop
/etc/init.d/we1ssconnect disable
# Xray for REALITY servers was downloaded by the service, so the package does not own it.
rm -rf /usr/share/we1ssconnect
exit 0
endef

$(eval $(call BuildPackage,we1ssconnect))
