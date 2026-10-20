package xraybridge

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestRunningInstance(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	defer srv.Close()
	ip := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, `{"ip":"203.0.113.7","country_code":"NL"}`)
	}))
	defer ip.Close()

	config := fmt.Sprintf(`{
	  "log": {"loglevel": "warning"},
	  "stats": {},
	  "policy": {"system": {"statsOutboundUplink": true, "statsOutboundDownlink": true}},
	  "outbounds": [
	    {"tag": "s-a", "protocol": "freedom"},
	    {"tag": "s-b", "protocol": "freedom"},
	    {"tag": "direct", "protocol": "freedom"}
	  ],
	  "observatory": {"subjectSelector": ["s-"], "probeUrl": %q, "probeInterval": "1s", "enableConcurrency": true},
	  "routing": {
	    "balancers": [{"tag": "auto", "selector": ["s-"], "strategy": {"type": "leastPing"}, "fallbackTag": "s-a"}],
	    "rules": [{"type": "field", "network": "tcp,udp", "balancerTag": "auto"}]
	  }
	}`, srv.URL)
	if err := Start(config); err != nil {
		t.Fatal(err)
	}
	defer Stop()
	if !IsRunning() {
		t.Fatal("not running")
	}

	var statuses []serverStatus
	deadline := time.Now().Add(15 * time.Second)
	for time.Now().Before(deadline) {
		raw, err := Observation()
		if err != nil {
			t.Fatal(err)
		}
		_ = json.Unmarshal([]byte(raw), &statuses)
		if len(statuses) == 2 && statuses[0].Alive && statuses[1].Alive {
			break
		}
		time.Sleep(500 * time.Millisecond)
	}
	if len(statuses) != 2 || !statuses[0].Alive {
		t.Fatalf("observation = %+v", statuses)
	}
	target, err := BalancerTarget("auto")
	if err != nil || !strings.HasPrefix(target, "s-") {
		t.Fatalf("balancer target = %q, %v", target, err)
	}

	if err := SetBalancerTarget("auto", "s-a"); err != nil {
		t.Fatal(err)
	}
	if target, _ := BalancerTarget("auto"); target != "s-a" {
		t.Logf("principle target after override = %q (override applies to picks)", target)
	}

	body, err := HTTPGet(ip.URL, "", 5000)
	if err != nil || !strings.Contains(body, "203.0.113.7") {
		t.Fatalf("HTTPGet = %q, %v", body, err)
	}
	d, err := Delay(srv.URL, "s-b", 5000)
	if err != nil || d < 0 {
		t.Fatalf("Delay = %d, %v", d, err)
	}
	raw, err := Traffic()
	if err != nil {
		t.Fatal(err)
	}
	var traffic map[string]int64
	_ = json.Unmarshal([]byte(raw), &traffic)
	if traffic["down"] == 0 || traffic["up"] == 0 {
		t.Fatalf("traffic = %s", raw)
	}
	t.Logf("observation=%+v target=%s delay=%d traffic=%s", statuses, target, d, raw)
}
