package tavi

import "testing"

func TestOrigins(t *testing.T) {
	if _, e := New("https://api.example.org", ""); e != nil {
		t.Fatal(e)
	}
	for _, v := range []string{"http://remote.example.org", "https://user:pass@example.org", "https://example.org/api"} {
		if _, e := New(v, ""); e == nil {
			t.Fatalf("accepted %s", v)
		}
	}
}
