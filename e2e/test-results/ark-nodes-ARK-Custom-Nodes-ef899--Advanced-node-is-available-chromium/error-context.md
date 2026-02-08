# Page snapshot

```yaml
- generic [ref=e2]:
  - heading "🚀 ARK n8n Demo" [level=1] [ref=e3]
  - paragraph [ref=e5]:
    - text: ⚠️ Auto-login failed.
    - link "Click here" [ref=e6] [cursor=pointer]:
      - /url: /signin
    - text: to login manually.
  - generic [ref=e7]:
    - strong [ref=e8]: "Demo Credentials:"
    - text: admin@example.com
    - text: Admin123!@#
  - generic [ref=e9]:
    - paragraph [ref=e10]: "If auto-login fails:"
    - link "Click here to login manually" [ref=e11] [cursor=pointer]:
      - /url: /signin
```