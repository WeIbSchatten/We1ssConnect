package main

import (
	"encoding/json"
	"errors"
)

// Local ports the system proxy points at.
const (
	socksPort = 10808
	httpPort  = 10809
)

// desktopConfig turns the config the shared code builds for the phone (TUN inbound)
// into one for a desktop proxy: SOCKS and HTTP inbounds on localhost instead of the TUN.
func desktopConfig(phoneJSON, geoDir string) (string, error) {
	var c map[string]any
	if err := json.Unmarshal([]byte(phoneJSON), &c); err != nil {
		return "", err
	}
	if _, ok := c["outbounds"]; !ok {
		return "", errors.New("config has no outbounds")
	}
	sniffing := map[string]any{"enabled": true, "destOverride": []string{"http", "tls", "quic"}, "routeOnly": true}
	// "tun-in" keeps the tag the shared routing rules refer to.
	c["inbounds"] = []any{
		map[string]any{
			"tag": "tun-in", "protocol": "socks", "listen": "127.0.0.1", "port": socksPort,
			"settings": map[string]any{"udp": true, "auth": "noauth"}, "sniffing": sniffing,
		},
		map[string]any{
			"tag": "http-in", "protocol": "http", "listen": "127.0.0.1", "port": httpPort, "sniffing": sniffing,
		},
	}
	c["env"] = map[string]any{"xray.location.asset": geoDir}
	out, err := json.Marshal(c)
	return string(out), err
}
