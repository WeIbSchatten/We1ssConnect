package main

import (
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strconv"
)

// setSystemProxy sets the desktop proxy for GNOME-based desktops (gsettings) and KDE
// (kwriteconfig). Apps that ignore both can use SOCKS5 127.0.0.1:10808 directly.
func setSystemProxy(on bool) error {
	var errs []error
	done := false
	if _, err := exec.LookPath("gsettings"); err == nil {
		done = true
		if on {
			for _, kind := range []string{"http", "https"} {
				errs = append(errs, run("gsettings", "set", "org.gnome.system.proxy."+kind, "host", "127.0.0.1"),
					run("gsettings", "set", "org.gnome.system.proxy."+kind, "port", strconv.Itoa(httpPort)))
			}
			errs = append(errs,
				run("gsettings", "set", "org.gnome.system.proxy.socks", "host", "127.0.0.1"),
				run("gsettings", "set", "org.gnome.system.proxy.socks", "port", strconv.Itoa(socksPort)),
				run("gsettings", "set", "org.gnome.system.proxy", "ignore-hosts",
					"['localhost', '127.0.0.0/8', '::1', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']"),
				run("gsettings", "set", "org.gnome.system.proxy", "mode", "manual"))
		} else {
			errs = append(errs, run("gsettings", "set", "org.gnome.system.proxy", "mode", "none"))
		}
	}
	for _, tool := range []string{"kwriteconfig6", "kwriteconfig5"} {
		if _, err := exec.LookPath(tool); err != nil || os.Getenv("XDG_CURRENT_DESKTOP") != "KDE" {
			continue
		}
		done = true
		mode := "0"
		if on {
			mode = "1"
			addr := fmt.Sprintf("http://127.0.0.1 %d", httpPort)
			errs = append(errs,
				run(tool, "--file", "kioslaverc", "--group", "Proxy Settings", "--key", "httpProxy", addr),
				run(tool, "--file", "kioslaverc", "--group", "Proxy Settings", "--key", "httpsProxy", addr),
				run(tool, "--file", "kioslaverc", "--group", "Proxy Settings", "--key", "socksProxy",
					fmt.Sprintf("socks://127.0.0.1 %d", socksPort)))
		}
		errs = append(errs, run(tool, "--file", "kioslaverc", "--group", "Proxy Settings", "--key", "ProxyType", mode))
		break
	}
	if !done && on {
		return errors.New("no gsettings or kwriteconfig: set the proxy to 127.0.0.1:10809 (HTTP) or 10808 (SOCKS5) by hand")
	}
	return errors.Join(errs...)
}

func run(name string, args ...string) error {
	if out, err := exec.Command(name, args...).CombinedOutput(); err != nil {
		return fmt.Errorf("%s: %v: %s", name, err, out)
	}
	return nil
}

func hideWindow(*exec.Cmd) {}

// The Linux build ships as an AppImage: the new one replaces the running file.
// launchInstaller swaps the running binary for the downloaded one and starts it.
// The copy goes next to the binary first, so the final rename stays on one filesystem.
func launchInstaller(path string) error {
	self, err := os.Executable()
	if err != nil {
		return err
	}
	if appImage := os.Getenv("APPIMAGE"); appImage != "" {
		self = appImage
	}
	next := self + ".new"
	if err := copyFile(path, next, 0o755); err != nil {
		return fmt.Errorf("cannot replace %s: %w", self, err)
	}
	if err := os.Rename(next, self); err != nil {
		return err
	}
	_ = os.Remove(path)
	return exec.Command(self).Start()
}

func copyFile(from, to string, mode os.FileMode) error {
	in, err := os.Open(from)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(to, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, mode)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}

func openExternal(url string) error { return exec.Command("xdg-open", url).Start() }
