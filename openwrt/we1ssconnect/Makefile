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

# An upgrade keeps the service and autostart as the user left them; preinst notes both.
define Package/we1ssconnect/preinst
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] && exit 0
[ -x /etc/init.d/we1ssconnect ] || exit 0
autostart=0 running=0
/etc/init.d/we1ssconnect enabled && autostart=1
# Releases before 1.11.4 kept "Disconnected" in uci with procd autostart still on.
[ "$$(uci -q get we1ssconnect.main.enabled)" = 0 ] && autostart=0
pidof sing-box > /dev/null && nft list table inet we1ssconnect > /dev/null 2>&1 && running=1
echo "autostart=$$autostart running=$$running" > /tmp/we1ssconnect.pkg
exit 0
endef

define Package/we1ssconnect/postinst
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] && exit 0
/etc/init.d/rpcd reload
# podkop, Passwall and the like capture the same traffic: stop them and their autostart.
stopped="$$(/usr/bin/we1ssconnect take-over | jsonfilter -e '@.stopped[*]' | tr '\n' ' ')"
[ -n "$$stopped" ] && echo "We1ssConnect: stopped and disabled $${stopped}(nothing was removed)"
uci -q delete we1ssconnect.main.enabled && uci commit we1ssconnect
autostart=0 running=0
[ -f /tmp/we1ssconnect.pkg ] && . /tmp/we1ssconnect.pkg && upgrade=1
rm -f /tmp/we1ssconnect.pkg
if [ "$$autostart" = 1 ]; then /etc/init.d/we1ssconnect enable; else /etc/init.d/we1ssconnect disable; fi
if [ "$$running" = 1 ]; then /etc/init.d/we1ssconnect restart; else /etc/init.d/we1ssconnect stop; fi
# opkg runs this before its own enable and start of the init script; that start applies the hold.
[ -f /usr/lib/opkg/info/we1ssconnect.list ] && echo "autostart=$$autostart running=$$running" > /tmp/we1ssconnect.hold
[ -n "$${upgrade:-}" ] && echo "We1ssConnect: kept autostart=$$autostart running=$$running"
exit 0
endef

define Package/we1ssconnect/prerm
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] && exit 0
/etc/init.d/we1ssconnect stop
/etc/init.d/we1ssconnect disable
# Xray for REALITY servers was downloaded by the service, so the package does not own it.
rm -rf /usr/share/we1ssconnect
exit 0
endef

$(eval $(call BuildPackage,we1ssconnect))
