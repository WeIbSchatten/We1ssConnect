// Command geolite cuts geosite.dat and geoip.dat down to the categories the apps' presets and
// common rules use (src/lib/geo-lite.json): ~6 MB instead of ~100 MB to download on a phone.
//
//	geolite -list src/lib/geo-lite.json -geosite in/geosite.dat -geoip in/geoip.dat -out dir
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/xtls/xray-core/common/geodata"
	"google.golang.org/protobuf/proto"
)

// Lite is the shape of src/lib/geo-lite.json.
type Lite struct {
	Geosite []string `json:"geosite"`
	Geoip   []string `json:"geoip"`
}

func subsetSites(raw []byte, codes []string) ([]byte, error) {
	var list geodata.GeoSiteList
	if err := proto.Unmarshal(raw, &list); err != nil {
		return nil, err
	}
	byCode := map[string]*geodata.GeoSite{}
	for _, e := range list.Entry {
		byCode[strings.ToLower(e.Code)] = e
	}
	out := &geodata.GeoSiteList{}
	for _, c := range codes {
		e, ok := byCode[strings.ToLower(c)]
		if !ok {
			return nil, fmt.Errorf("geosite has no category %s", c)
		}
		out.Entry = append(out.Entry, e)
	}
	return proto.Marshal(out)
}

func subsetIPs(raw []byte, codes []string) ([]byte, error) {
	var list geodata.GeoIPList
	if err := proto.Unmarshal(raw, &list); err != nil {
		return nil, err
	}
	byCode := map[string]*geodata.GeoIP{}
	for _, e := range list.Entry {
		byCode[strings.ToLower(e.Code)] = e
	}
	out := &geodata.GeoIPList{}
	for _, c := range codes {
		e, ok := byCode[strings.ToLower(c)]
		if !ok {
			return nil, fmt.Errorf("geoip has no category %s", c)
		}
		out.Entry = append(out.Entry, e)
	}
	return proto.Marshal(out)
}

func cut(in, out string, codes []string, subset func([]byte, []string) ([]byte, error)) error {
	raw, err := os.ReadFile(in)
	if err != nil {
		return err
	}
	data, err := subset(raw, codes)
	if err != nil {
		return err
	}
	return os.WriteFile(out, data, 0o644)
}

func main() {
	listPath := flag.String("list", "", "geo-lite.json")
	site := flag.String("geosite", "", "full geosite.dat")
	ip := flag.String("geoip", "", "full geoip.dat")
	dir := flag.String("out", "", "output directory")
	flag.Parse()

	raw, err := os.ReadFile(*listPath)
	if err != nil {
		log.Fatal(err)
	}
	var lite Lite
	if err := json.Unmarshal(raw, &lite); err != nil {
		log.Fatal(err)
	}
	if err := cut(*site, filepath.Join(*dir, "geosite.dat"), lite.Geosite, subsetSites); err != nil {
		log.Fatal(err)
	}
	if err := cut(*ip, filepath.Join(*dir, "geoip.dat"), lite.Geoip, subsetIPs); err != nil {
		log.Fatal(err)
	}
}
