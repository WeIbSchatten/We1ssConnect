package main

import (
	"context"
	"net"
	"os/exec"
	"regexp"
	"runtime"
	"strconv"
	"sync"
	"time"
)

type pingTarget struct {
	Host string `json:"host"`
	Port int    `json:"port"`
	UDP  bool   `json:"udp"`
}

// measure returns the delay to each server's own address in ms, -1 when unreachable:
// the best of two TCP connects, or the system ping for UDP-only servers (Hysteria2).
func measure(targets []pingTarget, timeout time.Duration) []int64 {
	out := make([]int64, len(targets))
	var wg sync.WaitGroup
	sem := make(chan struct{}, 16)
	for i, t := range targets {
		wg.Add(1)
		go func() {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			out[i] = one(t, timeout)
		}()
	}
	wg.Wait()
	return out
}

func one(t pingTarget, timeout time.Duration) int64 {
	if t.Host == "" {
		return -1
	}
	// Name resolution is not part of the delay to the server.
	ips, err := net.DefaultResolver.LookupHost(context.Background(), t.Host)
	if err != nil || len(ips) == 0 {
		return -1
	}
	if t.UDP {
		return systemPing(ips[0], timeout)
	}
	best := int64(-1)
	for range 2 {
		start := time.Now()
		conn, err := net.DialTimeout("tcp", net.JoinHostPort(ips[0], strconv.Itoa(t.Port)), timeout)
		if err != nil {
			continue
		}
		ms := time.Since(start).Milliseconds()
		conn.Close()
		if best < 0 || ms < best {
			best = ms
		}
	}
	return best
}

// "time=23.4 ms", "время=23мс", "time<1ms": the first number after = or <.
var pingTime = regexp.MustCompile(`[=<]\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:ms|мс)`)

func systemPing(ip string, timeout time.Duration) int64 {
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.Command("ping", "-n", "2", "-w", strconv.Itoa(int(timeout.Milliseconds())), ip)
	} else {
		cmd = exec.Command("ping", "-c", "2", "-W", strconv.Itoa(max(1, int(timeout.Seconds()))), ip)
	}
	hideWindow(cmd)
	raw, _ := cmd.Output()
	best := int64(-1)
	for _, m := range pingTime.FindAllStringSubmatch(string(raw), -1) {
		v, err := strconv.ParseFloat(regexp.MustCompile(`,`).ReplaceAllString(m[1], "."), 64)
		if err != nil {
			continue
		}
		if ms := int64(v + 0.5); best < 0 || ms < best {
			best = ms
		}
	}
	return best
}
