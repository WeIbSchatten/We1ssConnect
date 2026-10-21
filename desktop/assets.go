package main

import (
	"bytes"
	"encoding/json"
	"io/fs"
	"net/http"
	"path"
	"strings"
)

// injectState serves index.html with the saved state inlined, because the shared code
// reads its store synchronously on start, before any call to Go could answer. It also
// serves index.html for app routes (/servers, /settings), which are not files.
func (a *App) injectState(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if p != "/" && p != "/index.html" && path.Ext(p) != "" {
			next.ServeHTTP(w, r)
			return
		}
		html, err := fs.ReadFile(assets, "frontend/dist/index.html")
		if err != nil {
			next.ServeHTTP(w, r)
			return
		}
		state, _ := json.Marshal(map[string]any{"store": a.store.all(), "platform": a.Platform()})
		// </script> inside a value would end the tag early.
		safe := strings.ReplaceAll(string(state), "</", `<\/`)
		script := []byte("<script>window.__WE1SS__=" + safe + "</script>")
		html = bytes.Replace(html, []byte("<head>"), append([]byte("<head>"), script...), 1)
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		_, _ = w.Write(html)
	})
}
