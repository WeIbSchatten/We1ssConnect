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
  CONFLICTS:=podkop
  PKGARCH:=all
endef

define Package/we1ssconnect/description
  Routes LAN traffic through VLESS, VMess, Trojan, Shadowsocks, Hysteria2, TUIC and
  WireGuard servers with sing-box: by lists, all traffic, per device or through the
  router's own VPN interfaces, with an automatic lowest-delay balancer.
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

define Package/we1ssconnect/postinst
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] && exit 0
/etc/init.d/rpcd reload
/etc/init.d/we1ssconnect enable
/etc/init.d/we1ssconnect restart
exit 0
endef

define Package/we1ssconnect/prerm
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] && exit 0
/etc/init.d/we1ssconnect stop
/etc/init.d/we1ssconnect disable
exit 0
endef

$(eval $(call BuildPackage,we1ssconnect))
