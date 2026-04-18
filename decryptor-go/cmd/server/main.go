package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	runv3 "applemusicdecryptor"
)

type decryptSongRequest struct {
	AdamID         string `json:"adamId"`
	Authorization  string `json:"authorizationToken"`
	MediaUserToken string `json:"mediaUserToken"`
	OutputPath     string `json:"outputPath"`
}

type apiResponse struct {
	OK    bool   `json:"ok"`
	Error string `json:"error,omitempty"`
}

func writeJSON(w http.ResponseWriter, status int, payload apiResponse) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func main() {
	port := flag.Int("port", 19123, "api port")
	flag.Parse()

	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, apiResponse{OK: true})
	})

	mux.HandleFunc("/decrypt/song", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, apiResponse{OK: false, Error: "method not allowed"})
			return
		}

		var req decryptSongRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, apiResponse{OK: false, Error: fmt.Sprintf("invalid json: %v", err)})
			return
		}
		if req.AdamID == "" || req.Authorization == "" || req.MediaUserToken == "" || req.OutputPath == "" {
			writeJSON(w, http.StatusBadRequest, apiResponse{OK: false, Error: "missing required fields"})
			return
		}

		if err := os.MkdirAll(filepath.Dir(req.OutputPath), 0o755); err != nil {
			writeJSON(w, http.StatusInternalServerError, apiResponse{OK: false, Error: fmt.Sprintf("mkdir failed: %v", err)})
			return
		}

		if _, err := runv3.Run(req.AdamID, req.OutputPath, req.Authorization, req.MediaUserToken, false); err != nil {
			writeJSON(w, http.StatusInternalServerError, apiResponse{OK: false, Error: err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, apiResponse{OK: true})
	})

	server := &http.Server{
		Addr:              fmt.Sprintf("127.0.0.1:%d", *port),
		Handler:           mux,
		ReadHeaderTimeout: 8 * time.Second,
	}
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		panic(err)
	}
}
