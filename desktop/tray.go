package main

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/png"
	"runtime"

	"github.com/energye/systray"
	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// startTray puts the app in the system tray. Closing the window only hides it, so the VPN keeps
// running in the background until "Quit" (the window close used to disconnect and exit).
func (a *App) startTray() {
	go systray.Run(a.trayReady, nil)
}

func (a *App) trayReady() {
	systray.SetIcon(trayIcon(icon, runtime.GOOS == "windows"))
	systray.SetTooltip("We1ssConnect")
	ru := a.store.get("native.language") != "en"
	label := func(r, e string) string {
		if ru {
			return r
		}
		return e
	}
	open := systray.AddMenuItem(label("Открыть", "Open"), "")
	toggle := systray.AddMenuItem(label("Подключить / отключить", "Connect / disconnect"), "")
	systray.AddSeparator()
	quit := systray.AddMenuItem(label("Выход", "Quit"), "")
	open.Click(a.showWindow)
	// The frontend builds the config, so it is the one that connects.
	toggle.Click(func() { wruntime.EventsEmit(a.ctx, "tray-toggle") })
	quit.Click(a.quit)
	systray.SetOnClick(func(systray.IMenu) { a.showWindow() })
	systray.SetOnDClick(func(systray.IMenu) { a.showWindow() })
	systray.SetOnRClick(func(menu systray.IMenu) { _ = menu.ShowMenu() })
}

func (a *App) showWindow() {
	wruntime.WindowShow(a.ctx)
	wruntime.WindowUnminimise(a.ctx)
}

func (a *App) quit() {
	a.quitting.Store(true)
	systray.Quit()
	wruntime.Quit(a.ctx)
}

// trayIcon scales the app icon down to tray size; Windows wants it inside an ICO container,
// which may hold a PNG since Vista.
func trayIcon(src []byte, ico bool) []byte {
	img, err := png.Decode(bytes.NewReader(src))
	if err != nil {
		return src
	}
	const size = 64
	small := image.NewNRGBA(image.Rect(0, 0, size, size))
	b := img.Bounds()
	for y := 0; y < size; y++ {
		for x := 0; x < size; x++ {
			small.Set(x, y, img.At(b.Min.X+x*b.Dx()/size, b.Min.Y+y*b.Dy()/size))
		}
	}
	var out bytes.Buffer
	if err := png.Encode(&out, small); err != nil {
		return src
	}
	if !ico {
		return out.Bytes()
	}
	var buf bytes.Buffer
	header := []uint16{0, 1, 1} // reserved, type icon, one image
	_ = binary.Write(&buf, binary.LittleEndian, header)
	buf.Write([]byte{size, size, 0, 0})                                              // width, height, palette, reserved
	_ = binary.Write(&buf, binary.LittleEndian, []uint16{1, 32})                     // planes, bits per pixel
	_ = binary.Write(&buf, binary.LittleEndian, []uint32{uint32(out.Len()), 6 + 16}) // size, offset
	buf.Write(out.Bytes())
	return buf.Bytes()
}
