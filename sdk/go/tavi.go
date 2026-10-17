// Package tavi provides a standard-library-only LoopRD Social client.
package tavi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const Guest = "tavi_guest_v1"

type Client struct {
	Origin string
	Token  string
	HTTP   *http.Client
}

func New(origin, token string) (*Client, error) {
	u, e := url.Parse(origin)
	if e != nil || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || (u.Path != "" && u.Path != "/") {
		return nil, errors.New("expected server origin only")
	}
	if u.Scheme != "https" && !(u.Scheme == "http" && (u.Hostname() == "localhost" || u.Hostname() == "127.0.0.1" || u.Hostname() == "::1" || u.Hostname() == "10.0.2.2")) {
		return nil, errors.New("remote servers require HTTPS")
	}
	if token == "" {
		token = Guest
	}
	return &Client{strings.TrimSuffix(origin, "/"), token, &http.Client{Timeout: 12 * time.Second}}, nil
}
func (c *Client) Command(ctx context.Context, op string, fields map[string]any) (map[string]any, error) {
	data := map[string]any{"op": op}
	for k, v := range fields {
		if k == "op" || k == "token" {
			return nil, errors.New("reserved field")
		}
		data[k] = v
	}
	if c.Token != Guest {
		data["token"] = c.Token
	}
	body, e := json.Marshal(data)
	if e != nil {
		return nil, e
	}
	req, e := http.NewRequestWithContext(ctx, "POST", c.Origin+"/looprd/looprd-social/v1/social", bytes.NewReader(body))
	if e != nil {
		return nil, e
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.Token)
	resp, e := c.HTTP.Do(req)
	if e != nil {
		return nil, e
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("tavi HTTP %d", resp.StatusCode)
	}
	var out map[string]any
	if e = json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&out); e != nil {
		return nil, e
	}
	if out["ok"] != true {
		return nil, fmt.Errorf("tavi operation failed: %v", out["error"])
	}
	return out, nil
}
func (c *Client) Login(ctx context.Context, username, password string) error {
	r, e := c.Command(ctx, "login", map[string]any{"username": username, "password": password})
	if e != nil {
		return e
	}
	t, ok := r["token"].(string)
	if !ok || len(t) < 24 {
		return errors.New("invalid session")
	}
	c.Token = t
	return nil
}
func (c *Client) Me(ctx context.Context) (map[string]any, error) { return c.Command(ctx, "me", nil) }
func (c *Client) Contacts(ctx context.Context) (map[string]any, error) {
	return c.Command(ctx, "contact_list", nil)
}
func (c *Client) DirectSend(ctx context.Context, peer, text string) (map[string]any, error) {
	return c.Command(ctx, "dm_send", map[string]any{"peer": peer, "text": text})
}
func (c *Client) DirectFeed(ctx context.Context, peer string) (map[string]any, error) {
	return c.Command(ctx, "dm_feed", map[string]any{"peer": peer})
}
