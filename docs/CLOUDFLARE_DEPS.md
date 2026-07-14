# Cloudflare CDN & WAF Configuration Guide (Task 60)

This document contains step-by-step instructions to configure Cloudflare edge capabilities, DDoS protection profiles, and WAF rules for DO IT SERVICES domains (`app.doitservices.in` and `api.doitservices.in`).

---

## 1. Cloudflare DNS & Proxy Setup
1. **Delegation**: Ensure your domain nameservers are pointed directly to your assigned Cloudflare nameservers.
2. **DNS Records**:
   - Create an `A` record pointing `app` (Frontend Next.js application) to your server's public IP address.
   - Create an `A` record pointing `api` (Backend FastAPI service) to your server's public IP address.
3. **Proxied Status**: Ensure the **Orange Cloud (Proxied)** icon is toggled **ON** for both records. This masks your backend origin IP address and enables Cloudflare's WAF and DDoS shields.

---

## 2. SSL/TLS Cryptographic Policies
- **SSL/TLS Encryption Mode**: Set to **Full (Strict)**. This ensures traffic is encrypted both between the end-user and Cloudflare, and between Cloudflare and your Nginx proxy server.
- **Always Use HTTPS**: Toggle to **ON** to force SSL redirects at Cloudflare's network edge.
- **Minimum TLS Version**: Set to **TLS 1.2** or **TLS 1.3** to block legacy, insecure handshakes.

---

## 3. Web Application Firewall (WAF) Rule Policies
Configure the following custom firewall rule sets in the Cloudflare dashboard to prevent automated brute-force attacks and security vulnerabilities:

### Rule 1: Limit Backend Documentation Exposure
- **Field**: `URI Path`
- **Operator**: `equals` / `starts with`
- **Value**: `/docs` or `/redoc`
- **Action**: **Block** (or restrict to your specific Admin static IP address using an `IP Source Address` filter).

### Rule 2: API High-Severity Security Check
- **Field**: `URI Path`
- **Operator**: `starts with`
- **Value**: `/api/`
- **Action**: Enable OWASP Anomaly Threat Score check. If the threat score exceeds `15`, block the incoming request.

---

## 4. DDoS & Rate Limiting Shields
In addition to Nginx rate limiting (`limit_req` in `nginx.conf`), configure Cloudflare Rate Limiting rules on `api.doitservices.in/*`:
- **Trigger**: When requests exceed `60` requests per minute per IP address.
- **Action**: **Block** or trigger a **JS Challenge** for 1 hour. This eliminates scraping and automated load generation before it reaches your origin infrastructure.
