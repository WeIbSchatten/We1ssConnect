// We1ssConnect for Windows and Linux: the phone app's interface (exported for the web
// by Expo) in a Wails window, with Xray-core running in this process as a local proxy.
package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/appicon.png
var icon []byte

func main() {
	app, err := NewApp()
	if err != nil {
		log.Fatal(err)
	}
	err = wails.Run(&options.App{
		Title:            "We1ssConnect",
		Width:            460,
		Height:           860,
		MinWidth:         380,
		MinHeight:        600,
		BackgroundColour: &options.RGBA{R: 10, G: 10, B: 10, A: 255},
		AssetServer: &assetserver.Options{
			Assets:     assets,
			Middleware: app.injectState,
		},
		OnStartup:     app.startup,
		OnBeforeClose: app.beforeClose,
		OnShutdown:    app.shutdown,
		Bind:          []any{app},
		SingleInstanceLock: &options.SingleInstanceLock{
			UniqueId:               "com.we1bschatten.we1ssconnect",
			OnSecondInstanceLaunch: app.secondInstance,
		},
		Windows: &windows.Options{Theme: windows.SystemDefault},
		Linux:   &linux.Options{Icon: icon, ProgramName: "we1ssconnect"},
	})
	if err != nil {
		log.Fatal(err)
	}
}
