// Package xraybridge runs Xray-core inside the app and answers questions about the
// running instance (server delays, the server the balancer picked, traffic, HTTP
// requests through the tunnel) without opening any local ports.
package xraybridge

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"runtime/debug"
	"strings"
	"sync"
	"time"

	"github.com/xtls/xray-core/app/observatory"
	"github.com/xtls/xray-core/common/net"
	"github.com/xtls/xray-core/common/session"
	"github.com/xtls/xray-core/core"
	"github.com/xtls/xray-core/features/extension"
	"github.com/xtls/xray-core/features/routing"
	"github.com/xtls/xray-core/features/stats"
	_ "github.com/xtls/xray-core/main/distro/all"
)

// ServerTagPrefix marks the outbounds that are user servers.
const ServerTagPrefix = "s-"

var (
	mu       sync.Mutex
	instance *core.Instance
)

var errNotRunning = errors.New("xray is not running")

// Start runs Xray with a JSON config. Only one instance runs at a time.
func Start(configJSON string) error {
	mu.Lock()
	defer mu.Unlock()
	if instance != nil {
		return errors.New("xray is already running")
	}
	config, err := core.LoadConfig("json", strings.NewReader(configJSON))
	if err != nil {
		return err
	}
	server, err := core.New(config)
	if err != nil {
		return err
	}
	if err := server.Start(); err != nil {
		_ = server.Close()
		return err
	}
	instance = server
	debug.FreeOSMemory()
	return nil
}

// Stop closes the running instance, if any.
func Stop() error {
	mu.Lock()
	defer mu.Unlock()
	if instance == nil {
		return nil
	}
	err := instance.Close()
	instance = nil
	debug.FreeOSMemory()
	return err
}

func IsRunning() bool {
	mu.Lock()
	defer mu.Unlock()
	return instance != nil && instance.IsRunning()
}

func current() (*core.Instance, error) {
	mu.Lock()
	defer mu.Unlock()
	if instance == nil {
		return nil, errNotRunning
	}
	return instance, nil
}

type serverStatus struct {
	Tag   string `json:"tag"`
	Alive bool   `json:"alive"`
	Delay int64  `json:"delay"`
	Error string `json:"error,omitempty"`
}

// Observation returns the observatory's latest probe of every server as JSON:
// [{"tag":"s-…","alive":true,"delay":123}], or "[]" when the config has no observatory.
func Observation() (string, error) {
	inst, err := current()
	if err != nil {
		return "", err
	}
	feature := inst.GetFeature(extension.ObservatoryType())
	if feature == nil {
		return "[]", nil
	}
	msg, err := feature.(extension.Observatory).GetObservation(context.Background())
	if err != nil {
		return "", err
	}
	result, ok := msg.(*observatory.ObservationResult)
	if !ok {
		return "[]", nil
	}
	out := make([]serverStatus, 0, len(result.GetStatus()))
	for _, s := range result.GetStatus() {
		out = append(out, serverStatus{
			Tag:   s.GetOutboundTag(),
			Alive: s.GetAlive(),
			Delay: s.GetDelay(),
			Error: s.GetLastErrorReason(),
		})
	}
	b, err := json.Marshal(out)
	return string(b), err
}

// BalancerTarget returns the outbound the balancer currently sends traffic to,
// or "" when it has not decided yet.
func BalancerTarget(balancerTag string) (string, error) {
	inst, err := current()
	if err != nil {
		return "", err
	}
	router, ok := inst.GetFeature(routing.RouterType()).(routing.BalancerPrincipleTarget)
	if !ok {
		return "", errors.New("router cannot report balancer targets")
	}
	targets, err := router.GetPrincipleTarget(balancerTag)
	if err != nil || len(targets) == 0 {
		return "", err
	}
	return targets[0], nil
}

// SetBalancerTarget pins the balancer to one outbound; "" lets it pick by delay again.
// Switching servers this way needs no restart.
func SetBalancerTarget(balancerTag, target string) error {
	inst, err := current()
	if err != nil {
		return err
	}
	router, ok := inst.GetFeature(routing.RouterType()).(routing.BalancerOverrider)
	if !ok {
		return errors.New("router cannot override balancers")
	}
	return router.SetOverrideTarget(balancerTag, target)
}

// Traffic returns the bytes sent and received through the servers so far as JSON:
// {"up":123,"down":456}. It needs "stats" and the outbound stats policy in the config.
func Traffic() (string, error) {
	inst, err := current()
	if err != nil {
		return "", err
	}
	var up, down int64
	if manager, ok := inst.GetFeature(stats.ManagerType()).(stats.Manager); ok {
		manager.VisitCounters(func(name string, c stats.Counter) bool {
			// outbound>>>s-xxx>>>traffic>>>uplink
			parts := strings.Split(name, ">>>")
			if len(parts) == 4 && parts[0] == "outbound" && strings.HasPrefix(parts[1], ServerTagPrefix) {
				switch parts[3] {
				case "uplink":
					up += c.Value()
				case "downlink":
					down += c.Value()
				}
			}
			return true
		})
	}
	b, err := json.Marshal(map[string]int64{"up": up, "down": down})
	return string(b), err
}

func client(inst *core.Instance, outboundTag string, timeout time.Duration) *http.Client {
	transport := &http.Transport{
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			dest, err := net.ParseDestination(network + ":" + addr)
			if err != nil {
				return nil, err
			}
			if outboundTag != "" {
				ctx = session.SetForcedOutboundTagToContext(ctx, outboundTag)
			}
			return core.Dial(ctx, inst, dest)
		},
		DisableKeepAlives: true,
	}
	return &http.Client{Transport: transport, Timeout: timeout}
}

// HTTPGet fetches a URL through the running tunnel and returns the body (at most 64 KiB).
// outboundTag forces a server; "" lets routing decide.
func HTTPGet(url, outboundTag string, timeoutMs int) (string, error) {
	inst, err := current()
	if err != nil {
		return "", err
	}
	res, err := client(inst, outboundTag, time.Duration(timeoutMs)*time.Millisecond).Get(url)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	body, err := io.ReadAll(io.LimitReader(res.Body, 64<<10))
	if err != nil {
		return "", err
	}
	if res.StatusCode >= 400 {
		return "", errors.New(res.Status)
	}
	return string(body), nil
}

// Delay measures one request through the running tunnel in milliseconds.
func Delay(url, outboundTag string, timeoutMs int) (int64, error) {
	inst, err := current()
	if err != nil {
		return -1, err
	}
	start := time.Now()
	res, err := client(inst, outboundTag, time.Duration(timeoutMs)*time.Millisecond).Head(url)
	if err != nil {
		return -1, err
	}
	res.Body.Close()
	return time.Since(start).Milliseconds(), nil
}
