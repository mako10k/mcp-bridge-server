# Codex Network Restrictions

This repository is designed to operate in the Codex environment. The environment uses an HTTP(S) proxy for all outbound network traffic and blocks some domains. Important behaviors observed:

- **Proxy**: All requests go through `http://proxy:8080`. The proxy's root certificate is installed at `/usr/local/share/ca-certificates/envoy-mitmproxy-ca-cert.crt`.
- **Environment variables**: `HTTP_PROXY` and `HTTPS_PROXY` are set to `http://proxy:8080` while `NO_PROXY` excludes `localhost`.
- **Monitoring**: The proxy intercepts TLS connections, so all requests are logged.
- **Blocked domains**: Certain domains return `403 Forbidden`. For example, `nytimes.com` is blocked:

  ```bash
  $ curl -I https://nytimes.com
  HTTP/1.1 403 Forbidden
  ```
- **Allowed domains**: Many standard sites (e.g., `example.com`, `github.com`) are reachable.
- **Partial access**: Some OpenAI documentation pages respond with `403`, likely due to additional access restrictions.

When network access fails unexpectedly, check the proxy logs or try a different domain. Be mindful that all requests may be audited.
