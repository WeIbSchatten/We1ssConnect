package main

import (
	"strings"
	"testing"

	"github.com/xtls/xray-core/common/geodata"
	"google.golang.org/protobuf/proto"
)

func sites(t *testing.T, codes ...string) []byte {
	t.Helper()
	list := &geodata.GeoSiteList{}
	for _, c := range codes {
		list.Entry = append(list.Entry, &geodata.GeoSite{Code: c, Domain: []*geodata.Domain{{Value: strings.ToLower(c) + ".example"}}})
	}
	raw, err := proto.Marshal(list)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func TestSubsetKeepsTheListedCategoriesInListOrder(t *testing.T) {
	out, err := subsetSites(sites(t, "CATEGORY-RU", "RU-BLOCKED-ALL", "CATEGORY-ADS-ALL"), []string{"category-ads-all", "category-ru"})
	if err != nil {
		t.Fatal(err)
	}
	var got geodata.GeoSiteList
	if err := proto.Unmarshal(out, &got); err != nil {
		t.Fatal(err)
	}
	var codes []string
	for _, e := range got.Entry {
		codes = append(codes, e.Code+"="+e.Domain[0].Value)
	}
	if want := "CATEGORY-ADS-ALL=category-ads-all.example,CATEGORY-RU=category-ru.example"; strings.Join(codes, ",") != want {
		t.Fatalf("codes = %v, want %s", codes, want)
	}
}

func TestSubsetFailsOnACategoryTheSourceDropped(t *testing.T) {
	_, err := subsetSites(sites(t, "CATEGORY-RU"), []string{"category-ru", "gone"})
	if err == nil || err.Error() != "geosite has no category gone" {
		t.Fatalf("err = %v", err)
	}
}

func TestSubsetOfAddresses(t *testing.T) {
	list := &geodata.GeoIPList{Entry: []*geodata.GeoIP{{Code: "RU", Cidr: []*geodata.CIDR{{Ip: []byte{5, 0, 0, 0}, Prefix: 8}}}, {Code: "CN"}}}
	raw, _ := proto.Marshal(list)
	out, err := subsetIPs(raw, []string{"ru"})
	if err != nil {
		t.Fatal(err)
	}
	var got geodata.GeoIPList
	_ = proto.Unmarshal(out, &got)
	if len(got.Entry) != 1 || got.Entry[0].Code != "RU" || got.Entry[0].Cidr[0].Prefix != 8 {
		t.Fatalf("got %v", got.Entry)
	}
	if _, err := subsetIPs(raw, []string{"de"}); err == nil || err.Error() != "geoip has no category de" {
		t.Fatalf("err = %v", err)
	}
}
