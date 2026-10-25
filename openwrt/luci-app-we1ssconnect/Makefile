include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-we1ssconnect
PKG_VERSION:=$(if $(WE1SS_VERSION),$(WE1SS_VERSION),0.0.0)
PKG_RELEASE:=1
PKG_MAINTAINER:=We1BSchatten

LUCI_TITLE:=LuCI app for We1ssConnect
LUCI_DEPENDS:=+luci-base +we1ssconnect
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
