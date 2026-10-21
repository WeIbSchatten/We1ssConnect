package main

import (
	"fmt"
	"os/exec"
	"syscall"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

const internetSettings = `Software\Microsoft\Windows\CurrentVersion\Internet Settings`

// setSystemProxy points the per-user WinINet proxy (used by browsers and most apps) at us.
func setSystemProxy(on bool) error {
	k, err := registry.OpenKey(registry.CURRENT_USER, internetSettings, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer k.Close()
	if on {
		if err := k.SetStringValue("ProxyServer", fmt.Sprintf("127.0.0.1:%d", httpPort)); err != nil {
			return err
		}
		bypass := "localhost;127.*;10.*;172.16.*;172.17.*;172.18.*;172.19.*;172.2*;172.30.*;172.31.*;192.168.*;<local>"
		if err := k.SetStringValue("ProxyOverride", bypass); err != nil {
			return err
		}
		if err := k.SetDWordValue("ProxyEnable", 1); err != nil {
			return err
		}
	} else if err := k.SetDWordValue("ProxyEnable", 0); err != nil {
		return err
	}
	return refreshInternetSettings()
}

var (
	wininet           = windows.NewLazySystemDLL("wininet.dll")
	internetSetOption = wininet.NewProc("InternetSetOptionW")
)

// Running apps re-read the proxy only when told the settings changed.
func refreshInternetSettings() error {
	const settingsChanged, refresh = 39, 37
	for _, opt := range []uintptr{settingsChanged, refresh} {
		if r, _, err := internetSetOption.Call(0, opt, 0, 0); r == 0 {
			return err
		}
	}
	return nil
}

func hideWindow(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
}

func launchInstaller(path string) error {
	cmd := exec.Command(path)
	return cmd.Start()
}

func openExternal(url string) error {
	cmd := exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	hideWindow(cmd)
	return cmd.Start()
}
