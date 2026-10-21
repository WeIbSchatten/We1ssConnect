package main

import (
	"encoding/json"
	"errors"
	"os"
	"sync"
)

// Set while the system proxy points at us, so a crash is cleaned up on the next start.
const proxyFlagKey = "native.systemProxy"

// store is the desktop stand-in for the phone's SharedPreferences: one JSON file.
type store struct {
	mu   sync.Mutex
	path string
	data map[string]string
}

func openStore(path string) (*store, error) {
	s := &store{path: path, data: map[string]string{}}
	raw, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return s, nil
	}
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(raw, &s.data); err != nil {
		// A broken file starts over rather than keeping the app from opening.
		s.data = map[string]string{}
	}
	return s, nil
}

func (s *store) get(key string) string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.data[key]
}

func (s *store) all() map[string]string {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make(map[string]string, len(s.data))
	for k, v := range s.data {
		out[k] = v
	}
	return out
}

func (s *store) set(key, value string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if value == "" {
		delete(s.data, key)
	} else {
		s.data[key] = value
	}
	return s.save()
}

func (s *store) del(key string) error { return s.set(key, "") }

func (s *store) save() error {
	raw, err := json.Marshal(s.data)
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}
