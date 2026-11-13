package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRequestPassesMethodHeadersAndBody(t *testing.T) {
	var gotMethod, gotAuth, gotUA, gotBody string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod, gotAuth, gotUA = r.Method, r.Header.Get("Authorization"), r.Header.Get("User-Agent")
		b, _ := io.ReadAll(r.Body)
		gotBody = string(b)
		w.Header().Set("Retry-After", "30")
		w.WriteHeader(http.StatusTooManyRequests)
		_, _ = w.Write([]byte(`{"error":"too_many_attempts"}`))
	}))
	defer srv.Close()

	res, err := (&App{}).Request(http.MethodPost, srv.URL+"/portal/api/login", "We1ssConnect/1.10.1",
		map[string]string{"Authorization": "Bearer t1", "Content-Type": "application/json"}, `{"login":"a"}`)
	if err != nil {
		t.Fatal(err)
	}
	if gotMethod != http.MethodPost || gotAuth != "Bearer t1" || gotUA != "We1ssConnect/1.10.1" || gotBody != `{"login":"a"}` {
		t.Fatalf("server saw method=%q auth=%q ua=%q body=%q", gotMethod, gotAuth, gotUA, gotBody)
	}
	if res.Status != http.StatusTooManyRequests || res.Headers["retry-after"] != "30" || res.Body != `{"error":"too_many_attempts"}` {
		t.Fatalf("result = %+v", res)
	}
}
