package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/options"
	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
	"github.com/xtls/libxray/share"
	"github.com/xtls/libxray/xray"
	xcore "github.com/xtls/xray-core/core"

	xraybridge "github.com/weibschatten/we1ssconnect/core"
)

const balancerTag = "main"

// Status mirrors the Android module's VpnStatus.
type Status struct {
	State string  `json:"state"`
	Error *string `json:"error"`
}

// App is bound to the frontend as window.go.main.App.
type App struct {
	ctx   context.Context
	dir   string
	store *store

	mu     sync.Mutex
	status Status
}

func NewApp() (*App, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}
	dir := filepath.Join(base, "We1ssConnect")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}
	s, err := openStore(filepath.Join(dir, "store.json"))
	if err != nil {
		return nil, err
	}
	return &App{dir: dir, store: s, status: Status{State: "disconnected"}}, nil
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	// A crash while connected leaves the system proxy pointing at a dead port.
	if a.store.get(proxyFlagKey) == "on" {
		_ = setSystemProxy(false)
		a.store.set(proxyFlagKey, "")
	}
}

func (a *App) beforeClose(ctx context.Context) bool {
	a.disconnect()
	return false
}

func (a *App) shutdown(ctx context.Context) { a.disconnect() }

func (a *App) secondInstance(options.SecondInstanceData) {
	wruntime.WindowUnminimise(a.ctx)
	wruntime.WindowShow(a.ctx)
}

func (a *App) setStatus(state string, err error) {
	a.mu.Lock()
	a.status = Status{State: state}
	if err != nil {
		msg := err.Error()
		a.status.Error = &msg
	}
	s := a.status
	a.mu.Unlock()
	if a.ctx != nil {
		wruntime.EventsEmit(a.ctx, "status", s)
	}
}

func (a *App) Status() Status {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.status
}

func (a *App) Platform() string { return runtime.GOOS + "-" + runtime.GOARCH }

func (a *App) XrayVersion() string { return xcore.Version() }

func (a *App) ConvertShareLinks(text string) (string, error) {
	out, err := share.ConvertShareLinksToXrayJson(text, "")
	return string(out), err
}

func (a *App) ShareLinks(xrayJSON string) (string, error) {
	return share.ConvertXrayJsonToShareLinks([]byte(xrayJSON))
}

// Ping measures through each config's "proxy" outbound with nothing running.
func (a *App) Ping(configs []string, url string, timeoutSeconds int) ([]int64, error) {
	items := make([]xray.PingBatchItem, len(configs))
	for i, c := range configs {
		items[i] = xray.PingBatchItem{XrayJSON: c, OutboundTag: "proxy"}
	}
	results, err := xray.PingBatch(items, timeoutSeconds, url)
	if err != nil {
		return nil, err
	}
	out := make([]int64, len(results))
	for i, r := range results {
		out[i] = -1
		if r.Success {
			out[i] = r.Delay
		}
	}
	return out, nil
}

func (a *App) ServerPing(targetsJSON string, timeoutMs int) ([]int64, error) {
	var targets []pingTarget
	if err := json.Unmarshal([]byte(targetsJSON), &targets); err != nil {
		return nil, err
	}
	return measure(targets, time.Duration(timeoutMs)*time.Millisecond), nil
}

// Start runs Xray as a local SOCKS/HTTP proxy and points the system proxy at it.
func (a *App) Start(config, title, target string) {
	go func() {
		a.setStatus("connecting", nil)
		if err := a.connect(config, target); err != nil {
			a.disconnectCore()
			a.setStatus("error", err)
			return
		}
		a.setStatus("connected", nil)
	}()
}

func (a *App) connect(config, target string) error {
	a.disconnectCore()
	desktop, err := desktopConfig(config, filepath.Join(a.dir, "geo"))
	if err != nil {
		return err
	}
	if err := xraybridge.Start(desktop); err != nil {
		return err
	}
	if target != "" {
		if err := xraybridge.SetBalancerTarget(balancerTag, target); err != nil {
			return err
		}
	}
	if err := setSystemProxy(true); err != nil {
		return fmt.Errorf("system proxy: %w", err)
	}
	a.store.set(proxyFlagKey, "on")
	return nil
}

func (a *App) disconnectCore() {
	if a.store.get(proxyFlagKey) == "on" {
		_ = setSystemProxy(false)
		a.store.set(proxyFlagKey, "")
	}
	_ = xraybridge.Stop()
}

func (a *App) disconnect() {
	if xraybridge.IsRunning() || a.Status().State != "disconnected" {
		a.disconnectCore()
		a.setStatus("disconnected", nil)
	}
}

func (a *App) Stop() { a.disconnect() }

func (a *App) Observation() (string, error) { return xraybridge.Observation() }

func (a *App) BalancerTarget() (string, error) { return xraybridge.BalancerTarget(balancerTag) }

func (a *App) SetTarget(target string) error {
	return xraybridge.SetBalancerTarget(balancerTag, target)
}

func (a *App) Traffic() (string, error) { return xraybridge.Traffic() }

func (a *App) HTTPGet(url string, timeoutMs int) (string, error) {
	return xraybridge.HTTPGet(url, "", timeoutMs)
}

// FetchResult carries what the subscription code reads from a response.
type FetchResult struct {
	Status  int               `json:"status"`
	Body    string            `json:"body"`
	Headers map[string]string `json:"headers"`
}

// Fetch downloads a subscription from Go, which the webview's CORS rules would block.
func (a *App) Fetch(url, userAgent string) (*FetchResult, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "*/*")
	res, err := (&http.Client{Timeout: 30 * time.Second}).Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	body, err := io.ReadAll(io.LimitReader(res.Body, 16<<20))
	if err != nil {
		return nil, err
	}
	headers := map[string]string{}
	for k := range res.Header {
		headers[strings.ToLower(k)] = res.Header.Get(k)
	}
	return &FetchResult{Status: res.StatusCode, Body: string(body), Headers: headers}, nil
}

func (a *App) DownloadGeo(files map[string]string) (float64, error) {
	dir := filepath.Join(a.dir, "geo")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return 0, err
	}
	for name, url := range files {
		if err := download(url, filepath.Join(dir, filepath.Base(name)), nil); err != nil {
			return 0, err
		}
	}
	return a.GeoUpdatedAt(), nil
}

func (a *App) GeoUpdatedAt() float64 {
	var oldest time.Time
	for _, name := range []string{"geoip.dat", "geosite.dat"} {
		info, err := os.Stat(filepath.Join(a.dir, "geo", name))
		if err != nil || info.Size() == 0 {
			return 0
		}
		if oldest.IsZero() || info.ModTime().Before(oldest) {
			oldest = info.ModTime()
		}
	}
	return float64(oldest.UnixMilli())
}

// InstallUpdate downloads a release's installer and starts it; the app quits so it can be replaced.
func (a *App) InstallUpdate(url string) error {
	target := filepath.Join(os.TempDir(), filepath.Base(url))
	err := download(url, target, func(done, total int64) {
		wruntime.EventsEmit(a.ctx, "download", map[string]float64{"done": float64(done), "total": float64(total)})
	})
	if err != nil {
		return err
	}
	if err := launchInstaller(target); err != nil {
		return err
	}
	a.disconnect()
	wruntime.Quit(a.ctx)
	return nil
}

// OpenURL hands a link to the system, so tg:// links reach the Telegram app.
func (a *App) OpenURL(url string) error {
	if !strings.HasPrefix(url, "https://") && !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "tg://") {
		return fmt.Errorf("not opening %q", url)
	}
	return openExternal(url)
}

func (a *App) LoadStore() map[string]string { return a.store.all() }

func (a *App) SaveItem(key string, value *string) error {
	if value == nil {
		return a.store.del(key)
	}
	return a.store.set(key, *value)
}

func download(url, target string, progress func(done, total int64)) error {
	res, err := (&http.Client{Timeout: 10 * time.Minute}).Get(url)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP %d for %s", res.StatusCode, url)
	}
	tmp := target + ".part"
	f, err := os.Create(tmp)
	if err != nil {
		return err
	}
	var done, reported int64
	buf := make([]byte, 64<<10)
	for {
		n, rerr := res.Body.Read(buf)
		if n > 0 {
			if _, werr := f.Write(buf[:n]); werr != nil {
				f.Close()
				os.Remove(tmp)
				return werr
			}
			done += int64(n)
			if progress != nil && done-reported >= 512<<10 {
				reported = done
				progress(done, res.ContentLength)
			}
		}
		if errors.Is(rerr, io.EOF) {
			break
		}
		if rerr != nil {
			f.Close()
			os.Remove(tmp)
			return rerr
		}
	}
	if err := f.Close(); err != nil {
		return err
	}
	if done == 0 {
		os.Remove(tmp)
		return fmt.Errorf("empty file from %s", url)
	}
	if progress != nil {
		progress(done, res.ContentLength)
	}
	return os.Rename(tmp, target)
}
